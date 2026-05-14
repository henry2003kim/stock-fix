import { NextResponse } from "next/server";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";
import { fetchTopStocks, getStockFactors } from "@/lib/stockData";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://finance.naver.com/",
  Accept: "application/json, text/plain, */*",
};

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend    = new Resend(process.env.RESEND_API_KEY);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // ── Fetch all 20 tracked stocks + KOSPI ───────────────────────────────
    const [allStocks, kospiRes] = await Promise.all([
      fetchTopStocks(20),
      fetch("https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI", { headers: HEADERS }),
    ]);

    const kospiJson = await kospiRes.json();
    const dd         = kospiJson?.datas?.[0];
    const kospiValue = parseFloat(String(dd?.closePrice ?? "0").replace(/,/g, "")) || 0;
    const rawChange  = String(dd?.compareToPreviousClosePrice ?? "0");
    const kospiChange = parseFloat(rawChange.replace(/,/g, "").replace(/\+/g, "")) || 0;
    const kospiIsUp  = !rawChange.trim().startsWith("-");
    const kospiPct   = parseFloat(String(dd?.fluctuationsRatio ?? "0")) * (kospiIsUp ? 1 : -1);

    // ── Sort views ────────────────────────────────────────────────────────
    const byChangeDesc = [...allStocks].sort((a, b) => b.change_percent - a.change_percent);
    const byChangeAsc  = [...allStocks].sort((a, b) => a.change_percent - b.change_percent);

    const topGainers = byChangeDesc.slice(0, 5);
    // Always show bottom 5 — label changes based on whether they're truly negative
    const bottomPerformers = byChangeAsc.slice(0, 5);
    const hasRealLosers    = bottomPerformers.some((s) => s.change_percent < 0);

    const gainers     = allStocks.filter((s) => s.change_percent > 0);
    const losers      = allStocks.filter((s) => s.change_percent < 0);
    const breadthPct  = Math.round((gainers.length / allStocks.length) * 100);

    // Top 8 movers by absolute change for the chart
    const movers = [...allStocks]
      .sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent))
      .slice(0, 8);

    // ── Sector groupings ──────────────────────────────────────────────────
    const sectorMap: Record<string, number[]> = {};
    allStocks.forEach((s) => {
      const { sector } = getStockFactors(s.ticker);
      if (!sectorMap[sector]) sectorMap[sector] = [];
      sectorMap[sector].push(s.change_percent);
    });
    const sectors = Object.entries(sectorMap)
      .map(([label, changes]) => ({
        label,
        avg: changes.reduce((a, b) => a + b, 0) / changes.length,
      }))
      .sort((a, b) => b.avg - a.avg);

    // ── QuickChart via POST (no URL length limit, supports datalabels) ─────
    const chartPayload = {
      backgroundColor: "#040d1a",
      width: 540,
      height: 300,
      chart: {
        type: "horizontalBar",
        data: {
          labels: movers.map((s) => s.name),
          datasets: [{
            data: movers.map((s) => parseFloat(s.change_percent.toFixed(2))),
            backgroundColor: movers.map((s) =>
              s.change_percent >= 0 ? "rgba(74,222,128,0.9)" : "rgba(248,113,113,0.9)"
            ),
            borderWidth: 0,
          }],
        },
        options: {
          legend: { display: false },
          plugins: {
            datalabels: {
              anchor: "end",
              align: "end",
              color: "#e2e8f0",
              font: { size: 12, weight: "bold" },
              formatter: "function(v){return(v>=0?'+':'')+v+'%';}",
            },
          },
          layout: { padding: { right: 55 } },
          scales: {
            xAxes: [{
              gridLines: { color: "rgba(255,255,255,0.07)", zeroLineColor: "rgba(255,255,255,0.25)" },
              ticks: { fontColor: "#475569", fontSize: 11 },
            }],
            yAxes: [{
              gridLines: { display: false },
              ticks: { fontColor: "#e2e8f0", fontSize: 12, fontStyle: "bold" },
            }],
          },
        },
      },
    };

    let chartUrl = "";
    try {
      const qcRes  = await fetch("https://quickchart.io/chart/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chartPayload),
      });
      const qcData = await qcRes.json();
      chartUrl = qcData.url ?? "";
    } catch { /* chart optional — email still sends without it */ }

    // ── AI briefing ───────────────────────────────────────────────────────
    const stockLine  = allStocks.slice(0, 10)
      .map((s) => `${s.name}: ${s.change_percent >= 0 ? "+" : ""}${s.change_percent.toFixed(2)}%`)
      .join(", ");
    const sectorLine = sectors
      .map((s) => `${s.label} ${s.avg >= 0 ? "+" : ""}${s.avg.toFixed(2)}%`)
      .join(", ");

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `You are a sharp Korean equity analyst. Write a pre-market briefing in the style of PitchBook and Exec Sum — direct, data-driven, no fluff.

KOSPI: ${kospiValue.toLocaleString("ko-KR")} (${kospiPct >= 0 ? "+" : ""}${kospiPct.toFixed(2)}%)
Breadth: ${gainers.length} gainers / ${losers.length} losers of ${allStocks.length} tracked
Movers: ${stockLine}
Sectors: ${sectorLine}

Return ONLY valid JSON — no markdown, no extra text:
{
  "headline": "one punchy sentence capturing today's story (max 12 words)",
  "brief": ["data-driven bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "opportunities": ["opportunity 1", "opportunity 2"],
  "risks": ["risk 1", "risk 2"],
  "watch": ["specific catalyst 1", "catalyst 2", "catalyst 3"]
}`,
      }],
    });

    let ai: { headline: string; brief: string[]; opportunities: string[]; risks: string[]; watch: string[] };
    try {
      const raw = (aiResponse.content[0] as { text: string }).text.trim();
      ai = JSON.parse(raw.startsWith("```") ? raw.replace(/```json?/g, "").replace(/```/g, "").trim() : raw);
    } catch {
      ai = {
        headline: "Korean blue-chips move on global macro cues",
        brief: ["KOSPI reflects overnight sentiment", "Semis lead breadth today", "FX pressure on export names", "Watch foreign net flows"],
        opportunities: ["Tech sector building momentum", "Value plays at support"],
        risks: ["Global rate path uncertainty", "KRW/USD headwinds"],
        watch: ["US macro data post-close", "Chip demand signals", "Institutional net buying"],
      };
    }

    // ── Formatting helpers ────────────────────────────────────────────────
    const fmt     = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
    const today   = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul",
    });
    const timeKST = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul",
    });

    const kospiColor = kospiIsUp ? "#4ade80" : "#f87171";
    const kospiArrow = kospiIsUp ? "▲" : "▼";

    // ── Sector bars ───────────────────────────────────────────────────────
    const maxAbs = Math.max(...sectors.map((s) => Math.abs(s.avg)), 0.01);
    const sectorRows = sectors.map((s) => {
      const pct   = Math.round((Math.abs(s.avg) / maxAbs) * 100);
      const color = s.avg >= 0 ? "#4ade80" : "#f87171";
      return `
      <tr>
        <td style="padding:8px 14px 8px 0;font-size:13px;font-weight:700;color:#cbd5e1;white-space:nowrap;width:145px;">${s.label}</td>
        <td style="padding:8px 0;">
          <table cellpadding="0" cellspacing="0" style="width:100%;"><tr>
            <td style="width:${pct}%;background:${color};height:10px;border-radius:5px;opacity:0.85;"></td>
            <td style="width:${100 - pct}%;"></td>
          </tr></table>
        </td>
        <td style="padding:8px 0 8px 12px;font-size:14px;color:${color};font-weight:900;white-space:nowrap;width:62px;text-align:right;">${fmt(s.avg)}</td>
      </tr>`;
    }).join("");

    // ── Mover rows ────────────────────────────────────────────────────────
    const gainersRows = topGainers.map((s) => `
      <tr>
        <td style="padding:7px 10px 7px 0;font-size:13px;font-weight:700;color:#e2e8f0;">${s.name}</td>
        <td style="padding:7px 0;font-size:14px;color:#4ade80;font-weight:900;text-align:right;white-space:nowrap;">${fmt(s.change_percent)}</td>
      </tr>`).join("");

    const bottomLabel = hasRealLosers ? "▼ Top Losers" : "⬇ Underperformers";
    const bottomColor = (s: (typeof bottomPerformers)[0]) =>
      s.change_percent < 0 ? "#f87171" : "#fb923c";

    const bottomRows = bottomPerformers.map((s) => `
      <tr>
        <td style="padding:7px 10px 7px 0;font-size:13px;font-weight:700;color:#e2e8f0;">${s.name}</td>
        <td style="padding:7px 0;font-size:14px;color:${bottomColor(s)};font-weight:900;text-align:right;white-space:nowrap;">${fmt(s.change_percent)}</td>
      </tr>`).join("");

    // ── HTML ──────────────────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#00040b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:28px 18px 44px;">

  <!-- HEADER -->
  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:22px;">
    <tr>
      <td>
        <span style="font-size:22px;font-weight:900;color:#f8fafc;letter-spacing:-0.5px;">📈 StockFix</span>
        <span style="font-size:11px;color:#334155;font-weight:700;margin-left:10px;background:#060e1d;padding:4px 12px;border-radius:20px;border:1px solid #0f2035;">Morning Briefing</span>
      </td>
      <td style="text-align:right;">
        <span style="font-size:12px;color:#475569;font-weight:600;">${today}</span><br/>
        <span style="font-size:11px;color:#1e3a5f;">${timeKST} KST</span>
      </td>
    </tr>
  </table>

  <!-- KOSPI HERO -->
  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;border-radius:18px;overflow:hidden;background:#02080f;border:1px solid #0c1d2e;">
    <tr>
      <td style="padding:24px 26px;border-right:1px solid #0c1d2e;">
        <div style="font-size:11px;color:#334155;text-transform:uppercase;letter-spacing:0.14em;font-weight:800;margin-bottom:8px;">KOSPI INDEX</div>
        <div style="font-size:34px;font-weight:900;color:#f8fafc;letter-spacing:-1.5px;">${kospiValue.toLocaleString("ko-KR")}</div>
        <div style="font-size:16px;font-weight:900;color:${kospiColor};margin-top:6px;">${kospiArrow}&nbsp;${Math.abs(kospiChange).toLocaleString("ko-KR")}&nbsp;(${fmt(kospiPct)})</div>
      </td>
      <td style="padding:24px 20px;border-right:1px solid #0c1d2e;text-align:center;width:112px;">
        <div style="font-size:11px;color:#334155;text-transform:uppercase;letter-spacing:0.14em;font-weight:800;margin-bottom:8px;">GAINERS</div>
        <div style="font-size:32px;font-weight:900;color:#4ade80;">${gainers.length}</div>
        <div style="font-size:11px;color:#14532d;margin-top:5px;font-weight:700;">of ${allStocks.length}</div>
      </td>
      <td style="padding:24px 20px;border-right:1px solid #0c1d2e;text-align:center;width:112px;">
        <div style="font-size:11px;color:#334155;text-transform:uppercase;letter-spacing:0.14em;font-weight:800;margin-bottom:8px;">LOSERS</div>
        <div style="font-size:32px;font-weight:900;color:#f87171;">${losers.length}</div>
        <div style="font-size:11px;color:#7f1d1d;margin-top:5px;font-weight:700;">of ${allStocks.length}</div>
      </td>
      <td style="padding:24px 20px;text-align:center;width:112px;">
        <div style="font-size:11px;color:#334155;text-transform:uppercase;letter-spacing:0.14em;font-weight:800;margin-bottom:8px;">BREADTH</div>
        <div style="font-size:32px;font-weight:900;color:${breadthPct >= 50 ? "#4ade80" : "#f87171"};">${breadthPct}%</div>
        <div style="font-size:11px;color:#1e3a5f;margin-top:5px;font-weight:700;">bullish</div>
      </td>
    </tr>
    <tr>
      <td colspan="4" style="padding:0;line-height:0;">
        <table cellpadding="0" cellspacing="0" style="width:100%;"><tr>
          <td style="width:${breadthPct}%;height:5px;background:linear-gradient(90deg,#15803d,#4ade80);"></td>
          <td style="width:${100 - breadthPct}%;height:5px;background:linear-gradient(90deg,#b91c1c,#f87171);"></td>
        </tr></table>
      </td>
    </tr>
  </table>

  <!-- THE BRIEF -->
  <div style="background:#010a17;border:1px solid #0c1d2e;border-radius:18px;padding:24px 26px;margin-bottom:14px;">
    <div style="font-size:11px;color:#2563eb;text-transform:uppercase;letter-spacing:0.14em;font-weight:900;margin-bottom:14px;">✦ The Brief</div>
    <div style="font-size:19px;font-weight:900;color:#f8fafc;margin-bottom:18px;line-height:1.35;letter-spacing:-0.3px;">${ai.headline}</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${ai.brief.map((b) => `
      <tr>
        <td style="padding:5px 0;vertical-align:top;width:20px;font-size:15px;color:#1d4ed8;font-weight:900;">→</td>
        <td style="padding:5px 0 5px 8px;font-size:14px;color:#94a3b8;line-height:1.6;font-weight:500;">${b}</td>
      </tr>`).join("")}
    </table>
  </div>

  <!-- CHART -->
  ${chartUrl ? `
  <div style="background:#02080f;border:1px solid #0c1d2e;border-radius:18px;overflow:hidden;margin-bottom:14px;">
    <div style="padding:18px 22px 10px;">
      <span style="font-size:11px;color:#334155;text-transform:uppercase;letter-spacing:0.14em;font-weight:800;">Top Movers — % Change</span>
    </div>
    <img src="${chartUrl}" alt="Top Movers Chart" width="560" style="width:100%;display:block;border:0;" />
  </div>` : ""}

  <!-- GAINERS / BOTTOM PERFORMERS -->
  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
    <tr>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#010f06;border:1px solid #14532d;border-radius:18px;padding:20px 22px;">
          <div style="font-size:11px;color:#4ade80;text-transform:uppercase;letter-spacing:0.14em;font-weight:900;margin-bottom:14px;">▲ Top Gainers</div>
          <table cellpadding="0" cellspacing="0" style="width:100%;">${gainersRows}</table>
        </div>
      </td>
      <td style="width:2%;"></td>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#0e0102;border:1px solid #7f1d1d;border-radius:18px;padding:20px 22px;">
          <div style="font-size:11px;color:${hasRealLosers ? "#f87171" : "#fb923c"};text-transform:uppercase;letter-spacing:0.14em;font-weight:900;margin-bottom:14px;">${bottomLabel}</div>
          <table cellpadding="0" cellspacing="0" style="width:100%;">${bottomRows}</table>
        </div>
      </td>
    </tr>
  </table>

  <!-- SECTOR PERFORMANCE -->
  <div style="background:#02080f;border:1px solid #0c1d2e;border-radius:18px;padding:22px;margin-bottom:14px;">
    <div style="font-size:11px;color:#334155;text-transform:uppercase;letter-spacing:0.14em;font-weight:800;margin-bottom:16px;">Sector Performance</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">${sectorRows}</table>
  </div>

  <!-- OPPORTUNITIES + RISKS -->
  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
    <tr>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#010f06;border:1px solid #14532d;border-radius:18px;padding:20px 22px;">
          <div style="font-size:11px;color:#4ade80;text-transform:uppercase;letter-spacing:0.14em;font-weight:900;margin-bottom:13px;">Opportunities</div>
          ${ai.opportunities.map((o) => `<div style="font-size:13px;color:#86efac;margin-bottom:9px;padding-left:13px;border-left:3px solid #166534;font-weight:600;line-height:1.55;">✓ ${o}</div>`).join("")}
        </div>
      </td>
      <td style="width:2%;"></td>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#0e0102;border:1px solid #7f1d1d;border-radius:18px;padding:20px 22px;">
          <div style="font-size:11px;color:#f87171;text-transform:uppercase;letter-spacing:0.14em;font-weight:900;margin-bottom:13px;">Risks</div>
          ${ai.risks.map((r) => `<div style="font-size:13px;color:#fca5a5;margin-bottom:9px;padding-left:13px;border-left:3px solid #991b1b;font-weight:600;line-height:1.55;">⚠ ${r}</div>`).join("")}
        </div>
      </td>
    </tr>
  </table>

  <!-- WHAT TO WATCH -->
  <div style="background:#02080f;border:1px solid #0c1d2e;border-radius:18px;padding:22px;margin-bottom:28px;">
    <div style="font-size:11px;color:#334155;text-transform:uppercase;letter-spacing:0.14em;font-weight:800;margin-bottom:15px;">What to Watch Today</div>
    ${ai.watch.map((w, i) => `
    <div style="margin-bottom:11px;">
      <span style="font-size:14px;color:#1d4ed8;font-weight:900;margin-right:10px;">${i + 1}</span>
      <span style="font-size:14px;color:#cbd5e1;line-height:1.6;font-weight:600;">${w}</span>
    </div>`).join("")}
  </div>

  <!-- CTA -->
  <div style="text-align:center;margin-bottom:30px;">
    <a href="https://stock-fix-alpha.vercel.app/dashboard"
       style="display:inline-block;background:linear-gradient(135deg,#1e3a8a,#1d4ed8);color:#ffffff;font-size:14px;font-weight:900;padding:16px 40px;border-radius:14px;text-decoration:none;letter-spacing:0.04em;">
      Open Dashboard →
    </a>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #0c1d2e;padding-top:16px;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#1e3a5f;font-weight:600;">StockFix · Daily at 7:15am KST · Data via Naver Finance · AI by Claude</p>
    <p style="margin:0;font-size:11px;color:#0c1d2e;">For informational purposes only. Not financial advice.</p>
  </div>

</div>
</body>
</html>`;

    await resend.emails.send({
      from: "StockFix <onboarding@resend.dev>",
      to: process.env.BRIEFING_EMAIL!,
      subject: `📈 ${ai.headline} — StockFix ${today}`,
      html,
    });

    return NextResponse.json({
      ok: true,
      kospi: kospiValue,
      headline: ai.headline,
      gainers: gainers.length,
      losers: losers.length,
      bottomPerformers: bottomPerformers.map((s) => `${s.name} ${fmt(s.change_percent)}`),
      chartUrl,
    });
  } catch (err) {
    console.error("Morning briefing error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

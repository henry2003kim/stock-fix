import { NextResponse } from "next/server";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";
import { fetchTopStocks, getStockFactors } from "@/lib/stockData";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend    = new Resend(process.env.RESEND_API_KEY);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // Fetch all 20 stocks so losers are always captured
    const allStocks = await fetchTopStocks(20);

    const kospiRes = await fetch(
      "https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI",
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://finance.naver.com/" } }
    );
    const kospiJson = await kospiRes.json();
    const dd = kospiJson?.datas?.[0];
    const kospiValue = parseFloat(String(dd?.closePrice ?? "0").replace(/,/g, "")) || 0;
    const kospiChangeRaw = String(dd?.compareToPreviousClosePrice ?? "0");
    const kospiChange = parseFloat(kospiChangeRaw.replace(/,/g, "").replace(/\+/g, "")) || 0;
    const kospiIsUp = !kospiChangeRaw.trim().startsWith("-");
    const kospiPct = parseFloat(String(dd?.fluctuationsRatio ?? "0")) * (kospiIsUp ? 1 : -1);

    // Sorted views
    const gainers = [...allStocks].filter((s) => s.change_percent > 0).sort((a, b) => b.change_percent - a.change_percent);
    const losers  = [...allStocks].filter((s) => s.change_percent < 0).sort((a, b) => a.change_percent - b.change_percent);
    const topG    = gainers.slice(0, 5);
    const topL    = losers.slice(0, 5);
    const movers  = [...allStocks].sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent)).slice(0, 8);

    const breadthPct = Math.round((gainers.length / allStocks.length) * 100);

    // Sector groupings
    const sectorMap: Record<string, number[]> = {};
    allStocks.forEach((s) => {
      const { sector } = getStockFactors(s.ticker);
      if (!sectorMap[sector]) sectorMap[sector] = [];
      sectorMap[sector].push(s.change_percent);
    });
    const sectors = Object.entries(sectorMap)
      .map(([label, changes]) => ({ label, avg: changes.reduce((a, b) => a + b, 0) / changes.length }))
      .sort((a, b) => b.avg - a.avg);

    // QuickChart — v2 horizontalBar (no TS syntax in callbacks)
    const chartLabels  = movers.map((s) => s.name);
    const chartData    = movers.map((s) => parseFloat(s.change_percent.toFixed(2)));
    const chartColors  = movers.map((s) => s.change_percent >= 0 ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)");

    const chartConfig = {
      type: "horizontalBar",
      data: {
        labels: chartLabels,
        datasets: [{ data: chartData, backgroundColor: chartColors, borderWidth: 0 }],
      },
      options: {
        legend: { display: false },
        scales: {
          xAxes: [{
            gridLines: { color: "rgba(255,255,255,0.07)", zeroLineColor: "rgba(255,255,255,0.15)" },
            ticks: { fontColor: "#94a3b8", fontSize: 12, fontStyle: "bold" },
            scaleLabel: { display: true, labelString: "% Change", fontColor: "#64748b", fontSize: 11 },
          }],
          yAxes: [{
            gridLines: { display: false },
            ticks: { fontColor: "#f1f5f9", fontSize: 13, fontStyle: "bold" },
          }],
        },
      },
    };
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&backgroundColor=rgb%280%2C6%2C18%29&width=540&height=320`;

    // AI briefing
    const stockLine  = allStocks.slice(0, 10).map((s) => `${s.name}: ${s.change_percent >= 0 ? "+" : ""}${s.change_percent.toFixed(2)}%`).join(", ");
    const sectorLine = sectors.map((s) => `${s.label} ${s.avg >= 0 ? "+" : ""}${s.avg.toFixed(2)}%`).join(", ");

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `You are a sharp Korean equity market analyst writing a pre-market briefing in the style of PitchBook and Exec Sum — data-driven, direct, zero fluff.

KOSPI: ${kospiValue.toLocaleString("ko-KR")} (${kospiPct >= 0 ? "+" : ""}${kospiPct.toFixed(2)}%)
Breadth: ${gainers.length} gainers / ${losers.length} losers of ${allStocks.length}
Movers: ${stockLine}
Sectors: ${sectorLine}

Return ONLY valid JSON:
{
  "headline": "one punchy sentence (max 12 words, no quotes)",
  "brief": ["bullet 1 — specific, data-driven", "bullet 2", "bullet 3", "bullet 4"],
  "opportunities": ["opportunity 1", "opportunity 2"],
  "risks": ["risk 1", "risk 2"],
  "watch": ["specific catalyst or event to watch 1", "watch 2", "watch 3"]
}`,
      }],
    });

    let ai: { headline: string; brief: string[]; opportunities: string[]; risks: string[]; watch: string[] };
    try {
      ai = JSON.parse((aiResponse.content[0] as { text: string }).text);
    } catch {
      ai = {
        headline: "Korean markets move on broad macro signals",
        brief: ["KOSPI reflects overnight sentiment shifts", "Semiconductor names lead activity today", "Foreign flows remain a key variable", "Watch for FX pressure on exporters"],
        opportunities: ["Tech sector momentum building", "Value names at support levels"],
        risks: ["Global rate uncertainty persisting", "FX headwinds for exporters"],
        watch: ["US macro data after market close", "Chip export order flow", "Institutional net buying direction"],
      };
    }

    // Formatting helpers
    const fmt   = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" });
    const timeKST = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul" });

    const kospiColor = kospiIsUp ? "#4ade80" : "#f87171";
    const kospiArrow = kospiIsUp ? "▲" : "▼";

    // Sector bars
    const maxAbs = Math.max(...sectors.map((s) => Math.abs(s.avg)), 0.01);
    const sectorRows = sectors.map((s) => {
      const pct   = Math.round((Math.abs(s.avg) / maxAbs) * 100);
      const color = s.avg >= 0 ? "#4ade80" : "#f87171";
      return `
        <tr>
          <td style="padding:7px 14px 7px 0;font-size:13px;font-weight:600;color:#cbd5e1;white-space:nowrap;width:140px;">${s.label}</td>
          <td style="padding:7px 0;">
            <table cellpadding="0" cellspacing="0" style="width:100%;"><tr>
              <td style="width:${pct}%;background:${color};height:9px;border-radius:5px;opacity:0.85;"></td>
              <td style="width:${100 - pct}%;"></td>
            </tr></table>
          </td>
          <td style="padding:7px 0 7px 12px;font-size:13px;color:${color};font-weight:800;white-space:nowrap;width:58px;text-align:right;">${fmt(s.avg)}</td>
        </tr>`;
    }).join("");

    // Mover rows
    const moverRows = (list: typeof topG, color: string) =>
      list.length === 0
        ? `<tr><td colspan="2" style="font-size:13px;color:#334155;padding:6px 0;text-align:center;">None tracked</td></tr>`
        : list.map((s) => `
          <tr>
            <td style="padding:6px 10px 6px 0;font-size:13px;font-weight:600;color:#e2e8f0;">${s.name}</td>
            <td style="padding:6px 0;font-size:13px;color:${color};font-weight:800;text-align:right;white-space:nowrap;">${fmt(s.change_percent)}</td>
          </tr>`).join("");

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
        <span style="font-size:11px;color:#475569;font-weight:600;margin-left:10px;background:#0a1628;padding:4px 11px;border-radius:20px;border:1px solid #1e3a5f;">Morning Briefing</span>
      </td>
      <td style="text-align:right;">
        <span style="font-size:12px;color:#64748b;font-weight:500;">${today}</span><br/>
        <span style="font-size:11px;color:#334155;">${timeKST} KST</span>
      </td>
    </tr>
  </table>

  <!-- KOSPI HERO + BREADTH -->
  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;border-radius:18px;overflow:hidden;background:#040d1a;border:1px solid #0f2035;">
    <tr>
      <td style="padding:22px 26px;border-right:1px solid #0f2035;">
        <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:8px;">KOSPI INDEX</div>
        <div style="font-size:32px;font-weight:900;color:#f8fafc;letter-spacing:-1.5px;">${kospiValue.toLocaleString("ko-KR")}</div>
        <div style="font-size:15px;font-weight:800;color:${kospiColor};margin-top:5px;">${kospiArrow} ${Math.abs(kospiChange).toLocaleString("ko-KR")} &nbsp;(${fmt(kospiPct)})</div>
      </td>
      <td style="padding:22px 18px;border-right:1px solid #0f2035;text-align:center;width:110px;">
        <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:8px;">GAINERS</div>
        <div style="font-size:30px;font-weight:900;color:#4ade80;">${gainers.length}</div>
        <div style="font-size:11px;color:#166534;margin-top:4px;font-weight:600;">of ${allStocks.length}</div>
      </td>
      <td style="padding:22px 18px;border-right:1px solid #0f2035;text-align:center;width:110px;">
        <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:8px;">LOSERS</div>
        <div style="font-size:30px;font-weight:900;color:#f87171;">${losers.length}</div>
        <div style="font-size:11px;color:#7f1d1d;margin-top:4px;font-weight:600;">of ${allStocks.length}</div>
      </td>
      <td style="padding:22px 18px;text-align:center;width:110px;">
        <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:8px;">BREADTH</div>
        <div style="font-size:30px;font-weight:900;color:${breadthPct >= 50 ? "#4ade80" : "#f87171"};">${breadthPct}%</div>
        <div style="font-size:11px;color:#334155;margin-top:4px;font-weight:600;">bullish</div>
      </td>
    </tr>
    <tr>
      <td colspan="4" style="padding:0;line-height:0;">
        <table cellpadding="0" cellspacing="0" style="width:100%;"><tr>
          <td style="width:${breadthPct}%;height:5px;background:linear-gradient(90deg,#16a34a,#4ade80);"></td>
          <td style="width:${100 - breadthPct}%;height:5px;background:linear-gradient(90deg,#dc2626,#f87171);"></td>
        </tr></table>
      </td>
    </tr>
  </table>

  <!-- THE BRIEF -->
  <div style="background:#020b18;border:1px solid #0f2035;border-radius:18px;padding:22px 26px;margin-bottom:14px;">
    <div style="font-size:11px;color:#3b82f6;text-transform:uppercase;letter-spacing:0.14em;font-weight:800;margin-bottom:13px;">✦ The Brief</div>
    <div style="font-size:18px;font-weight:900;color:#f8fafc;margin-bottom:16px;line-height:1.35;letter-spacing:-0.3px;">${ai.headline}</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${ai.brief.map((b) => `
      <tr>
        <td style="padding:5px 0;vertical-align:top;width:18px;font-size:14px;color:#2563eb;font-weight:900;">→</td>
        <td style="padding:5px 0 5px 8px;font-size:14px;color:#94a3b8;line-height:1.55;font-weight:500;">${b}</td>
      </tr>`).join("")}
    </table>
  </div>

  <!-- CHART -->
  <div style="background:#040d1a;border:1px solid #0f2035;border-radius:18px;overflow:hidden;margin-bottom:14px;">
    <div style="padding:18px 22px 10px;">
      <span style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;">Top Movers — % Change</span>
    </div>
    <img src="${chartUrl}" alt="Top Movers Chart" width="560" style="width:100%;display:block;border:0;" />
  </div>

  <!-- GAINERS / LOSERS -->
  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
    <tr>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#020f06;border:1px solid #14532d;border-radius:18px;padding:18px 20px;">
          <div style="font-size:11px;color:#4ade80;text-transform:uppercase;letter-spacing:0.12em;font-weight:800;margin-bottom:12px;">▲ Top Gainers</div>
          <table cellpadding="0" cellspacing="0" style="width:100%;">
            ${moverRows(topG, "#4ade80")}
          </table>
        </div>
      </td>
      <td style="width:2%;"></td>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#0f0202;border:1px solid #7f1d1d;border-radius:18px;padding:18px 20px;">
          <div style="font-size:11px;color:#f87171;text-transform:uppercase;letter-spacing:0.12em;font-weight:800;margin-bottom:12px;">▼ Top Losers</div>
          <table cellpadding="0" cellspacing="0" style="width:100%;">
            ${moverRows(topL, "#f87171")}
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- SECTOR PERFORMANCE -->
  <div style="background:#040d1a;border:1px solid #0f2035;border-radius:18px;padding:20px 22px;margin-bottom:14px;">
    <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:16px;">Sector Performance</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">${sectorRows}</table>
  </div>

  <!-- OPPORTUNITIES + RISKS -->
  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
    <tr>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#020f06;border:1px solid #14532d;border-radius:18px;padding:18px 20px;">
          <div style="font-size:11px;color:#4ade80;text-transform:uppercase;letter-spacing:0.12em;font-weight:800;margin-bottom:12px;">Opportunities</div>
          ${ai.opportunities.map((o) => `<div style="font-size:13px;color:#86efac;margin-bottom:8px;padding-left:13px;border-left:3px solid #166534;font-weight:500;line-height:1.5;">✓ ${o}</div>`).join("")}
        </div>
      </td>
      <td style="width:2%;"></td>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#0f0202;border:1px solid #7f1d1d;border-radius:18px;padding:18px 20px;">
          <div style="font-size:11px;color:#f87171;text-transform:uppercase;letter-spacing:0.12em;font-weight:800;margin-bottom:12px;">Risks</div>
          ${ai.risks.map((r) => `<div style="font-size:13px;color:#fca5a5;margin-bottom:8px;padding-left:13px;border-left:3px solid #991b1b;font-weight:500;line-height:1.5;">⚠ ${r}</div>`).join("")}
        </div>
      </td>
    </tr>
  </table>

  <!-- WHAT TO WATCH -->
  <div style="background:#040d1a;border:1px solid #0f2035;border-radius:18px;padding:20px 22px;margin-bottom:26px;">
    <div style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:14px;">What to Watch Today</div>
    ${ai.watch.map((w, i) => `
    <div style="margin-bottom:10px;display:flex;align-items:flex-start;">
      <span style="font-size:13px;color:#2563eb;font-weight:900;min-width:22px;margin-right:10px;margin-top:1px;">${i + 1}</span>
      <span style="font-size:14px;color:#cbd5e1;line-height:1.55;font-weight:500;">${w}</span>
    </div>`).join("")}
  </div>

  <!-- CTA -->
  <div style="text-align:center;margin-bottom:28px;">
    <a href="https://stock-fix-alpha.vercel.app/dashboard"
       style="display:inline-block;background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#ffffff;font-size:14px;font-weight:800;padding:15px 38px;border-radius:14px;text-decoration:none;letter-spacing:0.03em;">
      Open Dashboard →
    </a>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #0f2035;padding-top:16px;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:#1e3a5f;font-weight:500;">StockFix · Daily at 7:15am KST · Data via Naver Finance · AI by Claude</p>
    <p style="margin:0;font-size:11px;color:#0f2035;">For informational purposes only. Not financial advice.</p>
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

    return NextResponse.json({ ok: true, kospi: kospiValue, headline: ai.headline, gainers: gainers.length, losers: losers.length });
  } catch (err) {
    console.error("Morning briefing error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

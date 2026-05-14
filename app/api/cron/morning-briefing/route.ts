import { NextResponse } from "next/server";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";
import { fetchKospiIndex, fetchTopStocks, getStockFactors } from "@/lib/stockData";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend   = new Resend(process.env.RESEND_API_KEY);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const [kospi, stocks] = await Promise.all([
      fetchKospiIndex(),
      fetchTopStocks(10),
    ]);

    // ── Market breadth ────────────────────────────────
    const gainers  = stocks.filter((s) => s.change_percent > 0);
    const losers   = stocks.filter((s) => s.change_percent < 0);
    const neutral  = stocks.filter((s) => s.change_percent === 0);
    const breadthPct = Math.round((gainers.length / stocks.length) * 100);

    // ── Sector groupings ──────────────────────────────
    const sectorMap: Record<string, { changes: number[]; label: string }> = {};
    stocks.forEach((s) => {
      const { sector } = getStockFactors(s.ticker);
      if (!sectorMap[sector]) sectorMap[sector] = { changes: [], label: sector };
      sectorMap[sector].changes.push(s.change_percent);
    });
    const sectors = Object.values(sectorMap)
      .map((s) => ({ label: s.label, avg: s.changes.reduce((a, b) => a + b, 0) / s.changes.length }))
      .sort((a, b) => b.avg - a.avg);

    // ── Top movers sorted by abs change ───────────────
    const movers = [...stocks].sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent)).slice(0, 8);

    // ── QuickChart bar chart URL ───────────────────────
    const chartConfig = {
      type: "bar",
      data: {
        labels: movers.map((s) => s.name),
        datasets: [{
          data: movers.map((s) => parseFloat(s.change_percent.toFixed(2))),
          backgroundColor: movers.map((s) => s.change_percent >= 0 ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)"),
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.06)" },
            ticks: { color: "#9ca3af", font: { size: 11 }, callback: (v: number) => `${v > 0 ? "+" : ""}${v}%` },
          },
          y: { grid: { display: false }, ticks: { color: "#e5e7eb", font: { size: 12 } } },
        },
      },
    };
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&backgroundColor=rgb%2817%2C24%2C39%29&width=520&height=300`;

    // ── AI structured briefing ────────────────────────
    const stockLine = stocks.map((s) => `${s.name}: ${s.change_percent >= 0 ? "+" : ""}${s.change_percent.toFixed(2)}%`).join(", ");
    const sectorLine = sectors.map((s) => `${s.label} ${s.avg >= 0 ? "+" : ""}${s.avg.toFixed(2)}%`).join(", ");

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `You are writing a morning market briefing in the style of Exec Sum (punchy, direct, slightly casual) combined with PitchBook (data-driven, professional).

KOSPI: ${kospi.value.toLocaleString("ko-KR")} (${kospi.change_percent >= 0 ? "+" : ""}${kospi.change_percent.toFixed(2)}%)
Movers: ${stockLine}
Sectors: ${sectorLine}
Breadth: ${gainers.length} gainers, ${losers.length} losers of ${stocks.length} tracked

Return ONLY valid JSON in this exact structure:
{
  "headline": "one punchy sentence capturing the market story today (max 12 words)",
  "brief": ["bullet 1 (specific, data-driven)", "bullet 2", "bullet 3", "bullet 4"],
  "opportunities": ["opportunity 1", "opportunity 2"],
  "risks": ["risk 1", "risk 2"],
  "watch": ["specific thing to watch 1", "thing 2", "thing 3"]
}`,
      }],
    });

    let ai: { headline: string; brief: string[]; opportunities: string[]; risks: string[]; watch: string[] };
    try {
      ai = JSON.parse((aiResponse.content[0] as { text: string }).text);
    } catch {
      ai = {
        headline: "Korean markets open with broad momentum",
        brief: ["KOSPI moves as tech leads gains", "Semiconductors outperform the benchmark", "Retail and institutional flows diverge"],
        opportunities: ["Semiconductor sector breakout", "EV battery supply chain"],
        risks: ["Global rate uncertainty", "FX volatility"],
        watch: ["US economic data", "Chip demand signals", "Foreign investor flows"],
      };
    }

    // ── Date ──────────────────────────────────────────
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "Asia/Seoul",
    });
    const timeKST = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Seoul",
    });

    const kospiColor = kospi.is_up ? "#22c55e" : "#ef4444";
    const kospiArrow = kospi.is_up ? "▲" : "▼";
    const fmt = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

    // ── Sector bar HTML ────────────────────────────────
    const maxAbsSector = Math.max(...sectors.map((s) => Math.abs(s.avg)), 0.01);
    const sectorRows = sectors.map((s) => {
      const pct = Math.round((Math.abs(s.avg) / maxAbsSector) * 100);
      const color = s.avg >= 0 ? "#22c55e" : "#ef4444";
      return `
        <tr>
          <td style="padding:6px 12px 6px 0;font-size:12px;color:#d1d5db;white-space:nowrap;width:130px;">${s.label}</td>
          <td style="padding:6px 0;">
            <table cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="width:${pct}%;background:${color};opacity:0.8;height:8px;border-radius:4px;"></td>
                <td style="width:${100 - pct}%;"></td>
              </tr>
            </table>
          </td>
          <td style="padding:6px 0 6px 10px;font-size:12px;color:${color};font-weight:700;white-space:nowrap;width:54px;text-align:right;">${fmt(s.avg)}</td>
        </tr>`;
    }).join("");

    // ── Movers table HTML ──────────────────────────────
    const topG = gainers.sort((a, b) => b.change_percent - a.change_percent).slice(0, 4);
    const topL = losers.sort((a, b) => a.change_percent - b.change_percent).slice(0, 4);

    const moverCell = (stocks: typeof topG, color: string) =>
      stocks.map((s) => `
        <tr>
          <td style="padding:5px 8px 5px 0;font-size:12px;color:#e5e7eb;">${s.name}</td>
          <td style="padding:5px 0;font-size:12px;color:${color};font-weight:700;text-align:right;">
            ${fmt(s.change_percent)}
          </td>
        </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#060a10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:28px 20px 40px;">

  <!-- ── HEADER ────────────────────────────────────── -->
  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
    <tr>
      <td>
        <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">📈 StockFix</span>
        <span style="font-size:11px;color:#6b7280;font-weight:500;margin-left:8px;background:#111827;padding:3px 10px;border-radius:20px;border:1px solid #1f2937;">Morning Briefing</span>
      </td>
      <td style="text-align:right;">
        <span style="font-size:11px;color:#6b7280;">${today}</span><br/>
        <span style="font-size:11px;color:#4b5563;">Sent at ${timeKST} KST</span>
      </td>
    </tr>
  </table>

  <!-- ── HERO KPI STRIP ─────────────────────────────── -->
  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;border-radius:16px;overflow:hidden;background:#111827;border:1px solid #1f2937;">
    <tr>
      <td style="padding:20px 24px;border-right:1px solid #1f2937;">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">KOSPI INDEX</div>
        <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-1px;">${kospi.value.toLocaleString("ko-KR")}</div>
        <div style="font-size:14px;font-weight:700;color:${kospiColor};margin-top:3px;">${kospiArrow} ${Math.abs(kospi.change).toLocaleString("ko-KR")} (${fmt(kospi.change_percent)})</div>
      </td>
      <td style="padding:20px 16px;border-right:1px solid #1f2937;text-align:center;width:100px;">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">GAINERS</div>
        <div style="font-size:28px;font-weight:800;color:#22c55e;">${gainers.length}</div>
        <div style="font-size:10px;color:#22c55e;margin-top:3px;">of ${stocks.length} tracked</div>
      </td>
      <td style="padding:20px 16px;border-right:1px solid #1f2937;text-align:center;width:100px;">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">LOSERS</div>
        <div style="font-size:28px;font-weight:800;color:#ef4444;">${losers.length}</div>
        <div style="font-size:10px;color:#ef4444;margin-top:3px;">of ${stocks.length} tracked</div>
      </td>
      <td style="padding:20px 16px;text-align:center;width:100px;">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">BREADTH</div>
        <div style="font-size:28px;font-weight:800;color:${breadthPct >= 50 ? "#22c55e" : "#ef4444"};">${breadthPct}%</div>
        <div style="font-size:10px;color:#6b7280;margin-top:3px;">bullish</div>
      </td>
    </tr>
    <!-- breadth bar -->
    <tr>
      <td colspan="4" style="padding:0;">
        <table cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td style="width:${breadthPct}%;height:4px;background:linear-gradient(90deg,#22c55e,#16a34a);"></td>
            <td style="width:${100 - breadthPct}%;height:4px;background:linear-gradient(90deg,#dc2626,#ef4444);"></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ── EXEC BRIEF ─────────────────────────────────── -->
  <div style="background:#0c1629;border:1px solid #1e3a5f;border-radius:16px;padding:20px 24px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <span style="font-size:10px;color:#60a5fa;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;">✦ The Brief</span>
      <span style="font-size:10px;color:#1e3a5f;background:#1e3a5f;border-radius:4px;padding:1px 6px;color:#93c5fd;">AI · Exec Sum Style</span>
    </div>
    <div style="font-size:16px;font-weight:700;color:#ffffff;margin-bottom:14px;line-height:1.4;">${ai.headline}</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${ai.brief.map((b) => `
      <tr>
        <td style="padding:4px 0;vertical-align:top;width:16px;font-size:13px;color:#3b82f6;">→</td>
        <td style="padding:4px 0 4px 6px;font-size:13px;color:#94a3b8;line-height:1.5;">${b}</td>
      </tr>`).join("")}
    </table>
  </div>

  <!-- ── MOVERS CHART ───────────────────────────────── -->
  <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;margin-bottom:16px;">
    <div style="padding:16px 20px 12px;">
      <span style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Top Movers — % Change</span>
    </div>
    <img src="${chartUrl}" alt="Top Movers Chart" width="560" style="width:100%;display:block;border:0;" />
  </div>

  <!-- ── GAINERS / LOSERS TABLE ─────────────────────── -->
  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
    <tr>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#0a1a0a;border:1px solid #14532d;border-radius:16px;padding:16px 18px;">
          <div style="font-size:10px;color:#22c55e;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:10px;">▲ Top Gainers</div>
          <table cellpadding="0" cellspacing="0" style="width:100%;">
            ${moverCell(topG, "#22c55e")}
          </table>
        </div>
      </td>
      <td style="width:2%;"></td>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#1a0a0a;border:1px solid #7f1d1d;border-radius:16px;padding:16px 18px;">
          <div style="font-size:10px;color:#ef4444;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:10px;">▼ Top Losers</div>
          <table cellpadding="0" cellspacing="0" style="width:100%;">
            ${moverCell(topL, "#ef4444")}
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- ── SECTOR PERFORMANCE ─────────────────────────── -->
  <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:18px 20px;margin-bottom:16px;">
    <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;margin-bottom:14px;">Sector Performance</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${sectorRows}
    </table>
  </div>

  <!-- ── OPPORTUNITIES & RISKS ──────────────────────── -->
  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
    <tr>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#0d1f12;border:1px solid #166534;border-radius:16px;padding:16px 18px;">
          <div style="font-size:10px;color:#4ade80;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:10px;">Opportunities</div>
          ${ai.opportunities.map((o) => `<div style="font-size:12px;color:#86efac;margin-bottom:6px;padding-left:12px;border-left:2px solid #166534;">✓ ${o}</div>`).join("")}
        </div>
      </td>
      <td style="width:2%;"></td>
      <td style="width:49%;vertical-align:top;">
        <div style="background:#1c0a0a;border:1px solid #991b1b;border-radius:16px;padding:16px 18px;">
          <div style="font-size:10px;color:#f87171;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:10px;">Risks</div>
          ${ai.risks.map((r) => `<div style="font-size:12px;color:#fca5a5;margin-bottom:6px;padding-left:12px;border-left:2px solid #991b1b;">⚠ ${r}</div>`).join("")}
        </div>
      </td>
    </tr>
  </table>

  <!-- ── WHAT TO WATCH ──────────────────────────────── -->
  <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:18px 20px;margin-bottom:24px;">
    <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;margin-bottom:12px;">What to Watch Today</div>
    ${ai.watch.map((w, i) => `
    <div style="display:flex;align-items:flex-start;margin-bottom:8px;">
      <span style="font-size:11px;color:#3b82f6;font-weight:800;min-width:20px;margin-right:10px;margin-top:1px;">${i + 1}</span>
      <span style="font-size:13px;color:#d1d5db;line-height:1.5;">${w}</span>
    </div>`).join("")}
  </div>

  <!-- ── CTA ────────────────────────────────────────── -->
  <div style="text-align:center;margin-bottom:28px;">
    <a href="https://stock-fix-alpha.vercel.app/dashboard"
       style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#ffffff;font-size:13px;font-weight:700;padding:13px 32px;border-radius:12px;text-decoration:none;letter-spacing:0.02em;">
      Open Dashboard →
    </a>
  </div>

  <!-- ── FOOTER ─────────────────────────────────────── -->
  <div style="border-top:1px solid #1f2937;padding-top:16px;text-align:center;">
    <p style="margin:0 0 4px;font-size:11px;color:#374151;">
      StockFix · Daily at 7:15am KST · Data via Naver Finance · AI by Claude
    </p>
    <p style="margin:0;font-size:10px;color:#1f2937;">
      For informational purposes only. Not financial advice.
    </p>
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

    return NextResponse.json({ ok: true, kospi: kospi.value, headline: ai.headline });
  } catch (err) {
    console.error("Morning briefing error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";
import { fetchKospiIndex, fetchTopStocks } from "@/lib/stockData";

const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [kospi, stocks] = await Promise.all([
      fetchKospiIndex(),
      fetchTopStocks(10),
    ]);

    const stockSummary = stocks
      .map((s) => `${s.name} (${s.ticker}): ₩${s.price.toLocaleString("ko-KR")} ${s.change_percent >= 0 ? "+" : ""}${s.change_percent.toFixed(2)}%`)
      .join("\n");

    const aiMessage = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `You are a Korean stock market analyst. Write a concise morning briefing (3-4 short paragraphs) based on this data. Write in English. Be specific, actionable, and professional.

KOSPI Index: ${kospi.value.toLocaleString("ko-KR")} (${kospi.change >= 0 ? "+" : ""}${kospi.change.toLocaleString("ko-KR")}, ${kospi.change_percent >= 0 ? "+" : ""}${kospi.change_percent.toFixed(2)}%)

Top movers:
${stockSummary}

Cover: (1) overall market sentiment and KOSPI direction, (2) notable movers and what's driving them, (3) key sectors to watch today, (4) one actionable insight for the day.`,
      }],
    });

    const outlook = (aiMessage.content[0] as { text: string }).text;

    const topGainers = stocks.filter((s) => s.change_percent > 0).sort((a, b) => b.change_percent - a.change_percent).slice(0, 5);
    const topLosers  = stocks.filter((s) => s.change_percent < 0).sort((a, b) => a.change_percent - b.change_percent).slice(0, 5);

    const today = new Date().toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric", weekday: "long",
      timeZone: "Asia/Seoul",
    });

    const kospiDir = kospi.is_up ? "▲" : "▼";
    const kospiColor = kospi.is_up ? "#22c55e" : "#ef4444";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">

    <!-- Header -->
    <div style="margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">📈 StockFix</span>
        <span style="font-size:11px;color:#6b7280;background:#1f2937;padding:3px 8px;border-radius:20px;border:1px solid #374151;">Morning Briefing</span>
      </div>
      <p style="margin:0;font-size:13px;color:#6b7280;">${today} · 한국 주식시장 오전 브리핑</p>
    </div>

    <!-- KOSPI Card -->
    <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">KOSPI Index</p>
      <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;">
        <span style="font-size:32px;font-weight:700;color:#ffffff;">${kospi.value.toLocaleString("ko-KR")}</span>
        <span style="font-size:16px;font-weight:600;color:${kospiColor};">
          ${kospiDir} ${Math.abs(kospi.change).toLocaleString("ko-KR")} (${kospi.change_percent >= 0 ? "+" : ""}${kospi.change_percent.toFixed(2)}%)
        </span>
      </div>
    </div>

    <!-- Movers Grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <!-- Gainers -->
      <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:16px;">
        <p style="margin:0 0 10px;font-size:11px;color:#22c55e;text-transform:uppercase;letter-spacing:0.08em;">▲ Top Gainers</p>
        ${topGainers.map((s) => `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:12px;color:#d1d5db;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px;">${s.name}</span>
          <span style="font-size:12px;color:#22c55e;font-weight:600;white-space:nowrap;">+${s.change_percent.toFixed(2)}%</span>
        </div>`).join("")}
      </div>
      <!-- Losers -->
      <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:16px;">
        <p style="margin:0 0 10px;font-size:11px;color:#ef4444;text-transform:uppercase;letter-spacing:0.08em;">▼ Top Losers</p>
        ${topLosers.map((s) => `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:12px;color:#d1d5db;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px;">${s.name}</span>
          <span style="font-size:12px;color:#ef4444;font-weight:600;white-space:nowrap;">${s.change_percent.toFixed(2)}%</span>
        </div>`).join("")}
      </div>
    </div>

    <!-- AI Outlook -->
    <div style="background:#0f172a;border:1px solid #1e3a5f;border-radius:16px;padding:20px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <span style="font-size:14px;">✦</span>
        <span style="font-size:11px;color:#60a5fa;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">AI Market Outlook</span>
      </div>
      <div style="font-size:13px;color:#94a3b8;line-height:1.75;">
        ${outlook.split("\n\n").map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, "<br/>")}</p>`).join("")}
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="https://stock-fix-alpha.vercel.app/dashboard"
         style="display:inline-block;background:#3b82f6;color:#ffffff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:12px;text-decoration:none;">
        Open Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1f2937;padding-top:16px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#374151;">
        StockFix · Sent at 7:15am KST · For informational purposes only, not financial advice
      </p>
    </div>

  </div>
</body>
</html>`;

    await resend.emails.send({
      from: "StockFix <onboarding@resend.dev>",
      to: process.env.BRIEFING_EMAIL!,
      subject: `📈 StockFix Morning Briefing — ${today}`,
      html,
    });

    return NextResponse.json({ ok: true, kospi: kospi.value });
  } catch (err) {
    console.error("Morning briefing error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

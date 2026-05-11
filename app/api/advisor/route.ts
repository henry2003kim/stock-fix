import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { fetchStockData } from "@/lib/stockData";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

const STRATEGY_LABELS: Record<number, string> = {
  1: "매우 보수적 (Very Conservative)",
  2: "보수적 (Conservative)",
  3: "균형 (Balanced)",
  4: "공격적 (Aggressive)",
  5: "매우 공격적 (Very Aggressive)",
};

const STRATEGY_DESC: Record<number, string> = {
  1: "원금 보존 최우선. 배당주·우량주 위주, 분산투자, 손절 타이트.",
  2: "안정 우선, 소폭 수익 추구. 대형주 중심, 헤지 비중 높게.",
  3: "수익과 리스크 균형. 성장주+배당주 혼합, 표준 손절.",
  4: "수익 극대화 지향. 모멘텀·성장주 중심, 일부 레버리지 가능.",
  5: "고수익·고위험 추구. 테마·소형주 포함, 공격적 포지션 허용.",
};

const STOP_LOSS_RANGE: Record<number, string> = {
  1: "3-5%", 2: "4-6%", 3: "5-8%", 4: "8-12%", 5: "10-15%",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { budget, pinned_tickers = [], aggressiveness = 3, transactions = [] } = body;
  const level = Math.max(1, Math.min(5, aggressiveness));

  const pinnedStocks = (
    await Promise.all((pinned_tickers as string[]).map((t: string) => fetchStockData(t)))
  ).filter(Boolean);

  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const strategy = STRATEGY_LABELS[level];
  const stratDesc = STRATEGY_DESC[level];

  const stocksInfo = pinnedStocks.length
    ? pinnedStocks
        .map((s) => `- ${s!.name_en} (${s!.ticker}): ₩${s!.price.toLocaleString()} ${s!.is_up ? "▲" : "▼"}${Math.abs(s!.change_percent).toFixed(2)}%`)
        .join("\n")
    : "핀된 종목 없음 (상위 KOSPI 종목 기준 제안)";

  const txnInfo = (transactions as { ticker: string; quantity: number; price: number }[])
    .slice(0, 10)
    .map((t) => `- ${t.ticker}: ${t.quantity}주 @ ₩${t.price.toLocaleString()}`)
    .join("\n") || "없음";

  const prompt = `당신은 한국 주식 시장 전문 투자 어드바이저입니다. 아래 정보를 바탕으로 구체적이고 실행 가능한 투자 제안서를 JSON 형식으로 작성해 주세요. JSON 외에 다른 텍스트는 포함하지 마세요.

날짜: ${now}
투자 가능 금액: ₩${Number(budget).toLocaleString()}
투자 전략: ${strategy} — ${stratDesc}

관심 종목:
${stocksInfo}

기존 거래:
${txnInfo}

다음 JSON 형식으로 반환:
{
  "summary": "시장 현황 및 전략 요약 (2-3문장)",
  "recommendations": [
    {
      "ticker": "종목코드",
      "name": "종목명",
      "action": "BUY or HOLD or SELL",
      "quantity": 수량(정수),
      "entry_price": 매수목표가(원화),
      "target_price": 목표주가(원화),
      "stop_loss": 손절가(원화),
      "allocation_percent": 비중(0-100정수),
      "rationale": "추천이유 (1-2문장)"
    }
  ],
  "hedge_notes": "헤지 전략 (1-2문장)",
  "market_outlook": "시장 전망 (1-2문장)",
  "total_invested": 총투자금액(숫자),
  "cash_reserve": 현금보유비중(0-100정수)
}

지침: 수량×entry_price 합계가 budget 초과 금지. ${strategy} 수준 유지. 최소 2개 최대 5개 종목. 손절가는 입력가 대비 ${STOP_LOSS_RANGE[level]} 범위.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    let raw = (message.content[0] as { text: string }).text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const proposal = JSON.parse(raw);
    return NextResponse.json({
      ...proposal,
      generated_at: new Date().toISOString(),
      strategy_level: level,
      strategy_label: strategy,
    });
  } catch (err) {
    return NextResponse.json({
      summary: `제안서 생성 중 오류: ${err instanceof Error ? err.message : String(err)}`,
      recommendations: [],
      hedge_notes: "",
      market_outlook: "",
      total_invested: 0,
      cash_reserve: 100,
      generated_at: new Date().toISOString(),
      strategy_level: level,
      strategy_label: strategy,
      error: true,
    });
  }
}

from __future__ import annotations
import anthropic
import json
import os
from datetime import datetime
from typing import Optional

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

STRATEGY_LABELS = {
    1: "매우 보수적 (Very Conservative)",
    2: "보수적 (Conservative)",
    3: "균형 (Balanced)",
    4: "공격적 (Aggressive)",
    5: "매우 공격적 (Very Aggressive)",
}

STRATEGY_DESCRIPTIONS = {
    1: "원금 보존 최우선. 배당주·우량주 위주, 분산투자, 손절 타이트하게.",
    2: "안정 우선, 소폭 수익 추구. 대형주 중심, 헤지 비중 높게.",
    3: "수익과 리스크 균형. 성장주+배당주 혼합, 표준 손절.",
    4: "수익 극대화 지향. 모멘텀·성장주 중심, 일부 레버리지 가능.",
    5: "고수익·고위험 추구. 테마·소형주 포함, 공격적 포지션 허용.",
}


def generate_investment_proposal(
    budget: float,
    pinned_stocks: list[dict],
    aggressiveness: int,
    transactions: Optional[list] = None,
) -> dict:
    now = datetime.now().strftime("%Y년 %m월 %d일 %H:%M")
    strategy = STRATEGY_LABELS.get(aggressiveness, "균형")
    strategy_desc = STRATEGY_DESCRIPTIONS.get(aggressiveness, "")

    stocks_info = ""
    for s in pinned_stocks:
        direction = "▲" if s.get("is_up") else "▼"
        stocks_info += (
            f"- {s.get('name_en', s.get('name', ''))} ({s.get('ticker', '')}): "
            f"₩{s.get('price', 0):,.0f} {direction}{abs(s.get('change_percent', 0)):.2f}%\n"
        )
    if not stocks_info:
        stocks_info = "핀된 종목 없음 (상위 KOSPI 종목 기준으로 제안)\n"

    txn_info = ""
    if transactions:
        for t in transactions[:10]:
            txn_info += f"- {t.get('ticker')}: {t.get('quantity')}주 @ ₩{t.get('price'):,.0f}\n"

    prompt = f"""당신은 한국 주식 시장 전문 투자 어드바이저입니다. 아래 정보를 바탕으로 구체적이고 실행 가능한 투자 제안서를 작성해 주세요.

**날짜**: {now}
**투자 가능 금액**: ₩{budget:,.0f}
**투자 전략 수준**: {strategy} — {strategy_desc}

**관심 종목 (현재가)**:
{stocks_info}

**기존 거래 내역** (있는 경우):
{txn_info if txn_info else "없음"}

---

다음 형식으로 JSON을 반환해 주세요. JSON 외에 다른 텍스트는 포함하지 마세요:

{{
  "summary": "시장 현황 및 전략 요약 (2-3문장)",
  "recommendations": [
    {{
      "ticker": "종목 코드 (예: 005930)",
      "name": "종목명",
      "action": "BUY 또는 HOLD 또는 SELL",
      "quantity": 매수 수량 (정수),
      "entry_price": 매수 목표가 (원화),
      "target_price": 목표 주가 (원화),
      "stop_loss": 손절가 (원화),
      "allocation_percent": 투자 금액 중 비중 (0-100 정수),
      "rationale": "이 종목을 추천하는 이유 (1-2문장)"
    }}
  ],
  "hedge_notes": "헤지 전략 및 리스크 관리 방안 (1-2문장)",
  "market_outlook": "향후 시장 전망 (1-2문장)",
  "total_invested": 총 투자 금액 (원화, 숫자만),
  "cash_reserve": 현금 보유 비중 (0-100 정수)
}}

핵심 지침:
- 종목별 수량은 entry_price × quantity 합계가 budget을 초과하지 않도록
- {strategy} 전략에 맞는 종목 선정 및 리스크 수준 유지
- 최소 2개, 최대 5개 종목 추천
- 손절가는 입력가 대비 {'3-5%' if aggressiveness <= 2 else '5-8%' if aggressiveness == 3 else '8-12%'} 범위
"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        proposal = json.loads(raw)
        proposal["generated_at"] = datetime.now().isoformat()
        proposal["strategy_level"] = aggressiveness
        proposal["strategy_label"] = strategy
        return proposal
    except Exception as e:
        return {
            "summary": f"제안서 생성 중 오류가 발생했습니다: {str(e)}",
            "recommendations": [],
            "hedge_notes": "",
            "market_outlook": "",
            "total_invested": 0,
            "cash_reserve": 100,
            "generated_at": datetime.now().isoformat(),
            "strategy_level": aggressiveness,
            "strategy_label": strategy,
            "error": str(e),
        }

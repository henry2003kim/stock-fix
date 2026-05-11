"""
Korean stock data via Naver Finance APIs (confirmed working):
 - Realtime: polling.finance.naver.com
 - Chart history: fchart.stock.naver.com
 - Summary: api.finance.naver.com
"""
from __future__ import annotations
import re
import requests
from typing import Optional
import time
import threading

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://finance.naver.com/",
    "Accept": "application/json, text/plain, */*",
}

TOP_KOSPI_STOCKS = [
    {"name": "삼성전자", "name_en": "Samsung Electronics", "ticker": "005930"},
    {"name": "SK하이닉스", "name_en": "SK Hynix", "ticker": "000660"},
    {"name": "LG에너지솔루션", "name_en": "LG Energy Solution", "ticker": "373220"},
    {"name": "삼성바이오로직스", "name_en": "Samsung Biologics", "ticker": "207940"},
    {"name": "현대차", "name_en": "Hyundai Motor", "ticker": "005380"},
    {"name": "POSCO홀딩스", "name_en": "POSCO Holdings", "ticker": "005490"},
    {"name": "삼성SDI", "name_en": "Samsung SDI", "ticker": "006400"},
    {"name": "카카오", "name_en": "Kakao", "ticker": "035720"},
    {"name": "NAVER", "name_en": "NAVER Corp", "ticker": "035420"},
    {"name": "기아", "name_en": "Kia", "ticker": "000270"},
    {"name": "셀트리온", "name_en": "Celltrion", "ticker": "068270"},
    {"name": "KB금융", "name_en": "KB Financial", "ticker": "105560"},
    {"name": "신한지주", "name_en": "Shinhan Financial", "ticker": "055550"},
    {"name": "LG화학", "name_en": "LG Chem", "ticker": "051910"},
    {"name": "SK텔레콤", "name_en": "SK Telecom", "ticker": "017670"},
    {"name": "현대모비스", "name_en": "Hyundai Mobis", "ticker": "012330"},
    {"name": "LG전자", "name_en": "LG Electronics", "ticker": "066570"},
    {"name": "삼성물산", "name_en": "Samsung C&T", "ticker": "028260"},
    {"name": "두산에너빌리티", "name_en": "Doosan Enerbility", "ticker": "034020"},
    {"name": "하이브", "name_en": "HYBE", "ticker": "352820"},
]

STOCK_FACTORS = {
    "005930": {
        "factors": ["글로벌 반도체 수요 (AI·HPC)", "HBM 메모리 수주", "DRAM·NAND 가격", "원·달러 환율"],
        "related": ["000660", "TSMC", "MU", "NVDA"],
        "related_names": ["SK하이닉스", "TSMC", "Micron", "NVIDIA"],
        "sector": "반도체",
    },
    "000660": {
        "factors": ["AI 서버용 HBM 수요", "DDR5 채택률", "파운드리 경쟁", "엔비디아 공급"],
        "related": ["005930", "TSMC", "MU", "NVDA"],
        "related_names": ["삼성전자", "TSMC", "Micron", "NVIDIA"],
        "sector": "반도체",
    },
    "373220": {
        "factors": ["글로벌 EV 판매량", "배터리 원자재 가격", "유럽 EV 정책", "완성차 파트너 실적"],
        "related": ["006400", "051910", "TSLA", "BYD"],
        "related_names": ["삼성SDI", "LG화학", "Tesla", "BYD"],
        "sector": "배터리·소재",
    },
    "207940": {
        "factors": ["바이오시밀러 FDA 허가", "CMO 수주 확대", "원·달러 환율", "미국 약가 정책"],
        "related": ["068270", "PFE", "SNY"],
        "related_names": ["셀트리온", "Pfizer", "Sanofi"],
        "sector": "바이오·제약",
    },
    "005380": {
        "factors": ["글로벌 완성차 판매", "EV 전환 전략", "원·달러 환율", "미국 시장 점유율"],
        "related": ["000270", "012330", "TSLA", "TM"],
        "related_names": ["기아", "현대모비스", "Tesla", "Toyota"],
        "sector": "자동차",
    },
    "005490": {
        "factors": ["철강 수요 (건설·자동차)", "중국 철강 생산량", "원자재 가격", "친환경 철강"],
        "related": ["VALE", "BHP", "STLD"],
        "related_names": ["Vale", "BHP", "Steel Dynamics"],
        "sector": "철강·소재",
    },
    "006400": {
        "factors": ["EV 배터리 점유율", "원자재 가격", "전고체 배터리 개발", "ESS 수요"],
        "related": ["373220", "051910", "TSLA"],
        "related_names": ["LG에너지솔루션", "LG화학", "Tesla"],
        "sector": "배터리",
    },
    "035720": {
        "factors": ["카카오페이·뱅크 실적", "웹툰·게임 확장", "AI 서비스", "규제 리스크"],
        "related": ["035420", "BIDU", "META"],
        "related_names": ["NAVER", "Baidu", "Meta"],
        "sector": "IT·플랫폼",
    },
    "035420": {
        "factors": ["검색 광고 매출", "클라우드·AI 사업", "웹툰 해외 진출", "쇼핑·핀테크"],
        "related": ["035720", "GOOGL", "META"],
        "related_names": ["카카오", "Alphabet", "Meta"],
        "sector": "IT·플랫폼",
    },
    "000270": {
        "factors": ["글로벌 완성차 판매", "EV 신모델 출시", "원·달러 환율", "미국 시장"],
        "related": ["005380", "012330", "TSLA", "TM"],
        "related_names": ["현대차", "현대모비스", "Tesla", "Toyota"],
        "sector": "자동차",
    },
    "068270": {
        "factors": ["바이오시밀러 허가", "램시마·트룩시마 판매", "원·달러 환율", "약가 정책"],
        "related": ["207940", "AMGN", "BIIB"],
        "related_names": ["삼성바이오로직스", "Amgen", "Biogen"],
        "sector": "바이오·제약",
    },
    "105560": {
        "factors": ["기준금리 방향", "가계대출 규제", "순이자마진(NIM)", "경기 침체 리스크"],
        "related": ["055550", "JPM", "WFC"],
        "related_names": ["신한지주", "JPMorgan", "Wells Fargo"],
        "sector": "금융·은행",
    },
    "055550": {
        "factors": ["기준금리 방향", "부동산 대출 규제", "순이자마진(NIM)", "해외 사업"],
        "related": ["105560", "JPM", "C"],
        "related_names": ["KB금융", "JPMorgan", "Citigroup"],
        "sector": "금융·은행",
    },
    "051910": {
        "factors": ["배터리 소재 사업", "석유화학 스프레드", "양극재 수주", "원자재 가격"],
        "related": ["006400", "373220", "DOW"],
        "related_names": ["삼성SDI", "LG에너지솔루션", "Dow"],
        "sector": "화학·소재",
    },
    "017670": {
        "factors": ["5G 가입자 수", "B2B·데이터센터", "요금제 경쟁", "AI 서비스"],
        "related": ["030200", "T", "VZ"],
        "related_names": ["KT", "AT&T", "Verizon"],
        "sector": "통신",
    },
}

DEFAULT_FACTORS = {
    "factors": ["국내 경기 지표", "업종별 산업 동향", "원·달러 환율", "글로벌 증시"],
    "related": ["KOSPI", "NASDAQ", "S&P500"],
    "related_names": ["코스피", "나스닥", "S&P500"],
    "sector": "기타",
}

# Timeframe → (naver_timeframe, count)
PERIOD_INTERVAL_MAP = {
    "1h":  ("day",   5),
    "1d":  ("day",   30),
    "1w":  ("day",   60),
    "1m":  ("day",   60),
    "3m":  ("day",   90),
    "1y":  ("week",  52),
    "5y":  ("month", 60),
}

_cache: dict = {}
_cache_lock = threading.Lock()


def _get_cached(key: str, ttl: int):
    with _cache_lock:
        if key in _cache:
            val, ts = _cache[key]
            if time.time() - ts < ttl:
                return val
    return None


def _set_cached(key: str, val):
    with _cache_lock:
        _cache[key] = (val, time.time())


def _clean_number(s) -> float:
    if s is None:
        return 0.0
    return float(str(s).replace(",", "").replace("+", "").strip() or 0)


def fetch_kospi_index() -> dict:
    cached = _get_cached("kospi", 120)
    if cached:
        return cached
    try:
        resp = requests.get(
            "https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI",
            headers=HEADERS,
            timeout=8,
        )
        resp.raise_for_status()
        datas = resp.json().get("datas", [])
        if datas:
            dd = datas[0]
            value = _clean_number(dd.get("closePrice"))
            change_str = str(dd.get("compareToPreviousClosePrice", "0"))
            change = _clean_number(change_str)
            change_pct = _clean_number(dd.get("fluctuationsRatio", "0"))
            is_up = not change_str.strip().startswith("-")
            if not is_up and change > 0:
                change = -change
            result = {
                "value": value,
                "change": change,
                "change_percent": change_pct if is_up else -abs(change_pct),
                "is_up": is_up,
            }
            _set_cached("kospi", result)
            return result
    except Exception as e:
        pass
    return {"value": 0, "change": 0, "change_percent": 0, "is_up": True}


def fetch_stock_data(ticker: str) -> Optional[dict]:
    cache_key = f"stock_{ticker}"
    cached = _get_cached(cache_key, 120)
    if cached:
        return cached

    meta = next((s for s in TOP_KOSPI_STOCKS if s["ticker"] == ticker), {
        "name": ticker, "name_en": ticker, "ticker": ticker,
    })

    try:
        # Real-time price from polling API
        resp = requests.get(
            f"https://polling.finance.naver.com/api/realtime/domestic/stock/{ticker}",
            headers=HEADERS,
            timeout=8,
        )
        resp.raise_for_status()
        datas = resp.json().get("datas", [])
        if datas:
            dd = datas[0]
            price_str = str(dd.get("closePrice", "0")).replace(",", "")
            price = float(price_str or 0)
            if price > 0:
                change_str = str(dd.get("compareToPreviousClosePrice", "0")).replace(",", "")
                change = float(change_str or 0)
                change_pct_str = str(dd.get("fluctuationsRatio", "0")).replace(",", "")
                change_pct = float(change_pct_str or 0)
                is_up = change >= 0
                vol_str = str(dd.get("accumulatedTradingVolume", "0")).replace(",", "")
                volume = int(vol_str or 0)

                result = {
                    **meta,
                    "price": price,
                    "change": change,
                    "change_percent": change_pct,
                    "is_up": is_up,
                    "volume": volume,
                }
                # Enrich with summary (per, pbr, etc.)
                try:
                    sr = requests.get(
                        f"https://api.finance.naver.com/service/itemSummary.nhn?itemcode={ticker}",
                        headers=HEADERS, timeout=5,
                    )
                    if sr.status_code == 200:
                        sd = sr.json()
                        result["per"] = sd.get("per")
                        result["pbr"] = sd.get("pbr")
                        result["eps"] = sd.get("eps")
                        result["week_52_high"] = sd.get("high")
                        result["week_52_low"] = sd.get("low")
                except Exception:
                    pass
                _set_cached(cache_key, result)
                return result
    except Exception:
        pass
    return None


def fetch_top_stocks(limit: int = 20) -> list:
    cached = _get_cached("top_stocks", 180)
    if cached:
        return cached[:limit]

    results = []
    for stock_meta in TOP_KOSPI_STOCKS:
        data = fetch_stock_data(stock_meta["ticker"])
        if data:
            results.append(data)

    results.sort(key=lambda x: abs(x.get("change_percent", 0)), reverse=True)
    _set_cached("top_stocks", results)
    return results[:limit]


def _parse_naver_chart(raw_text: str) -> list:
    """Parse Naver Finance siseJson.nhn response into list of dicts."""
    rows = []
    # Find all date-price data rows: ["YYYYMMDD", open, high, low, close, vol, ...]
    pattern = r'\["(\d{8})",\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)'
    for m in re.finditer(pattern, raw_text):
        date_str = m.group(1)
        close = float(m.group(5))
        volume = int(float(m.group(6)))
        year, month, day = date_str[:4], date_str[4:6], date_str[6:8]
        rows.append({
            "time": f"{year}-{month}-{day}T09:00:00",
            "price": close,
            "volume": volume,
        })
    return rows


def fetch_stock_history(ticker: str, period: str = "day", count: int = 30) -> list:
    cache_key = f"hist_{ticker}_{period}_{count}"
    ttl = 120 if period == "day" else 600
    cached = _get_cached(cache_key, ttl)
    if cached:
        return cached

    try:
        url = (
            f"https://fchart.stock.naver.com/siseJson.nhn"
            f"?symbol={ticker}&requestType=0&count={count}&timeframe={period}"
        )
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        result = _parse_naver_chart(resp.text)
        if result:
            _set_cached(cache_key, result)
            return result
    except Exception:
        pass
    return []


def get_stock_factors(ticker: str) -> dict:
    return STOCK_FACTORS.get(ticker, DEFAULT_FACTORS)

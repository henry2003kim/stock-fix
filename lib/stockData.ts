/**
 * Naver Finance data fetching — used by Next.js API routes (server-side).
 * Confirmed working APIs as of 2026-05.
 */

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://finance.naver.com/",
  Accept: "application/json, text/plain, */*",
};

export const TOP_KOSPI_STOCKS = [
  { name: "삼성전자", name_en: "Samsung Electronics", ticker: "005930" },
  { name: "SK하이닉스", name_en: "SK Hynix", ticker: "000660" },
  { name: "LG에너지솔루션", name_en: "LG Energy Solution", ticker: "373220" },
  { name: "삼성바이오로직스", name_en: "Samsung Biologics", ticker: "207940" },
  { name: "현대차", name_en: "Hyundai Motor", ticker: "005380" },
  { name: "POSCO홀딩스", name_en: "POSCO Holdings", ticker: "005490" },
  { name: "삼성SDI", name_en: "Samsung SDI", ticker: "006400" },
  { name: "카카오", name_en: "Kakao", ticker: "035720" },
  { name: "NAVER", name_en: "NAVER Corp", ticker: "035420" },
  { name: "기아", name_en: "Kia", ticker: "000270" },
  { name: "셀트리온", name_en: "Celltrion", ticker: "068270" },
  { name: "KB금융", name_en: "KB Financial", ticker: "105560" },
  { name: "신한지주", name_en: "Shinhan Financial", ticker: "055550" },
  { name: "LG화학", name_en: "LG Chem", ticker: "051910" },
  { name: "SK텔레콤", name_en: "SK Telecom", ticker: "017670" },
  { name: "현대모비스", name_en: "Hyundai Mobis", ticker: "012330" },
  { name: "LG전자", name_en: "LG Electronics", ticker: "066570" },
  { name: "삼성물산", name_en: "Samsung C&T", ticker: "028260" },
  { name: "두산에너빌리티", name_en: "Doosan Enerbility", ticker: "034020" },
  { name: "하이브", name_en: "HYBE", ticker: "352820" },
];

export const STOCK_FACTORS: Record<string, { factors: string[]; related: string[]; related_names: string[]; sector: string }> = {
  "005930": { factors: ["글로벌 반도체 수요 (AI·HPC)", "HBM 메모리 수주", "DRAM·NAND 가격", "원·달러 환율"], related: ["000660", "TSMC", "MU", "NVDA"], related_names: ["SK하이닉스", "TSMC", "Micron", "NVIDIA"], sector: "반도체" },
  "000660": { factors: ["AI 서버용 HBM 수요", "DDR5 채택률", "파운드리 경쟁", "엔비디아 공급"], related: ["005930", "TSMC", "MU", "NVDA"], related_names: ["삼성전자", "TSMC", "Micron", "NVIDIA"], sector: "반도체" },
  "373220": { factors: ["글로벌 EV 판매량", "배터리 원자재 가격", "유럽 EV 정책", "완성차 파트너 실적"], related: ["006400", "051910", "TSLA", "BYD"], related_names: ["삼성SDI", "LG화학", "Tesla", "BYD"], sector: "배터리·소재" },
  "207940": { factors: ["바이오시밀러 FDA 허가", "CMO 수주", "원·달러 환율", "미국 약가 정책"], related: ["068270", "PFE", "SNY"], related_names: ["셀트리온", "Pfizer", "Sanofi"], sector: "바이오·제약" },
  "005380": { factors: ["글로벌 완성차 판매", "EV 전환 전략", "원·달러 환율", "미국 시장 점유율"], related: ["000270", "012330", "TSLA", "TM"], related_names: ["기아", "현대모비스", "Tesla", "Toyota"], sector: "자동차" },
  "005490": { factors: ["철강 수요", "중국 철강 생산량", "원자재 가격", "친환경 철강"], related: ["VALE", "BHP", "STLD"], related_names: ["Vale", "BHP", "Steel Dynamics"], sector: "철강·소재" },
  "006400": { factors: ["EV 배터리 점유율", "원자재 가격", "전고체 배터리", "ESS 수요"], related: ["373220", "051910", "TSLA"], related_names: ["LG에너지솔루션", "LG화학", "Tesla"], sector: "배터리" },
  "035720": { factors: ["카카오페이·뱅크 실적", "웹툰·게임 확장", "AI 서비스", "규제 리스크"], related: ["035420", "BIDU", "META"], related_names: ["NAVER", "Baidu", "Meta"], sector: "IT·플랫폼" },
  "035420": { factors: ["검색 광고 매출", "클라우드·AI 사업", "웹툰 해외 진출", "쇼핑·핀테크"], related: ["035720", "GOOGL", "META"], related_names: ["카카오", "Alphabet", "Meta"], sector: "IT·플랫폼" },
  "000270": { factors: ["글로벌 완성차 판매", "EV 신모델", "원·달러 환율", "미국 시장"], related: ["005380", "012330", "TSLA", "TM"], related_names: ["현대차", "현대모비스", "Tesla", "Toyota"], sector: "자동차" },
  "068270": { factors: ["바이오시밀러 허가", "램시마·트룩시마 판매", "원·달러 환율", "약가 정책"], related: ["207940", "AMGN", "BIIB"], related_names: ["삼성바이오로직스", "Amgen", "Biogen"], sector: "바이오·제약" },
  "105560": { factors: ["기준금리 방향", "가계대출 규제", "순이자마진(NIM)", "경기 침체 리스크"], related: ["055550", "JPM", "WFC"], related_names: ["신한지주", "JPMorgan", "Wells Fargo"], sector: "금융·은행" },
  "055550": { factors: ["기준금리 방향", "부동산 대출", "순이자마진(NIM)", "해외 사업"], related: ["105560", "JPM", "C"], related_names: ["KB금융", "JPMorgan", "Citigroup"], sector: "금융·은행" },
  "051910": { factors: ["배터리 소재 사업", "석유화학 스프레드", "양극재 수주", "원자재 가격"], related: ["006400", "373220", "DOW"], related_names: ["삼성SDI", "LG에너지솔루션", "Dow"], sector: "화학·소재" },
  "017670": { factors: ["5G 가입자 수", "B2B·데이터센터", "요금제 경쟁", "AI 서비스"], related: ["030200", "T", "VZ"], related_names: ["KT", "AT&T", "Verizon"], sector: "통신" },
};

export const DIVIDEND_DATA: Record<string, { yield_pct: number; pay_months: number[] }> = {
  "005930": { yield_pct: 2.2, pay_months: [4] },
  "000660": { yield_pct: 0.5, pay_months: [4] },
  "373220": { yield_pct: 0.0, pay_months: [] },
  "207940": { yield_pct: 0.0, pay_months: [] },
  "005380": { yield_pct: 3.0, pay_months: [4] },
  "005490": { yield_pct: 3.5, pay_months: [4] },
  "006400": { yield_pct: 0.4, pay_months: [4] },
  "035720": { yield_pct: 0.2, pay_months: [4] },
  "035420": { yield_pct: 0.3, pay_months: [4] },
  "000270": { yield_pct: 4.0, pay_months: [4] },
  "068270": { yield_pct: 0.2, pay_months: [4] },
  "105560": { yield_pct: 5.5, pay_months: [2, 5, 8, 11] },
  "055550": { yield_pct: 5.5, pay_months: [2, 5, 8, 11] },
  "051910": { yield_pct: 1.5, pay_months: [4] },
  "017670": { yield_pct: 6.5, pay_months: [2, 5, 8, 11] },
  "012330": { yield_pct: 2.5, pay_months: [4] },
  "066570": { yield_pct: 1.8, pay_months: [4] },
  "028260": { yield_pct: 1.5, pay_months: [4] },
  "034020": { yield_pct: 0.5, pay_months: [4] },
  "352820": { yield_pct: 0.0, pay_months: [] },
};

export const DEFAULT_FACTORS = {
  factors: ["국내 경기 지표", "업종별 산업 동향", "원·달러 환율", "글로벌 증시"],
  related: ["KOSPI", "NASDAQ", "S&P500"],
  related_names: ["코스피", "나스닥", "S&P500"],
  sector: "기타",
};

export const PERIOD_INTERVAL_MAP: Record<string, [string, number]> = {
  "1h":  ["day",   5],
  "1d":  ["day",   30],
  "1w":  ["day",   60],
  "1m":  ["day",   60],
  "3m":  ["day",   90],
  "1y":  ["week",  52],
  "5y":  ["month", 60],
};

function cleanNumber(s: unknown): number {
  if (s == null) return 0;
  return parseFloat(String(s).replace(/,/g, "").replace(/\+/g, "").trim()) || 0;
}

export async function fetchKospiIndex() {
  const res = await fetch(
    "https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI",
    { headers: HEADERS, next: { revalidate: 60 } }
  );
  if (!res.ok) return { value: 0, change: 0, change_percent: 0, is_up: true };
  const json = await res.json();
  const dd = json?.datas?.[0];
  if (!dd) return { value: 0, change: 0, change_percent: 0, is_up: true };
  const changeStr = String(dd.compareToPreviousClosePrice ?? "0");
  const change = cleanNumber(changeStr);
  const isUp = !changeStr.trim().startsWith("-");
  return {
    value: cleanNumber(dd.closePrice),
    change: isUp ? Math.abs(change) : -Math.abs(change),
    change_percent: cleanNumber(dd.fluctuationsRatio) * (isUp ? 1 : -1),
    is_up: isUp,
  };
}

export async function fetchStockData(ticker: string) {
  const meta = TOP_KOSPI_STOCKS.find((s) => s.ticker === ticker) ?? {
    name: ticker, name_en: ticker, ticker,
  };

  const [priceRes, summaryRes] = await Promise.allSettled([
    fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${ticker}`, { headers: HEADERS, next: { revalidate: 60 } }),
    fetch(`https://api.finance.naver.com/service/itemSummary.nhn?itemcode=${ticker}`, { headers: HEADERS, next: { revalidate: 120 } }),
  ]);

  let price = 0, change = 0, changePct = 0, isUp = true, volume = 0;

  if (priceRes.status === "fulfilled" && priceRes.value.ok) {
    const json = await priceRes.value.json();
    const dd = json?.datas?.[0];
    if (dd) {
      price = cleanNumber(dd.closePrice);
      const changeStr = String(dd.compareToPreviousClosePrice ?? "0");
      change = cleanNumber(changeStr);
      isUp = !changeStr.trim().startsWith("-");
      if (!isUp) change = -Math.abs(change);
      changePct = cleanNumber(dd.fluctuationsRatio) * (isUp ? 1 : -1);
      volume = cleanNumber(dd.accumulatedTradingVolume);
    }
  }

  let per: number | null = null, pbr: number | null = null;
  if (summaryRes.status === "fulfilled" && summaryRes.value.ok) {
    const sd = await summaryRes.value.json();
    per = sd.per ?? null;
    pbr = sd.pbr ?? null;
  }

  if (price === 0) return null;

  return { ...meta, price, change, change_percent: changePct, is_up: isUp, volume, per, pbr };
}

export async function fetchTopStocks(limit = 20) {
  const results = await Promise.all(TOP_KOSPI_STOCKS.slice(0, limit).map((s) => fetchStockData(s.ticker)));
  const valid = results.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof fetchStockData>>>[];
  return valid.sort((a, b) => Math.abs(b.change_percent) - Math.abs(a.change_percent));
}

export function parseNaverChart(rawText: string) {
  const rows: { time: string; price: number; volume: number }[] = [];
  const pattern = /\["(\d{8})",\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(rawText)) !== null) {
    const d = m[1];
    rows.push({
      time: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T09:00:00`,
      price: parseFloat(m[5]),
      volume: parseInt(m[6]),
    });
  }
  return rows;
}

export async function fetchStockHistory(ticker: string, period: string, count: number) {
  const url = `https://fchart.stock.naver.com/siseJson.nhn?symbol=${ticker}&requestType=0&count=${count}&timeframe=${period}`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 120 } });
  if (!res.ok) return [];
  const text = await res.text();
  return parseNaverChart(text);
}

export function getStockFactors(ticker: string) {
  return STOCK_FACTORS[ticker] ?? DEFAULT_FACTORS;
}

import { NextRequest, NextResponse } from "next/server";
import { TOP_KOSPI_STOCKS, fetchStockData } from "@/lib/stockData";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  const lower = q.toLowerCase();

  const fromList = TOP_KOSPI_STOCKS.filter(
    (s) =>
      s.ticker.includes(q) ||
      s.name.toLowerCase().includes(lower) ||
      s.name_en.toLowerCase().includes(lower)
  ).slice(0, 8);

  // If query is exactly a 6-digit ticker not already in results, try fetching it live
  const isUnknownTicker = /^\d{6}$/.test(q) && !fromList.some((s) => s.ticker === q);
  if (isUnknownTicker) {
    const live = await fetchStockData(q);
    if (live) {
      return NextResponse.json([live, ...fromList].slice(0, 8));
    }
  }

  return NextResponse.json(fromList);
}

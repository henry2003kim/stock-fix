import { NextRequest, NextResponse } from "next/server";
import { fetchStockData } from "@/lib/stockData";

export async function GET(req: NextRequest) {
  const tickers = (req.nextUrl.searchParams.get("tickers") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tickers.length === 0) return NextResponse.json({});

  const results = await Promise.allSettled(tickers.map((t) => fetchStockData(t)));

  const prices: Record<string, number> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) {
      prices[tickers[i]] = r.value.price;
    }
  });

  return NextResponse.json(prices);
}

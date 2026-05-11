import { NextRequest, NextResponse } from "next/server";
import { fetchStockHistory, PERIOD_INTERVAL_MAP } from "@/lib/stockData";

export async function GET(req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const timeframe = req.nextUrl.searchParams.get("timeframe") ?? "1d";
  const [period, count] = PERIOD_INTERVAL_MAP[timeframe] ?? ["day", 30];
  const history = await fetchStockHistory(ticker, period, count);
  if (!history.length) return NextResponse.json({ error: "No data" }, { status: 404 });
  return NextResponse.json(history);
}

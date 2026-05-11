import { NextRequest, NextResponse } from "next/server";
import { fetchStockData, getStockFactors } from "@/lib/stockData";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const data = await fetchStockData(ticker);
  if (!data) return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  return NextResponse.json({ ...data, ...getStockFactors(ticker) });
}

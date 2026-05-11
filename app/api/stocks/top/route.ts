import { NextRequest, NextResponse } from "next/server";
import { fetchTopStocks } from "@/lib/stockData";

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20");
  try {
    const data = await fetchTopStocks(Math.min(limit, 20));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}

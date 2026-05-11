import { NextResponse } from "next/server";
import { fetchKospiIndex } from "@/lib/stockData";

export async function GET() {
  try {
    const data = await fetchKospiIndex();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ value: 0, change: 0, change_percent: 0, is_up: true });
  }
}

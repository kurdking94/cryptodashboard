import { NextRequest, NextResponse } from "next/server";

const BASE = "https://fapi.binance.com";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const interval = req.nextUrl.searchParams.get("interval") ?? "15m";
  const limit = req.nextUrl.searchParams.get("limit") ?? "100";
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  try {
    const url = `${BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 10 } });
    if (!res.ok) return NextResponse.json({ error: "Binance error" }, { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch klines" }, { status: 500 });
  }
}

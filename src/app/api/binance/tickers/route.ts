import { NextResponse } from "next/server";

const BASE = "https://fapi.binance.com";

export async function GET() {
  try {
    const res = await fetch(`${BASE}/fapi/v1/ticker/24hr`, { next: { revalidate: 5 } });
    if (!res.ok) return NextResponse.json({ error: "Binance error" }, { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch tickers" }, { status: 500 });
  }
}

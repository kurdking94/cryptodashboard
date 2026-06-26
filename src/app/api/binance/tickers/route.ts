import { NextResponse } from "next/server";

const BASE = "https://fapi.binance.com";

export async function GET() {
  try {
    const res = await fetch(`${BASE}/fapi/v1/ticker/24hr`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: "Binance error", status: res.status }, { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch tickers", detail: String(e) }, { status: 500 });
  }
}

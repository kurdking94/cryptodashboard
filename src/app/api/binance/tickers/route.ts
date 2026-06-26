import { NextResponse } from "next/server";
import { fetchTickersMulti } from "@/lib/binance/providers";

export async function GET() {
  try {
    const { data, provider } = await fetchTickersMulti();
    return NextResponse.json({ provider, tickers: data });
  } catch (e) {
    return NextResponse.json(
      { error: "All providers failed", detail: String(e), hint: "Binance blocked on Vercel US — using Bybit fallback" },
      { status: 502 }
    );
  }
}

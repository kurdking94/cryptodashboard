import { NextRequest, NextResponse } from "next/server";
import { fetchKlinesMulti } from "@/lib/binance/providers";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const interval = req.nextUrl.searchParams.get("interval") ?? "15m";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "100");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  try {
    const { candles, provider } = await fetchKlinesMulti(symbol, interval, limit);
    return NextResponse.json({ provider, candles });
  } catch (e) {
    return NextResponse.json({ error: "Klines failed", detail: String(e) }, { status: 502 });
  }
}

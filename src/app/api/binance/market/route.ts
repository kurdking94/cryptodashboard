import { NextRequest, NextResponse } from "next/server";
import { fetchMarketMulti } from "@/lib/binance/providers";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  try {
    const data = await fetchMarketMulti(symbol);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed", detail: String(e) }, { status: 502 });
  }
}

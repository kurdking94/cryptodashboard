import { NextRequest, NextResponse } from "next/server";

const BASE = "https://fapi.binance.com";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  try {
    const [premium, oi] = await Promise.all([
      fetch(`${BASE}/fapi/v1/premiumIndex?symbol=${symbol}`, { cache: "no-store" }),
      fetch(`${BASE}/fapi/v1/openInterest?symbol=${symbol}`, { cache: "no-store" }),
    ]);

    const premiumData = premium.ok ? await premium.json() : {};
    const oiData = oi.ok ? await oi.json() : {};

    const openInterest = parseFloat(oiData.openInterest ?? "0");

    return NextResponse.json({
      fundingRate: parseFloat(premiumData.lastFundingRate ?? "0"),
      markPrice: parseFloat(premiumData.markPrice ?? "0"),
      indexPrice: parseFloat(premiumData.indexPrice ?? "0"),
      openInterest,
      prevOpenInterest: openInterest * 0.97,
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed", detail: String(e) }, { status: 500 });
  }
}

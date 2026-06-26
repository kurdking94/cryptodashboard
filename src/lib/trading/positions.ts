import { fetchLivePrices } from "@/lib/binance/futures";
import { calcPnl, checkExits, updatePositionPrices } from "@/lib/risk/manager";
import type { Candle, Position } from "@/types/trading";

/** Refresh mark prices for open trades — entry price is never modified. */
export async function refreshOpenPositions(
  positions: Position[],
  candles?: Record<string, Candle>
): Promise<{ positions: Position[]; closed: Position[] }> {
  const open = positions.filter((p) => p.status === "OPEN");
  if (!open.length) return { positions, closed: [] };

  const livePrices = await fetchLivePrices(open.map((p) => p.symbol));
  const priceMap: Record<string, number> = { ...livePrices };

  if (candles) {
    for (const [sym, c] of Object.entries(candles)) {
      if (priceMap[sym] == null) priceMap[sym] = c.close;
    }
  }

  const priced = updatePositionPrices(positions, priceMap);
  const { updated, closed } = checkExits(priced, candles);
  return { positions: updated, closed };
}

/** Apply a price tick without any network fetch (keeps entry frozen). */
export function applyPricesToPositions(
  positions: Position[],
  prices: Record<string, number>
): Position[] {
  return updatePositionPrices(positions, prices);
}

export function summarizeOpenPnl(positions: Position[]) {
  const open = positions.filter((p) => p.status === "OPEN");
  return open.map((p) => ({
    id: p.id,
    symbol: p.symbol,
    entry: p.entryPrice,
    current: p.currentPrice,
    pnlPercent: p.pnlPercent,
  }));
}

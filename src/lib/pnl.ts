import type { Signal, SignalWithPnl } from "@/types/signal";

/**
 * Compute PnL for a signal given a current market price.
 *
 * KEY FIX: PnL is always (currentPrice - entryPrice) / entryPrice.
 * entryPrice is locked the moment the signal is created.
 * A brand-new signal therefore always starts at 0 %.
 *
 * For SHORT signals the numerator is inverted so that a falling price
 * produces a positive return.
 */
export function computePnl(
  signal: Signal,
  currentPrice: number
): Pick<SignalWithPnl, "currentPrice" | "pnlPercent" | "pnlUsd"> {
  if (!currentPrice || !signal.entryPrice) {
    return { currentPrice: currentPrice ?? 0, pnlPercent: 0, pnlUsd: 0 };
  }

  const rawMove =
    (currentPrice - signal.entryPrice) / signal.entryPrice;

  const directedMove =
    signal.direction === "LONG" ? rawMove : -rawMove;

  const pnlPercent = directedMove * signal.leverage * 100;
  const pnlUsd = directedMove * signal.leverage * signal.entryPrice;

  return {
    currentPrice,
    pnlPercent: +pnlPercent.toFixed(4),
    pnlUsd: +pnlUsd.toFixed(4),
  };
}

export function buildSignalWithPnl(
  signal: Signal,
  currentPrice: number,
  priceChange24h?: number
): SignalWithPnl {
  return {
    ...signal,
    ...computePnl(signal, currentPrice),
    priceChange24h,
  };
}

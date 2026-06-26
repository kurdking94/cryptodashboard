import { fetchKlines } from "@/lib/binance/futures";
import { analyzeCandlesReplay } from "@/lib/engine/analyzer";
import { enrichScanSignal } from "@/lib/trading/helpers";
import type { ScanSignal } from "@/types/trading";

export interface ReplayResult {
  symbol: string;
  signals: ScanSignal[];
  candlesAnalyzed: number;
  latencyMs: number;
}

/** Replay strategies over historical 15m candles */
export async function runReplay(
  symbol: string,
  enabledIds: Set<string>,
  candleCount = 200
): Promise<ReplayResult> {
  const start = Date.now();
  const candles = await fetchKlines(symbol, "15m", candleCount);
  const signals: ScanSignal[] = [];

  for (let i = 30; i < candles.length; i += 5) {
    const sig = analyzeCandlesReplay(candles, enabledIds, i);
    if (sig && sig.confidence >= 60) {
      signals.push(enrichScanSignal(
        { ...sig, symbol, price: candles[i].close, scannedAt: candles[i].openTime },
        `replay-${symbol}`
      ));
    }
  }

  return {
    symbol,
    signals: signals.sort((a, b) => b.confidence - a.confidence),
    candlesAnalyzed: candles.length,
    latencyMs: Date.now() - start,
  };
}

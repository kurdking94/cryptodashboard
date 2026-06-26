import { analyzePair } from "@/lib/engine/analyzer";
import { fetchTopFuturesTickers } from "@/lib/binance/futures";
import type { ScanSignal } from "@/types/trading";

const BATCH_SIZE = 4;
const DEEP_SCAN_COUNT = 30;

export async function runMarketScan(
  enabledStrategyIds: Set<string>,
  minConfidence: number,
  onProgress?: (scanned: number, total: number) => void
): Promise<{ signals: ScanSignal[]; latencyMs: number; pairsScanned: number; errors: string[] }> {
  const start = Date.now();
  const errors: string[] = [];
  let tickers;

  try {
    tickers = await fetchTopFuturesTickers(100);
  } catch (e) {
    throw new Error(`Failed to fetch tickers: ${e instanceof Error ? e.message : "unknown"}`);
  }

  if (tickers.length === 0) {
    throw new Error("No tickers returned from Binance — check API connection");
  }

  const btcTicker = tickers.find((t) => t.symbol === "BTCUSDT");
  const btcChange = btcTicker?.change24h ?? 0;
  const candidates = tickers.slice(0, DEEP_SCAN_COUNT);
  const signals: ScanSignal[] = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((t) => analyzePair(t, enabledStrategyIds, btcChange))
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled" && r.value && r.value.confidence >= minConfidence) {
        signals.push(r.value);
      } else if (r.status === "rejected") {
        errors.push(`${batch[j].symbol}: ${r.reason}`);
      }
    }
    onProgress?.(Math.min(i + BATCH_SIZE, candidates.length), candidates.length);
    if (i + BATCH_SIZE < candidates.length) {
      await new Promise((res) => setTimeout(res, 250));
    }
  }

  signals.sort((a, b) => b.confidence - a.confidence);
  return {
    signals,
    latencyMs: Date.now() - start,
    pairsScanned: candidates.length,
    errors,
  };
}

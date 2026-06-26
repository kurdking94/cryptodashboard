import { analyzePair } from "@/lib/engine/analyzer";
import { fetchTopFuturesTickers } from "@/lib/binance/futures";
import type { AnalyzedSignal, ScanSignal } from "@/types/trading";

const BATCH_SIZE = 3;
const SCAN_PAIR_COUNT = 100;

export async function runMarketScan(
  enabledStrategyIds: Set<string>,
  minConfidence: number,
  onProgress?: (scanned: number, total: number) => void
): Promise<{ signals: AnalyzedSignal[]; latencyMs: number; pairsScanned: number; errors: string[] }> {
  const start = Date.now();
  const errors: string[] = [];
  let tickers;

  try {
    tickers = await fetchTopFuturesTickers(SCAN_PAIR_COUNT);
  } catch (e) {
    throw new Error(`Failed to fetch tickers: ${e instanceof Error ? e.message : "unknown"}`);
  }

  if (tickers.length === 0) {
    throw new Error("No tickers returned from Binance — check API connection");
  }

  const btcTicker = tickers.find((t) => t.symbol === "BTCUSDT");
  const btcChange = btcTicker?.change24h ?? 0;
  const candidates = tickers.slice(0, SCAN_PAIR_COUNT);
  const signals: AnalyzedSignal[] = [];

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

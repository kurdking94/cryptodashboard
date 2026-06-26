import { fetchTopFuturesTickers } from "@/lib/binance/futures";
import { analyzePair } from "@/lib/engine/analyzer";
import type { ScanSignal } from "@/types/trading";

const BATCH_SIZE = 5;
const DEEP_SCAN_COUNT = 40;

export async function runMarketScan(
  enabledStrategyIds: Set<string>,
  minConfidence: number,
  onProgress?: (scanned: number, total: number) => void
): Promise<{ signals: ScanSignal[]; latencyMs: number; pairsScanned: number }> {
  const start = Date.now();
  const tickers = await fetchTopFuturesTickers(100);
  const candidates = tickers.slice(0, DEEP_SCAN_COUNT);
  const signals: ScanSignal[] = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((t) => analyzePair(t, enabledStrategyIds))
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value && r.value.confidence >= minConfidence) {
        signals.push(r.value);
      }
    }
    onProgress?.(Math.min(i + BATCH_SIZE, candidates.length), candidates.length);
    await new Promise((r) => setTimeout(r, 120));
  }

  signals.sort((a, b) => b.confidence - a.confidence);
  return {
    signals,
    latencyMs: Date.now() - start,
    pairsScanned: candidates.length,
  };
}

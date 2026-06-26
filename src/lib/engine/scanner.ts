import { analyzePair } from "@/lib/engine/analyzer";
import { fetchTopFuturesTickers } from "@/lib/binance/futures";
import type { AnalyzedSignal } from "@/types/trading";
import { SCAN_PAIR_COUNT } from "@/types/trading";

const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 350;

export async function runMarketScan(
  enabledStrategyIds: Set<string>,
  minConfidence: number,
  onProgress?: (scanned: number, total: number) => void
): Promise<{ signals: AnalyzedSignal[]; latencyMs: number; pairsScanned: number; errors: string[] }> {
  const start = Date.now();
  const errors: string[] = [];

  const tickers = await fetchTopFuturesTickers(SCAN_PAIR_COUNT).catch((e) => {
    throw new Error(`Failed to fetch tickers: ${e instanceof Error ? e.message : "unknown"}`);
  });

  if (tickers.length === 0) {
    throw new Error("No tickers returned — check market data connection");
  }

  const btcTicker = tickers.find((t) => t.symbol === "BTCUSDT");
  const btcChange = btcTicker?.change24h ?? 0;
  const candidates = tickers.slice(0, SCAN_PAIR_COUNT);
  const total = candidates.length;
  const signals: AnalyzedSignal[] = [];

  onProgress?.(0, total);

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
        const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push(`${batch[j].symbol}: ${reason}`);
      }
    }

    const scanned = Math.min(i + batch.length, total);
    onProgress?.(scanned, total);

    if (i + BATCH_SIZE < candidates.length) {
      await new Promise((res) => setTimeout(res, BATCH_DELAY_MS));
    }
  }

  signals.sort((a, b) => b.confidence - a.confidence);
  return {
    signals,
    latencyMs: Date.now() - start,
    pairsScanned: total,
    errors,
  };
}

export { SCAN_PAIR_COUNT };

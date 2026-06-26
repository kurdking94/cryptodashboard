import type { Candle, ScanSignal, StrategyResult, Timeframe, TrendBias } from "@/types/trading";
import { ALL_STRATEGIES } from "@/lib/strategies";
import { trendFromCloses, volatilityPercent } from "@/lib/indicators";
import { fetchKlines, intervalFor } from "@/lib/binance/futures";
import type { MarketTicker } from "@/types/trading";

/** Proxy whale score from abnormal volume vs recent average */
export function whaleScoreFromCandles(candles: Candle[]): number {
  if (candles.length < 20) return 50;
  const vols = candles.map((c) => c.volume);
  const avg = vols.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const last = vols[vols.length - 1];
  const ratio = avg > 0 ? last / avg : 1;
  if (ratio > 3) return 85;
  if (ratio > 2) return 70;
  if (ratio > 1.5) return 60;
  return 45;
}

/** News risk proxy — high volatility + sharp move = elevated event risk */
export function newsRiskScore(ticker: MarketTicker): number {
  const move = Math.abs(ticker.change24h);
  const vol = ticker.volatility;
  if (move > 15 || vol > 12) return 25;
  if (move > 8 || vol > 8) return 45;
  if (move > 4) return 65;
  return 80;
}

export function combineStrategies(
  results: StrategyResult[],
  enabledIds: Set<string>
): { direction: "LONG" | "SHORT" | null; confidence: number; agreeing: number } {
  const active = results.filter((r) => enabledIds.has(r.id) && r.direction !== "NEUTRAL");
  if (active.length === 0) return { direction: null, confidence: 0, agreeing: 0 };

  const longs = active.filter((r) => r.direction === "LONG");
  const shorts = active.filter((r) => r.direction === "SHORT");
  const direction = longs.length >= shorts.length ? "LONG" : "SHORT";
  const agreeing = direction === "LONG" ? longs.length : shorts.length;
  const aligned = direction === "LONG" ? longs : shorts;

  if (agreeing < 2) return { direction: null, confidence: 0, agreeing };

  const avgConf = aligned.reduce((s, r) => s + r.confidence, 0) / aligned.length;
  const agreementBonus = (agreeing / active.length) * 25;
  const confidence = Math.min(99, avgConf * 0.6 + agreementBonus + agreeing * 5);

  return { direction, confidence, agreeing };
}

export async function analyzePair(
  ticker: MarketTicker,
  enabledStrategyIds: Set<string>
): Promise<ScanSignal | null> {
  const timeframes: Record<Timeframe, TrendBias> = {
    "1m": "NEUTRAL", "5m": "NEUTRAL", "15m": "NEUTRAL", "1h": "NEUTRAL", "4h": "NEUTRAL",
  };

  const klines15 = await fetchKlines(ticker.symbol, intervalFor("15m"), 100);
  if (klines15.length < 30) return null;

  const strategyResults = ALL_STRATEGIES.map((fn) => fn(klines15));
  const filtered = strategyResults.map((r) => ({
    ...r,
    enabled: enabledStrategyIds.has(r.id),
  }));

  const { direction, confidence, agreeing } = combineStrategies(filtered, enabledStrategyIds);
  if (!direction || confidence < 50) return null;

  // Multi-timeframe trends (parallel fetch)
  const tfEntries = await Promise.all(
    (["5m", "1h", "4h"] as Timeframe[]).map(async (tf) => {
      const kl = await fetchKlines(ticker.symbol, intervalFor(tf), 60);
      return [tf, trendFromCloses(kl.map((c) => c.close))] as const;
    })
  );
  for (const [tf, bias] of tfEntries) timeframes[tf] = bias;
  timeframes["15m"] = trendFromCloses(klines15.map((c) => c.close));

  const htf = timeframes["4h"];
  if (direction === "LONG" && htf === "BEARISH") return null;
  if (direction === "SHORT" && htf === "BULLISH") return null;

  const whale = whaleScoreFromCandles(klines15);
  const news = newsRiskScore(ticker);
  const volConfirm = Math.min(100, (ticker.quoteVolume24h / 50_000_000) * 100);
  const volQuality = volatilityPercent(klines15);

  let finalConf = confidence;
  finalConf += agreeing >= 4 ? 8 : agreeing >= 3 ? 4 : 0;
  finalConf += volConfirm > 50 ? 3 : 0;
  finalConf += whale > 65 ? 4 : 0;
  finalConf *= news / 100;
  finalConf = Math.min(99, Math.max(0, finalConf));

  return {
    symbol: ticker.symbol,
    direction,
    confidence: +finalConf.toFixed(1),
    price: ticker.price,
    change24h: ticker.change24h,
    volume24h: ticker.volume24h,
    quoteVolume24h: ticker.quoteVolume24h,
    spread: ticker.spread,
    volatility: volQuality || ticker.volatility,
    strategies: filtered,
    agreeingStrategies: agreeing,
    totalStrategies: filtered.filter((s) => s.enabled).length,
    timeframes,
    newsScore: news,
    whaleScore: whale,
    volumeConfirmation: +volConfirm.toFixed(1),
    scannedAt: Date.now(),
  };
}

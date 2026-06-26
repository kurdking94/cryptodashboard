import type {
  Candle,
  ConfidenceBreakdown,
  AnalyzedSignal,
  ScanSignal,
  ScanTimeframe,
  StrategyResult,
  Timeframe,
  TrendBias,
} from "@/types/trading";
import { runAllStrategies } from "@/lib/strategies";
import type { StrategyContext } from "@/lib/strategies/types";
import { resampleCandles, trendFromCloses, volatilityPercent } from "@/lib/indicators";
import { fetchKlines, fetchMarketContext, intervalFor } from "@/lib/binance/futures";
import type { MarketTicker } from "@/types/trading";

export const SCAN_TIMEFRAMES: ScanTimeframe[] = ["45m", "1h", "4h"];

const MIN_BARS: Record<ScanTimeframe, number> = {
  "45m": 30,
  "1h": 30,
  "4h": 30,
};

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

export function newsRiskScore(ticker: MarketTicker): number {
  const move = Math.abs(ticker.change24h);
  const vol = ticker.volatility;
  if (move > 15 || vol > 12) return 30;
  if (move > 8 || vol > 8) return 50;
  if (move > 4) return 70;
  return 85;
}

export function combineStrategies(
  results: StrategyResult[],
  enabledIds: Set<string>
): { direction: "LONG" | "SHORT" | null; confidence: number; agreeing: number; aligned: StrategyResult[] } {
  const active = results.filter((r) => enabledIds.has(r.id) && r.direction !== "NEUTRAL");
  if (active.length === 0) return { direction: null, confidence: 0, agreeing: 0, aligned: [] };

  const longs = active.filter((r) => r.direction === "LONG");
  const shorts = active.filter((r) => r.direction === "SHORT");
  const direction = longs.length >= shorts.length ? "LONG" : "SHORT";
  const agreeing = direction === "LONG" ? longs.length : shorts.length;
  const aligned = direction === "LONG" ? longs : shorts;

  const maxConf = aligned.length > 0 ? Math.max(...aligned.map((r) => r.confidence)) : 0;

  // Need at least 1 agreeing strategy with decent confidence, or 2+ strategies
  if (agreeing < 1 || (agreeing < 2 && maxConf < 60)) {
    return { direction: null, confidence: 0, agreeing, aligned: [] };
  }

  const avgConf = aligned.reduce((s, r) => s + r.confidence, 0) / aligned.length;
  const agreementBonus = Math.min(30, (agreeing / Math.max(active.length, 1)) * 30);
  const confidence = Math.min(99, avgConf * 0.55 + agreementBonus + agreeing * 3);

  return { direction, confidence, agreeing, aligned };
}

export function buildConfidenceBreakdown(
  strategyAvg: number,
  agreeing: number,
  totalActive: number,
  volConfirm: number,
  whale: number,
  news: number,
  htfPenalty = 0
): ConfidenceBreakdown {
  const agreementBonus = agreeing >= 6 ? 12 : agreeing >= 4 ? 8 : agreeing >= 2 ? 4 : 0;
  const volumeBonus = volConfirm > 50 ? 3 : 0;
  const whaleBonus = whale > 65 ? 4 : 0;
  const raw = strategyAvg + agreementBonus + volumeBonus + whaleBonus - htfPenalty;
  const newsMultiplier = news / 100;
  const final = Math.min(99, Math.max(0, raw * newsMultiplier));
  const newsPenalty = +(raw - final + htfPenalty).toFixed(2);

  return {
    strategyAvg: +strategyAvg.toFixed(2),
    agreementBonus,
    volumeBonus,
    whaleBonus,
    newsMultiplier,
    newsPenalty,
    raw: +raw.toFixed(2),
    final: +final.toFixed(2),
  };
}

export function buildRankingReason(
  breakdown: ConfidenceBreakdown,
  agreeing: number,
  aligned: StrategyResult[],
  news: number,
  whale: number,
  timeframes?: Record<Timeframe, TrendBias>
): string {
  const names = aligned.slice(0, 4).map((s) => `${s.name}${s.timeframe ? ` (${s.timeframe})` : ""}`).join(", ");
  const more = aligned.length > 4 ? ` +${aligned.length - 4} more` : "";
  const parts = [`${agreeing} strategy signals agree (${names}${more})`];
  if (timeframes) {
    const tfSummary = SCAN_TIMEFRAMES.map((tf) => `${tf} ${timeframes[tf]}`).join(", ");
    parts.push(tfSummary);
  }
  if (breakdown.agreementBonus > 0) parts.push(`+${breakdown.agreementBonus} agreement`);
  if (breakdown.volumeBonus > 0) parts.push(`+${breakdown.volumeBonus} volume`);
  if (breakdown.whaleBonus > 0) parts.push(`+${breakdown.whaleBonus} whale (${whale})`);
  if (breakdown.newsPenalty > 0) parts.push(`−${breakdown.newsPenalty} risk (news ${news})`);
  return parts.join(" · ");
}

async function fetchCandlesForScanTimeframe(symbol: string, tf: ScanTimeframe): Promise<Candle[]> {
  if (tf === "45m") {
    const m15 = await fetchKlines(symbol, "15m", 360);
    return resampleCandles(m15, 3);
  }
  return fetchKlines(symbol, intervalFor(tf), 120);
}

function runStrategiesOnTimeframe(
  candles: Candle[],
  tf: ScanTimeframe,
  baseCtx: Omit<StrategyContext, "candles">,
  enabledStrategyIds: Set<string>
): StrategyResult[] {
  if (candles.length < MIN_BARS[tf]) return [];

  return runAllStrategies({ ...baseCtx, candles }).map((r) => ({
    ...r,
    timeframe: tf,
    enabled: enabledStrategyIds.has(r.id),
  }));
}

function htfAdjustment(
  direction: "LONG" | "SHORT",
  timeframes: Record<Timeframe, TrendBias>
): number {
  let penalty = 0;
  let bonus = 0;

  for (const tf of SCAN_TIMEFRAMES) {
    const bias = timeframes[tf];
    if (direction === "LONG" && bias === "BEARISH") penalty += 4;
    if (direction === "SHORT" && bias === "BULLISH") penalty += 4;
    if (direction === "LONG" && bias === "BULLISH") bonus += 2;
    if (direction === "SHORT" && bias === "BEARISH") bonus += 2;
  }

  return Math.max(0, penalty - bonus);
}

export async function analyzePair(
  ticker: MarketTicker,
  enabledStrategyIds: Set<string>,
  btcChange24h?: number
): Promise<AnalyzedSignal | null> {
  const [candlesByTf, marketCtx] = await Promise.all([
    Promise.all(SCAN_TIMEFRAMES.map(async (tf) => [tf, await fetchCandlesForScanTimeframe(ticker.symbol, tf)] as const)),
    fetchMarketContext(ticker.symbol),
  ]);

  const candleMap = Object.fromEntries(candlesByTf) as Record<ScanTimeframe, Candle[]>;
  const hasEnoughData = SCAN_TIMEFRAMES.every((tf) => candleMap[tf].length >= MIN_BARS[tf]);
  if (!hasEnoughData) return null;

  const baseCtx: Omit<StrategyContext, "candles"> = {
    ticker,
    btcChange24h,
    ...marketCtx,
  };

  const strategyResults = SCAN_TIMEFRAMES.flatMap((tf) =>
    runStrategiesOnTimeframe(candleMap[tf], tf, baseCtx, enabledStrategyIds)
  );

  const { direction, confidence, agreeing, aligned } = combineStrategies(strategyResults, enabledStrategyIds);
  if (!direction || confidence < 40) return null;

  const timeframes = Object.fromEntries(
    SCAN_TIMEFRAMES.map((tf) => [tf, trendFromCloses(candleMap[tf].map((c) => c.close))])
  ) as Record<Timeframe, TrendBias>;

  const htfPenalty = htfAdjustment(direction, timeframes);
  const primaryCandles = candleMap["45m"];
  const whale = whaleScoreFromCandles(primaryCandles);
  const news = newsRiskScore(ticker);
  const volConfirm = Math.min(100, (ticker.quoteVolume24h / 50_000_000) * 100);
  const volQuality = volatilityPercent(primaryCandles);
  const activeCount = strategyResults.filter((s) => s.enabled && s.direction !== "NEUTRAL").length;
  const enabledSlots = enabledStrategyIds.size * SCAN_TIMEFRAMES.length;

  const avgConf = aligned.reduce((s, r) => s + r.confidence, 0) / aligned.length;
  const baseScore = avgConf * 0.55 + agreeing * 3 + (agreeing / Math.max(activeCount, 1)) * 20;
  const breakdown = buildConfidenceBreakdown(baseScore, agreeing, activeCount, volConfirm, whale, news, htfPenalty);
  const rankingReason = buildRankingReason(breakdown, agreeing, aligned, news, whale, timeframes);

  if (breakdown.final < 40) return null;

  return {
    symbol: ticker.symbol,
    direction,
    confidence: breakdown.final,
    price: ticker.price,
    change24h: ticker.change24h,
    volume24h: ticker.volume24h,
    quoteVolume24h: ticker.quoteVolume24h,
    spread: ticker.spread,
    volatility: volQuality || ticker.volatility,
    strategies: strategyResults,
    agreeingStrategies: agreeing,
    totalStrategies: enabledSlots,
    timeframes,
    newsScore: news,
    whaleScore: whale,
    volumeConfirmation: +volConfirm.toFixed(1),
    scannedAt: Date.now(),
    confidenceBreakdown: breakdown,
    rankingReason,
  };
}

export function analyzeCandlesReplay(candles: Candle[], enabledIds: Set<string>, atIndex: number): AnalyzedSignal | null {
  const slice = candles.slice(0, atIndex + 1);
  if (slice.length < 30) return null;

  const ctx: StrategyContext = { candles: slice };
  const strategyResults = runAllStrategies(ctx).map((r) => ({ ...r, enabled: enabledIds.has(r.id), timeframe: "45m" as ScanTimeframe }));
  const { direction, agreeing, aligned } = combineStrategies(strategyResults, enabledIds);
  if (!direction || agreeing < 1) return null;

  const last = slice[slice.length - 1];
  const whale = whaleScoreFromCandles(slice);
  const volQuality = volatilityPercent(slice);
  const activeCount = strategyResults.filter((s) => s.enabled && s.direction !== "NEUTRAL").length;
  const avgConf = aligned.reduce((s, r) => s + r.confidence, 0) / aligned.length;
  const breakdown = buildConfidenceBreakdown(avgConf * 0.55 + agreeing * 3, agreeing, activeCount, 50, whale, 85);

  const timeframes: Record<Timeframe, TrendBias> = {
    "45m": trendFromCloses(slice.map((c) => c.close)),
    "1h": "NEUTRAL",
    "4h": "NEUTRAL",
  };

  return {
    symbol: "REPLAY",
    direction,
    confidence: breakdown.final,
    price: last.close,
    change24h: 0,
    volume24h: last.volume,
    quoteVolume24h: 0,
    spread: 0,
    volatility: volQuality,
    strategies: strategyResults,
    agreeingStrategies: agreeing,
    totalStrategies: enabledIds.size,
    timeframes,
    newsScore: 85,
    whaleScore: whale,
    volumeConfirmation: 50,
    scannedAt: last.openTime,
    confidenceBreakdown: breakdown,
    rankingReason: buildRankingReason(breakdown, agreeing, aligned, 85, whale),
  };
}

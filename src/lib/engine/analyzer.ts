import type { Candle, ConfidenceBreakdown, ScanSignal, StrategyResult, Timeframe, TrendBias } from "@/types/trading";
import { runAllStrategies } from "@/lib/strategies";
import type { StrategyContext } from "@/lib/strategies/types";
import { trendFromCloses, volatilityPercent } from "@/lib/indicators";
import { fetchKlines, fetchMarketContext, intervalFor } from "@/lib/binance/futures";
import type { MarketTicker } from "@/types/trading";

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
  whale: number
): string {
  const names = aligned.slice(0, 4).map((s) => s.name).join(", ");
  const more = aligned.length > 4 ? ` +${aligned.length - 4} more` : "";
  const parts = [`${agreeing} strategies agree (${names}${more})`];
  if (breakdown.agreementBonus > 0) parts.push(`+${breakdown.agreementBonus} agreement`);
  if (breakdown.volumeBonus > 0) parts.push(`+${breakdown.volumeBonus} volume`);
  if (breakdown.whaleBonus > 0) parts.push(`+${breakdown.whaleBonus} whale (${whale})`);
  if (breakdown.newsPenalty > 0) parts.push(`−${breakdown.newsPenalty} risk (news ${news})`);
  return parts.join(" · ");
}

export async function analyzePair(
  ticker: MarketTicker,
  enabledStrategyIds: Set<string>,
  btcChange24h?: number
): Promise<ScanSignal | null> {
  const timeframes: Record<Timeframe, TrendBias> = {
    "1m": "NEUTRAL", "5m": "NEUTRAL", "15m": "NEUTRAL", "1h": "NEUTRAL", "4h": "NEUTRAL",
  };

  const [klines15, klines1h, marketCtx] = await Promise.all([
    fetchKlines(ticker.symbol, intervalFor("15m"), 120),
    fetchKlines(ticker.symbol, intervalFor("1h"), 60),
    fetchMarketContext(ticker.symbol),
  ]);

  if (klines15.length < 30) return null;

  const ctx: StrategyContext = {
    candles: klines15,
    ticker,
    btcChange24h,
    ...marketCtx,
  };

  const strategyResults = runAllStrategies(ctx);
  const filtered = strategyResults.map((r) => ({
    ...r,
    enabled: enabledStrategyIds.has(r.id),
  }));

  const { direction, confidence, agreeing, aligned } = combineStrategies(filtered, enabledStrategyIds);
  if (!direction || confidence < 40) return null;

  timeframes["15m"] = trendFromCloses(klines15.map((c) => c.close));
  timeframes["1h"] = trendFromCloses(klines1h.map((c) => c.close));
  timeframes["4h"] = timeframes["1h"];
  timeframes["5m"] = timeframes["15m"];

  let htfPenalty = 0;
  const htf = timeframes["1h"];
  if (direction === "LONG" && htf === "BEARISH") htfPenalty = 8;
  if (direction === "SHORT" && htf === "BULLISH") htfPenalty = 8;

  const whale = whaleScoreFromCandles(klines15);
  const news = newsRiskScore(ticker);
  const volConfirm = Math.min(100, (ticker.quoteVolume24h / 50_000_000) * 100);
  const volQuality = volatilityPercent(klines15);
  const activeCount = filtered.filter((s) => s.enabled && s.direction !== "NEUTRAL").length;

  const avgConf = aligned.reduce((s, r) => s + r.confidence, 0) / aligned.length;
  const baseScore = avgConf * 0.55 + agreeing * 3 + (agreeing / Math.max(activeCount, 1)) * 20;
  const breakdown = buildConfidenceBreakdown(baseScore, agreeing, activeCount, volConfirm, whale, news, htfPenalty);
  const rankingReason = buildRankingReason(breakdown, agreeing, aligned, news, whale);

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
    strategies: filtered,
    agreeingStrategies: agreeing,
    totalStrategies: filtered.filter((s) => s.enabled).length,
    timeframes,
    newsScore: news,
    whaleScore: whale,
    volumeConfirmation: +volConfirm.toFixed(1),
    scannedAt: Date.now(),
    confidenceBreakdown: breakdown,
    rankingReason,
  };
}

export function analyzeCandlesReplay(candles: Candle[], enabledIds: Set<string>, atIndex: number): ScanSignal | null {
  const slice = candles.slice(0, atIndex + 1);
  if (slice.length < 30) return null;

  const ctx: StrategyContext = { candles: slice };
  const strategyResults = runAllStrategies(ctx);
  const filtered = strategyResults.map((r) => ({ ...r, enabled: enabledIds.has(r.id) }));
  const { direction, agreeing, aligned } = combineStrategies(filtered, enabledIds);
  if (!direction || agreeing < 1) return null;

  const last = slice[slice.length - 1];
  const whale = whaleScoreFromCandles(slice);
  const volQuality = volatilityPercent(slice);
  const activeCount = filtered.filter((s) => s.enabled && s.direction !== "NEUTRAL").length;
  const avgConf = aligned.reduce((s, r) => s + r.confidence, 0) / aligned.length;
  const breakdown = buildConfidenceBreakdown(avgConf * 0.55 + agreeing * 3, agreeing, activeCount, 50, whale, 85);

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
    strategies: filtered,
    agreeingStrategies: agreeing,
    totalStrategies: filtered.filter((s) => s.enabled).length,
    timeframes: { "1m": "NEUTRAL", "5m": "NEUTRAL", "15m": "NEUTRAL", "1h": "NEUTRAL", "4h": "NEUTRAL" },
    newsScore: 85,
    whaleScore: whale,
    volumeConfirmation: 50,
    scannedAt: last.openTime,
    confidenceBreakdown: breakdown,
    rankingReason: buildRankingReason(breakdown, agreeing, aligned, 85, whale),
  };
}

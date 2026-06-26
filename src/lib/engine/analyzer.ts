import type { Candle, ConfidenceBreakdown, ScanSignal, StrategyResult, Timeframe, TrendBias } from "@/types/trading";
import { ALL_STRATEGIES } from "@/lib/strategies";
import { trendFromCloses, volatilityPercent } from "@/lib/indicators";
import { fetchKlines, intervalFor } from "@/lib/binance/futures";
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
  if (move > 15 || vol > 12) return 25;
  if (move > 8 || vol > 8) return 45;
  if (move > 4) return 65;
  return 80;
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

  if (agreeing < 2) return { direction: null, confidence: 0, agreeing, aligned: [] };

  const avgConf = aligned.reduce((s, r) => s + r.confidence, 0) / aligned.length;
  const agreementBonus = (agreeing / active.length) * 25;
  const confidence = Math.min(99, avgConf * 0.6 + agreementBonus + agreeing * 5);

  return { direction, confidence, agreeing, aligned };
}

export function buildConfidenceBreakdown(
  strategyAvg: number,
  agreeing: number,
  totalActive: number,
  volConfirm: number,
  whale: number,
  news: number
): ConfidenceBreakdown {
  const agreementBonus = agreeing >= 4 ? 8 : agreeing >= 3 ? 4 : 0;
  const volumeBonus = volConfirm > 50 ? 3 : 0;
  const whaleBonus = whale > 65 ? 4 : 0;
  const raw = strategyAvg + agreementBonus + volumeBonus + whaleBonus;
  const newsMultiplier = news / 100;
  const final = Math.min(99, Math.max(0, raw * newsMultiplier));
  const newsPenalty = +(raw - final).toFixed(2);

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
  const names = aligned.map((s) => s.name).join(", ");
  const parts = [`${agreeing} strategies agree (${names})`];
  if (breakdown.agreementBonus > 0) parts.push(`+${breakdown.agreementBonus} agreement bonus`);
  if (breakdown.volumeBonus > 0) parts.push(`+${breakdown.volumeBonus} volume`);
  if (breakdown.whaleBonus > 0) parts.push(`+${breakdown.whaleBonus} whale activity (${whale})`);
  if (breakdown.newsPenalty > 0) parts.push(`−${breakdown.newsPenalty} news risk (${news})`);
  return parts.join(" · ");
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

  const { direction, confidence, agreeing, aligned } = combineStrategies(filtered, enabledStrategyIds);
  if (!direction || confidence < 50) return null;

  const tfEntries = await Promise.all(
    (["5m", "1h", "4h"] as const).map(async (tf) => {
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
  const activeCount = filtered.filter((s) => s.enabled && s.direction !== "NEUTRAL").length;

  const avgConf = aligned.reduce((s, r) => s + r.confidence, 0) / aligned.length;
  const breakdown = buildConfidenceBreakdown(avgConf * 0.6 + agreeing * 5 + (agreeing / activeCount) * 25, agreeing, activeCount, volConfirm, whale, news);
  const rankingReason = buildRankingReason(breakdown, agreeing, aligned, news, whale);

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

/** Run strategies on historical candles (replay mode) */
export function analyzeCandlesReplay(candles: Candle[], enabledIds: Set<string>, atIndex: number): ScanSignal | null {
  const slice = candles.slice(0, atIndex + 1);
  if (slice.length < 30) return null;

  const strategyResults = ALL_STRATEGIES.map((fn) => fn(slice));
  const filtered = strategyResults.map((r) => ({ ...r, enabled: enabledIds.has(r.id) }));
  const { direction, confidence, agreeing, aligned } = combineStrategies(filtered, enabledIds);
  if (!direction || agreeing < 2) return null;

  const last = slice[slice.length - 1];
  const whale = whaleScoreFromCandles(slice);
  const volQuality = volatilityPercent(slice);
  const activeCount = filtered.filter((s) => s.enabled && s.direction !== "NEUTRAL").length;
  const avgConf = aligned.reduce((s, r) => s + r.confidence, 0) / aligned.length;
  const breakdown = buildConfidenceBreakdown(avgConf * 0.6 + agreeing * 5 + (agreeing / activeCount) * 25, agreeing, activeCount, 50, whale, 80);

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
    newsScore: 80,
    whaleScore: whale,
    volumeConfirmation: 50,
    scannedAt: last.openTime,
    confidenceBreakdown: breakdown,
    rankingReason: buildRankingReason(breakdown, agreeing, aligned, 80, whale),
  };
}

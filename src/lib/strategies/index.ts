import type { Candle, StrategyResult } from "@/types/trading";
import { ema, rsi, macd, bollinger, trendFromCloses } from "@/lib/indicators";

function neutral(id: string, name: string, reason: string): StrategyResult {
  return { id, name, direction: "NEUTRAL", confidence: 0, reason, enabled: true };
}

export function emaCrossoverStrategy(candles: Candle[]): StrategyResult {
  const id = "ema_cross";
  const name = "EMA Crossover";
  const closes = candles.map((c) => c.close);
  if (closes.length < 30) return neutral(id, name, "Insufficient data");

  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const i = closes.length - 1;
  const prev = i - 1;
  const crossedUp = e9[prev] <= e21[prev] && e9[i] > e21[i];
  const crossedDown = e9[prev] >= e21[prev] && e9[i] < e21[i];
  const bullish = e9[i] > e21[i];
  const strength = Math.min(100, Math.abs(((e9[i] - e21[i]) / e21[i]) * 1000));

  if (crossedUp) return { id, name, direction: "LONG", confidence: 70 + strength * 0.3, reason: "EMA9 crossed above EMA21", enabled: true };
  if (crossedDown) return { id, name, direction: "SHORT", confidence: 70 + strength * 0.3, reason: "EMA9 crossed below EMA21", enabled: true };
  if (bullish) return { id, name, direction: "LONG", confidence: 45 + strength * 0.2, reason: "EMA9 above EMA21", enabled: true };
  return { id, name, direction: "SHORT", confidence: 45 + strength * 0.2, reason: "EMA9 below EMA21", enabled: true };
}

export function rsiMomentumStrategy(candles: Candle[]): StrategyResult {
  const id = "rsi_momentum";
  const name = "RSI Momentum";
  const closes = candles.map((c) => c.close);
  const val = rsi(closes);
  if (val < 30) return { id, name, direction: "LONG", confidence: 75 + (30 - val), reason: `RSI oversold at ${val.toFixed(1)}`, enabled: true };
  if (val > 70) return { id, name, direction: "SHORT", confidence: 75 + (val - 70), reason: `RSI overbought at ${val.toFixed(1)}`, enabled: true };
  if (val < 45) return { id, name, direction: "LONG", confidence: 40, reason: `RSI leaning bullish ${val.toFixed(1)}`, enabled: true };
  if (val > 55) return { id, name, direction: "SHORT", confidence: 40, reason: `RSI leaning bearish ${val.toFixed(1)}`, enabled: true };
  return neutral(id, name, `RSI neutral ${val.toFixed(1)}`);
}

export function macdStrategy(candles: Candle[]): StrategyResult {
  const id = "macd";
  const name = "MACD";
  const closes = candles.map((c) => c.close);
  if (closes.length < 35) return neutral(id, name, "Insufficient data");
  const { histogram, prevHistogram, macd: m, signal } = macd(closes);
  const crossedUp = prevHistogram <= 0 && histogram > 0;
  const crossedDown = prevHistogram >= 0 && histogram < 0;
  const strength = Math.min(30, Math.abs(histogram) * 100);

  if (crossedUp) return { id, name, direction: "LONG", confidence: 72 + strength, reason: "MACD bullish crossover", enabled: true };
  if (crossedDown) return { id, name, direction: "SHORT", confidence: 72 + strength, reason: "MACD bearish crossover", enabled: true };
  if (m > signal) return { id, name, direction: "LONG", confidence: 50, reason: "MACD above signal", enabled: true };
  if (m < signal) return { id, name, direction: "SHORT", confidence: 50, reason: "MACD below signal", enabled: true };
  return neutral(id, name, "MACD flat");
}

export function volumeBreakoutStrategy(candles: Candle[]): StrategyResult {
  const id = "volume_breakout";
  const name = "Volume Breakout";
  if (candles.length < 25) return neutral(id, name, "Insufficient data");
  const vols = candles.map((c) => c.volume);
  const avgVol = vols.slice(-20, -1).reduce((a, b) => a + b, 0) / 19;
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const volSpike = last.volume > avgVol * 1.8;
  const bullish = last.close > prev.close;
  const move = Math.abs((last.close - prev.close) / prev.close) * 100;

  if (volSpike && bullish && move > 0.3)
    return { id, name, direction: "LONG", confidence: 68 + Math.min(20, move * 5), reason: `Volume spike +${move.toFixed(2)}%`, enabled: true };
  if (volSpike && !bullish && move > 0.3)
    return { id, name, direction: "SHORT", confidence: 68 + Math.min(20, move * 5), reason: `Volume spike -${move.toFixed(2)}%`, enabled: true };
  return neutral(id, name, "No volume breakout");
}

export function bollingerStrategy(candles: Candle[]): StrategyResult {
  const id = "bollinger";
  const name = "Bollinger Bands";
  const closes = candles.map((c) => c.close);
  if (closes.length < 25) return neutral(id, name, "Insufficient data");
  const bb = bollinger(closes);
  const last = closes[closes.length - 1];
  if (last <= bb.lower) return { id, name, direction: "LONG", confidence: 70, reason: "Price at lower band", enabled: true };
  if (last >= bb.upper) return { id, name, direction: "SHORT", confidence: 70, reason: "Price at upper band", enabled: true };
  if (bb.percentB < 0.3) return { id, name, direction: "LONG", confidence: 45, reason: "Near lower band", enabled: true };
  if (bb.percentB > 0.7) return { id, name, direction: "SHORT", confidence: 45, reason: "Near upper band", enabled: true };
  return neutral(id, name, "Mid-range");
}

export function trendAlignmentStrategy(candles: Candle[]): StrategyResult {
  const id = "trend_align";
  const name = "Trend Alignment";
  const closes = candles.map((c) => c.close);
  const trend = trendFromCloses(closes);
  if (trend === "BULLISH") return { id, name, direction: "LONG", confidence: 60, reason: "Higher TF trend bullish", enabled: true };
  if (trend === "BEARISH") return { id, name, direction: "SHORT", confidence: 60, reason: "Higher TF trend bearish", enabled: true };
  return neutral(id, name, "Trend neutral");
}

export const ALL_STRATEGIES = [
  emaCrossoverStrategy,
  rsiMomentumStrategy,
  macdStrategy,
  volumeBreakoutStrategy,
  bollingerStrategy,
  trendAlignmentStrategy,
];

export const STRATEGY_NAMES = ALL_STRATEGIES.map((_, i) => [
  "ema_cross", "rsi_momentum", "macd", "volume_breakout", "bollinger", "trend_align",
][i]);

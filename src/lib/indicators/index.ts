export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export function sma(values: number[], period: number): number {
  const slice = values.slice(-period);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function macd(closes: number[]) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = ema(macdLine, 9);
  const hist = macdLine.map((v, i) => v - signal[i]);
  const last = macdLine.length - 1;
  return {
    macd: macdLine[last],
    signal: signal[last],
    histogram: hist[last],
    prevHistogram: hist[last - 1] ?? 0,
  };
}

export function atr(candles: { high: number; low: number; close: number }[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return sma(trs, Math.min(period, trs.length));
}

export function bollinger(closes: number[], period = 20, mult = 2) {
  const slice = closes.slice(-period);
  const mid = sma(closes, period);
  const variance = slice.reduce((s, v) => s + (v - mid) ** 2, 0) / slice.length;
  const std = Math.sqrt(variance);
  const last = closes[closes.length - 1];
  return {
    upper: mid + mult * std,
    middle: mid,
    lower: mid - mult * std,
    percentB: std === 0 ? 0.5 : (last - (mid - mult * std)) / (2 * mult * std),
  };
}

export function trendFromCloses(closes: number[]): "BULLISH" | "BEARISH" | "NEUTRAL" {
  if (closes.length < 20) return "NEUTRAL";
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const last = closes.length - 1;
  const diff = ((e9[last] - e21[last]) / e21[last]) * 100;
  if (diff > 0.15) return "BULLISH";
  if (diff < -0.15) return "BEARISH";
  return "NEUTRAL";
}

export function volatilityPercent(candles: { high: number; low: number; close: number }[]): number {
  const a = atr(candles);
  const lastClose = candles[candles.length - 1]?.close ?? 1;
  return (a / lastClose) * 100;
}

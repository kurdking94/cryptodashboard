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
    prevMacd: macdLine[last - 1] ?? 0,
    prevSignal: signal[last - 1] ?? 0,
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

export function atrSeries(candles: { high: number; low: number; close: number }[], period = 14): number[] {
  const out: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    out.push(atr(candles.slice(0, i + 1), period));
  }
  return out;
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
    width: mid > 0 ? (2 * mult * std) / mid : 0,
  };
}

export function keltner(candles: { high: number; low: number; close: number }[], period = 20, mult = 1.5) {
  const closes = candles.map((c) => c.close);
  const mid = ema(closes, period);
  const a = atr(candles, period);
  const i = closes.length - 1;
  return { upper: mid[i] + mult * a, middle: mid[i], lower: mid[i] - mult * a };
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

export function pivotHigh(candles: { high: number }[], left = 5, right = 5): number | null {
  const i = candles.length - 1 - right;
  if (i < left) return null;
  const h = candles[i].high;
  for (let j = i - left; j <= i + right; j++) {
    if (j !== i && candles[j].high >= h) return null;
  }
  return h;
}

export function pivotLow(candles: { low: number }[], left = 5, right = 5): number | null {
  const i = candles.length - 1 - right;
  if (i < left) return null;
  const l = candles[i].low;
  for (let j = i - left; j <= i + right; j++) {
    if (j !== i && candles[j].low <= l) return null;
  }
  return l;
}

export function adx(candles: { high: number; low: number; close: number }[], period = 14) {
  if (candles.length < period + 2) return { adx: 0, plusDI: 0, minusDI: 0 };
  let plusDM = 0, minusDM = 0, tr = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM += up > down && up > 0 ? up : 0;
    minusDM += down > up && down > 0 ? down : 0;
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    tr += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  const plusDI = tr > 0 ? (plusDM / tr) * 100 : 0;
  const minusDI = tr > 0 ? (minusDM / tr) * 100 : 0;
  const dx = plusDI + minusDI > 0 ? (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100 : 0;
  return { adx: dx, plusDI, minusDI };
}

export function superTrend(
  candles: { high: number; low: number; close: number }[],
  period = 10,
  factor = 3
): { trend: "UP" | "DOWN"; value: number } {
  const atrVal = atr(candles, period);
  const last = candles[candles.length - 1];
  const hl2 = (last.high + last.low) / 2;
  const upper = hl2 + factor * atrVal;
  const lower = hl2 - factor * atrVal;
  const trend = last.close > lower ? "UP" : "DOWN";
  return { trend, value: trend === "UP" ? lower : upper };
}

export function waveTrend(closes: number[], channelLen = 10, avgLen = 21) {
  if (closes.length < channelLen + avgLen) {
    return { wt1: 0, wt2: 0, prevWt1: 0, prevWt2: 0 };
  }
  const ap = closes.map((_, i) => sma(closes.slice(Math.max(0, i - channelLen + 1), i + 1), Math.min(channelLen, i + 1)));
  const esa = ema(ap, channelLen);
  const d = ema(ap.map((v, i) => Math.abs(v - esa[i])), channelLen);
  const ci = ap.map((v, i) => (d[i] > 0 ? (v - esa[i]) / (0.015 * d[i]) : 0));
  const wt1 = ema(ci, avgLen);
  const i = closes.length - 1;
  const wt2Now = sma(wt1.slice(-4), 4);
  const wt2Prev = i > 4 ? sma(wt1.slice(-5, -1), 4) : wt2Now;
  return { wt1: wt1[i], wt2: wt2Now, prevWt1: wt1[i - 1] ?? 0, prevWt2: wt2Prev };
}

export function sessionVwap(candles: { high: number; low: number; close: number; volume: number }[]): number {
  let pv = 0, vol = 0;
  const sessionStart = candles.length > 32 ? candles.length - 32 : 0;
  for (let i = sessionStart; i < candles.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    pv += tp * candles[i].volume;
    vol += candles[i].volume;
  }
  return vol > 0 ? pv / vol : candles[candles.length - 1].close;
}

export function highest(values: number[], period: number): number {
  return Math.max(...values.slice(-period));
}

export function lowest(values: number[], period: number): number {
  return Math.min(...values.slice(-period));
}

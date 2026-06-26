import type { StrategyContext } from "./types";
import { neutral, sig } from "./types";
import {
  ema, rsi, macd, bollinger, trendFromCloses, atr, pivotHigh, pivotLow,
  keltner, adx, superTrend, waveTrend, sessionVwap, highest, lowest, sma, volatilityPercent,
} from "@/lib/indicators";

// ── Original 6 (adapted) ─────────────────────────────────────────────────────

export function emaCrossoverStrategy(ctx: StrategyContext) {
  const id = "ema_cross", name = "EMA Crossover";
  const closes = ctx.candles.map((c) => c.close);
  if (closes.length < 30) return neutral(id, name, "Insufficient data");
  const e9 = ema(closes, 9), e21 = ema(closes, 21);
  const i = closes.length - 1, prev = i - 1;
  if (e9[prev] <= e21[prev] && e9[i] > e21[i]) return sig(id, name, "LONG", 72, "EMA9 crossed above EMA21");
  if (e9[prev] >= e21[prev] && e9[i] < e21[i]) return sig(id, name, "SHORT", 72, "EMA9 crossed below EMA21");
  if (e9[i] > e21[i]) return sig(id, name, "LONG", 48, "EMA9 above EMA21");
  return sig(id, name, "SHORT", 48, "EMA9 below EMA21");
}

export function rsiMomentumStrategy(ctx: StrategyContext) {
  const id = "rsi_momentum", name = "RSI Momentum";
  const val = rsi(ctx.candles.map((c) => c.close));
  if (val < 30) return sig(id, name, "LONG", 78, `RSI oversold ${val.toFixed(1)}`);
  if (val > 70) return sig(id, name, "SHORT", 78, `RSI overbought ${val.toFixed(1)}`);
  if (val < 45) return sig(id, name, "LONG", 42, `RSI bullish lean ${val.toFixed(1)}`);
  if (val > 55) return sig(id, name, "SHORT", 42, `RSI bearish lean ${val.toFixed(1)}`);
  return neutral(id, name, `RSI neutral ${val.toFixed(1)}`);
}

export function volumeBreakoutStrategy(ctx: StrategyContext) {
  const id = "volume_breakout", name = "Volume Breakout";
  const c = ctx.candles;
  if (c.length < 25) return neutral(id, name, "Insufficient data");
  const avgVol = c.slice(-20, -1).reduce((s, x) => s + x.volume, 0) / 19;
  const last = c[c.length - 1], prev = c[c.length - 2];
  const move = Math.abs((last.close - prev.close) / prev.close) * 100;
  if (last.volume > avgVol * 1.8 && last.close > prev.close && move > 0.3)
    return sig(id, name, "LONG", 70, `Vol spike +${move.toFixed(2)}%`);
  if (last.volume > avgVol * 1.8 && last.close < prev.close && move > 0.3)
    return sig(id, name, "SHORT", 70, `Vol spike -${move.toFixed(2)}%`);
  return neutral(id, name, "No volume breakout");
}

export function trendAlignmentStrategy(ctx: StrategyContext) {
  const id = "trend_align", name = "Trend Alignment";
  const t = trendFromCloses(ctx.candles.map((c) => c.close));
  if (t === "BULLISH") return sig(id, name, "LONG", 58, "Trend bullish");
  if (t === "BEARISH") return sig(id, name, "SHORT", 58, "Trend bearish");
  return neutral(id, name, "Trend neutral");
}

// ── 24 new strategies ────────────────────────────────────────────────────────

/** 1. Squeeze Momentum — BB 20,2 + KC 20,1.5 + EMA100 filter */
export function squeezeMomentumStrategy(ctx: StrategyContext) {
  const id = "squeeze_momentum", name = "Squeeze Momentum";
  const c = ctx.candles;
  if (c.length < 100) return neutral(id, name, "Need 100 bars");
  const closes = c.map((x) => x.close);
  const bb = bollinger(closes, 20, 2);
  const kc = keltner(c, 20, 1.5);
  const e100 = ema(closes, 100);
  const i = closes.length - 1;
  const squeezed = bb.upper < kc.upper && bb.lower > kc.lower;
  const prevBb = bollinger(closes.slice(0, -1), 20, 2);
  const prevKc = keltner(c.slice(0, -1), 20, 1.5);
  const wasSqueezed = prevBb.upper < prevKc.upper && prevBb.lower > prevKc.lower;
  const release = wasSqueezed && !squeezed;
  const momUp = closes[i] > closes[i - 1] && closes[i] > e100[i];
  const momDown = closes[i] < closes[i - 1] && closes[i] < e100[i];
  if (release && momUp) return sig(id, name, "LONG", 76, "Squeeze release + bullish momentum above EMA100");
  if (release && momDown) return sig(id, name, "SHORT", 76, "Squeeze release + bearish momentum below EMA100");
  if (squeezed) return neutral(id, name, "Squeeze building — wait for release");
  return neutral(id, name, "No squeeze setup");
}

/** 2. MACD Custom — 12/26/9 + histogram slope */
export function macdCustomStrategy(ctx: StrategyContext) {
  const id = "macd_custom", name = "MACD Custom";
  const closes = ctx.candles.map((c) => c.close);
  if (closes.length < 35) return neutral(id, name, "Insufficient data");
  const m = macd(closes);
  const slope = m.histogram - m.prevHistogram;
  const htf = trendFromCloses(closes);
  if (m.prevHistogram <= 0 && m.histogram > 0 && slope > 0) {
    if (htf === "BEARISH") return neutral(id, name, "MACD cross but HTF bearish");
    return sig(id, name, "LONG", 74 + Math.min(15, slope * 500), "MACD bullish cross + rising histogram");
  }
  if (m.prevHistogram >= 0 && m.histogram < 0 && slope < 0) {
    if (htf === "BULLISH") return neutral(id, name, "MACD cross but HTF bullish");
    return sig(id, name, "SHORT", 74 + Math.min(15, Math.abs(slope) * 500), "MACD bearish cross + falling histogram");
  }
  if (m.histogram > 0 && slope > 0) return sig(id, name, "LONG", 52, "MACD histogram rising");
  if (m.histogram < 0 && slope < 0) return sig(id, name, "SHORT", 52, "MACD histogram falling");
  return neutral(id, name, "MACD flat");
}

/** 3. SuperTrend — ATR 10, factor 3 */
export function superTrendStrategy(ctx: StrategyContext) {
  const id = "supertrend", name = "SuperTrend";
  const st = superTrend(ctx.candles, 10, 3);
  const prev = superTrend(ctx.candles.slice(0, -1), 10, 3);
  if (prev.trend === "DOWN" && st.trend === "UP") return sig(id, name, "LONG", 73, "SuperTrend flipped UP");
  if (prev.trend === "UP" && st.trend === "DOWN") return sig(id, name, "SHORT", 73, "SuperTrend flipped DOWN");
  if (st.trend === "UP") return sig(id, name, "LONG", 55, "SuperTrend UP");
  return sig(id, name, "SHORT", 55, "SuperTrend DOWN");
}

/** 4. Trendline Breaks — pivot 5/5 */
export function trendlineBreaksStrategy(ctx: StrategyContext) {
  const id = "trendline_breaks", name = "Trendline Breaks";
  const c = ctx.candles;
  const ph = pivotHigh(c, 5, 5);
  const last = c[c.length - 1];
  const avgVol = sma(c.map((x) => x.volume), 20);
  if (ph && last.close > ph && last.volume > avgVol * 1.2)
    return sig(id, name, "LONG", 71, `Breakout above pivot high ${ph.toFixed(4)} + volume`);
  const pl = pivotLow(c, 5, 5);
  if (pl && last.close < pl && last.volume > avgVol * 1.2)
    return sig(id, name, "SHORT", 71, `Breakdown below pivot low ${pl.toFixed(4)} + volume`);
  return neutral(id, name, "No pivot breakout");
}

/** 5. Williams Vix Fix — volatility spike filter */
export function williamsVixFixStrategy(ctx: StrategyContext) {
  const id = "williams_vix_fix", name = "Williams Vix Fix";
  const c = ctx.candles;
  if (c.length < 25) return neutral(id, name, "Insufficient data");
  const closes = c.map((x) => x.close);
  const highestClose = highest(closes, 22);
  const last = c[c.length - 1];
  const wvf = highestClose > 0 ? ((highestClose - last.low) / highestClose) * 100 : 0;
  if (wvf > 2.0) return sig(id, name, "LONG", 68, `VIX Fix spike ${wvf.toFixed(2)} — reversal zone`);
  if (wvf > 1.5) return sig(id, name, "LONG", 55, `Elevated fear ${wvf.toFixed(2)}`);
  return neutral(id, name, `VVF ${wvf.toFixed(2)} — no spike`);
}

/** 6. UT Bot Alerts — ATR 10, sensitivity 1.5 */
export function utBotStrategy(ctx: StrategyContext) {
  const id = "ut_bot", name = "UT Bot Alerts";
  const c = ctx.candles;
  const atrVal = atr(c, 10);
  const last = c[c.length - 1];
  const prev = c[c.length - 2];
  const sens = 1.5;
  const trailUp = last.close - atrVal * sens;
  const trailDown = last.close + atrVal * sens;
  const trend = trendFromCloses(c.map((x) => x.close));
  if (last.close > prev.close && last.close > trailUp && trend !== "BEARISH")
    return sig(id, name, "LONG", 70, "UT Bot long signal + trend OK");
  if (last.close < prev.close && last.close < trailDown && trend !== "BULLISH")
    return sig(id, name, "SHORT", 70, "UT Bot short signal + trend OK");
  return neutral(id, name, "No UT Bot signal");
}

/** 7. Smart Money Concepts — swing BOS proxy */
export function smcStrategy(ctx: StrategyContext) {
  const id = "smc", name = "Smart Money Concepts";
  const c = ctx.candles;
  if (c.length < 20) return neutral(id, name, "Insufficient data");
  const swingHigh = highest(c.map((x) => x.high), 5);
  const swingLow = lowest(c.map((x) => x.low), 5);
  const last = c[c.length - 1];
  const prevSwingHigh = highest(c.slice(0, -1).map((x) => x.high), 5);
  if (last.close > prevSwingHigh && last.low < swingLow * 1.002)
    return sig(id, name, "LONG", 72, "BOS bullish + liquidity sweep");
  if (last.close < swingLow && last.high > prevSwingHigh * 0.998)
    return sig(id, name, "SHORT", 72, "BOS bearish + liquidity sweep");
  return neutral(id, name, "No SMC structure break");
}

/** 8. WaveTrend — channel 10, avg 21 */
export function waveTrendStrategy(ctx: StrategyContext) {
  const id = "wavetrend", name = "WaveTrend";
  const wt = waveTrend(ctx.candles.map((c) => c.close), 10, 21);
  if (wt.prevWt1 <= wt.prevWt2 && wt.wt1 > wt.wt2 && wt.wt1 < -50)
    return sig(id, name, "LONG", 74, "WaveTrend bullish cross in oversold");
  if (wt.prevWt1 >= wt.prevWt2 && wt.wt1 < wt.wt2 && wt.wt1 > 50)
    return sig(id, name, "SHORT", 74, "WaveTrend bearish cross in overbought");
  if (wt.wt1 > wt.wt2) return sig(id, name, "LONG", 50, "WaveTrend bullish");
  if (wt.wt1 < wt.wt2) return sig(id, name, "SHORT", 50, "WaveTrend bearish");
  return neutral(id, name, "WaveTrend neutral");
}

/** 9. S/R Breaks — pivot 20 */
export function srBreaksStrategy(ctx: StrategyContext) {
  const id = "sr_breaks", name = "S/R Breaks";
  const c = ctx.candles;
  const res = highest(c.map((x) => x.high), 20);
  const sup = lowest(c.map((x) => x.low), 20);
  const last = c[c.length - 1];
  const avgVol = sma(c.map((x) => x.volume), 20);
  if (last.close > res && last.volume > avgVol * 1.3)
    return sig(id, name, "LONG", 70, "Resistance break + volume expansion");
  if (last.close < sup && last.volume > avgVol * 1.3)
    return sig(id, name, "SHORT", 70, "Support break + volume expansion");
  return neutral(id, name, "No S/R break");
}

/** 10. MSB & Order Block */
export function msbOrderBlockStrategy(ctx: StrategyContext) {
  const id = "msb_orderblock", name = "MSB & Order Block";
  const c = ctx.candles;
  if (c.length < 15) return neutral(id, name, "Insufficient data");
  const last = c[c.length - 1];
  const structHigh = highest(c.slice(-10, -1).map((x) => x.high), 5);
  const structLow = lowest(c.slice(-10, -1).map((x) => x.low), 5);
  const ob = c[c.length - 3];
  if (last.close > structHigh && ob.close < ob.open && last.close > ob.high)
    return sig(id, name, "LONG", 73, "MSB bullish + order block reclaim");
  if (last.close < structLow && ob.close > ob.open && last.close < ob.low)
    return sig(id, name, "SHORT", 73, "MSB bearish + order block rejection");
  return neutral(id, name, "No MSB + OB setup");
}

/** 11. ICT Killzones — London/NY session */
export function ictKillzonesStrategy(ctx: StrategyContext) {
  const id = "ict_killzones", name = "ICT Killzones";
  const hour = new Date().getUTCHours();
  const inLondon = hour >= 7 && hour <= 10;
  const inNY = hour >= 13 && hour <= 16;
  if (!inLondon && !inNY) return neutral(id, name, "Outside killzone sessions");
  const trend = trendFromCloses(ctx.candles.map((c) => c.close));
  const session = inLondon ? "London" : "NY";
  if (trend === "BULLISH") return sig(id, name, "LONG", 65, `${session} killzone + bullish bias`);
  if (trend === "BEARISH") return sig(id, name, "SHORT", 65, `${session} killzone + bearish bias`);
  return neutral(id, name, `${session} killzone but no clear trend`);
}

/** 12. Bollinger + RSI — BB 20,2 + RSI 14 30/70 */
export function bbRsiStrategy(ctx: StrategyContext) {
  const id = "bb_rsi", name = "Bollinger + RSI";
  const closes = ctx.candles.map((c) => c.close);
  const bb = bollinger(closes, 20, 2);
  const r = rsi(closes, 14);
  const last = closes[closes.length - 1];
  if (last <= bb.lower && r < 30) return sig(id, name, "LONG", 76, "BB lower + RSI oversold mean-reversion");
  if (last >= bb.upper && r > 70) return sig(id, name, "SHORT", 76, "BB upper + RSI overbought mean-reversion");
  if (bb.percentB < 0.2 && r < 40) return sig(id, name, "LONG", 55, "Near lower band + RSI low");
  if (bb.percentB > 0.8 && r > 60) return sig(id, name, "SHORT", 55, "Near upper band + RSI high");
  return neutral(id, name, "No BB+RSI setup");
}

/** 13. ADX and DI — ADX 14, threshold 20 */
export function adxDiStrategy(ctx: StrategyContext) {
  const id = "adx_di", name = "ADX and DI";
  const { adx: adxVal, plusDI, minusDI } = adx(ctx.candles, 14);
  if (adxVal < 20) return neutral(id, name, `ADX ${adxVal.toFixed(1)} — weak trend`);
  if (plusDI > minusDI && plusDI > 20) return sig(id, name, "LONG", 68 + Math.min(20, adxVal / 2), `+DI > -DI, ADX ${adxVal.toFixed(1)}`);
  if (minusDI > plusDI && minusDI > 20) return sig(id, name, "SHORT", 68 + Math.min(20, adxVal / 2), `-DI > +DI, ADX ${adxVal.toFixed(1)}`);
  return neutral(id, name, "ADX strong but no DI cross");
}

/** 14. S/R Channels — channel 30 */
export function srChannelsStrategy(ctx: StrategyContext) {
  const id = "sr_channels", name = "S/R Channels";
  const c = ctx.candles;
  const upper = highest(c.map((x) => x.high), 30);
  const lower = lowest(c.map((x) => x.low), 30);
  const last = c[c.length - 1];
  const prev = c[c.length - 2];
  if (prev.low <= lower * 1.005 && last.close > last.open && last.close > lower)
    return sig(id, name, "LONG", 68, "Channel support rejection candle");
  if (prev.high >= upper * 0.995 && last.close < last.open && last.close < upper)
    return sig(id, name, "SHORT", 68, "Channel resistance rejection candle");
  return neutral(id, name, "No channel rejection");
}

/** 15. Funding Crowding Fade */
export function fundingCrowdingFadeStrategy(ctx: StrategyContext) {
  const id = "funding_crowding_fade", name = "Funding Crowding Fade";
  const fr = ctx.fundingRate;
  if (fr == null) return neutral(id, name, "No funding data");
  if (fr > 0.0005) return sig(id, name, "SHORT", 72, `Extreme positive funding ${(fr * 100).toFixed(4)}% — fade longs`);
  if (fr < -0.0005) return sig(id, name, "LONG", 72, `Extreme negative funding ${(fr * 100).toFixed(4)}% — fade shorts`);
  return neutral(id, name, `Funding ${(fr * 100).toFixed(4)}% — not extreme`);
}

/** 16. Funding Carry Bias */
export function fundingCarryBiasStrategy(ctx: StrategyContext) {
  const id = "funding_carry_bias", name = "Funding Carry Bias";
  const fr = ctx.fundingRate;
  if (fr == null) return neutral(id, name, "No funding data");
  if (fr > 0.0001) return sig(id, name, "LONG", 58, "Positive funding — long bias");
  if (fr < -0.0001) return sig(id, name, "SHORT", 58, "Negative funding — short bias");
  return neutral(id, name, "Funding neutral");
}

/** 17. Perp Basis Premium */
export function perpBasisPremiumStrategy(ctx: StrategyContext) {
  const id = "perp_basis_premium", name = "Perp Basis Premium";
  const mark = ctx.markPrice, index = ctx.indexPrice;
  if (!mark || !index) return neutral(id, name, "No basis data");
  const basis = ((mark - index) / index) * 100;
  if (basis > 0.15) return sig(id, name, "SHORT", 65, `Premium ${basis.toFixed(3)}% — fade overbought perp`);
  if (basis < -0.15) return sig(id, name, "LONG", 65, `Discount ${basis.toFixed(3)}% — fade oversold perp`);
  return neutral(id, name, `Basis ${basis.toFixed(3)}%`);
}

/** 18. OI + Price Matrix */
export function oiPriceMatrixStrategy(ctx: StrategyContext) {
  const id = "oi_price_matrix", name = "OI + Price Matrix";
  const oi = ctx.openInterest, prev = ctx.prevOpenInterest;
  const c = ctx.candles;
  if (!oi || !prev) return neutral(id, name, "No OI data");
  const oiChg = ((oi - prev) / prev) * 100;
  const priceChg = c.length > 1 ? ((c[c.length - 1].close - c[c.length - 2].close) / c[c.length - 2].close) * 100 : 0;
  if (oiChg > 3 && priceChg > 0) return sig(id, name, "LONG", 70, `OI +${oiChg.toFixed(1)}% with price up`);
  if (oiChg > 3 && priceChg < 0) return sig(id, name, "SHORT", 70, `OI +${oiChg.toFixed(1)}% with price down — shorts adding`);
  if (oiChg < -3 && priceChg > 0) return sig(id, name, "LONG", 62, "Short covering rally");
  return neutral(id, name, `OI ${oiChg.toFixed(1)}% / price ${priceChg.toFixed(2)}%`);
}

/** 19. CVD Divergence — volume delta proxy */
export function cvdDivergenceStrategy(ctx: StrategyContext) {
  const id = "cvd_divergence", name = "CVD Divergence";
  const c = ctx.candles;
  if (c.length < 20) return neutral(id, name, "Insufficient data");
  let cvd = 0;
  const cvdSeries: number[] = [];
  for (const bar of c) {
    const delta = bar.close >= bar.open ? bar.volume : -bar.volume;
    cvd += delta;
    cvdSeries.push(cvd);
  }
  const priceLow = lowest(c.map((x) => x.low), 10);
  const cvdLow = lowest(cvdSeries, 10);
  const last = c[c.length - 1];
  if (last.low <= priceLow * 1.002 && cvd > cvdLow * 1.05)
    return sig(id, name, "LONG", 71, "Bullish CVD divergence");
  const priceHigh = highest(c.map((x) => x.high), 10);
  const cvdHigh = highest(cvdSeries, 10);
  if (last.high >= priceHigh * 0.998 && cvd < cvdHigh * 0.95)
    return sig(id, name, "SHORT", 71, "Bearish CVD divergence");
  return neutral(id, name, "No CVD divergence");
}

/** 20. Liquidation Sweep */
export function liquidationSweepStrategy(ctx: StrategyContext) {
  const id = "liquidation_sweep", name = "Liquidation Sweep";
  const c = ctx.candles;
  const last = c[c.length - 1];
  const swingLow = lowest(c.slice(0, -1).map((x) => x.low), 10);
  const swingHigh = highest(c.slice(0, -1).map((x) => x.high), 10);
  if (last.low < swingLow && last.close > swingLow)
    return sig(id, name, "LONG", 75, "Liquidity sweep below lows + reclaim");
  if (last.high > swingHigh && last.close < swingHigh)
    return sig(id, name, "SHORT", 75, "Liquidity sweep above highs + rejection");
  return neutral(id, name, "No liquidity sweep");
}

/** 21. Regime Switch */
export function regimeSwitchStrategy(ctx: StrategyContext) {
  const id = "regime_switch", name = "Regime Switch";
  const vol = volatilityPercent(ctx.candles);
  const trend = trendFromCloses(ctx.candles.map((c) => c.close));
  if (vol > 2.5 && trend !== "NEUTRAL") {
    return sig(id, name, trend === "BULLISH" ? "LONG" : "SHORT", 66, `Trend regime — vol ${vol.toFixed(2)}%`);
  }
  if (vol < 1.2) {
    const r = rsi(ctx.candles.map((c) => c.close));
    if (r < 35) return sig(id, name, "LONG", 60, "Mean-reversion regime — RSI low");
    if (r > 65) return sig(id, name, "SHORT", 60, "Mean-reversion regime — RSI high");
  }
  return neutral(id, name, `Regime unclear — vol ${vol.toFixed(2)}%`);
}

/** 22. VWAP Session */
export function vwapSessionStrategy(ctx: StrategyContext) {
  const id = "vwap_session", name = "VWAP Session";
  const vwap = sessionVwap(ctx.candles);
  const last = ctx.candles[ctx.candles.length - 1];
  const dist = ((last.close - vwap) / vwap) * 100;
  if (last.close > vwap && dist < 1) return sig(id, name, "LONG", 64, `Price above VWAP (${dist.toFixed(2)}%)`);
  if (last.close < vwap && dist > -1) return sig(id, name, "SHORT", 64, `Price below VWAP (${dist.toFixed(2)}%)`);
  return neutral(id, name, `VWAP dist ${dist.toFixed(2)}%`);
}

/** 23. BTC Relative Strength */
export function btcRelativeStrengthStrategy(ctx: StrategyContext) {
  const id = "btc_relative_strength", name = "BTC Relative Strength";
  const btc = ctx.btcChange24h;
  const alt = ctx.ticker?.change24h;
  if (btc == null || alt == null) return neutral(id, name, "No relative data");
  const rs = alt - btc;
  if (rs > 2 && alt > 0) return sig(id, name, "LONG", 68, `Outperforming BTC by ${rs.toFixed(2)}%`);
  if (rs < -2 && alt < 0) return sig(id, name, "SHORT", 68, `Underperforming BTC by ${Math.abs(rs).toFixed(2)}%`);
  return neutral(id, name, `RS vs BTC ${rs.toFixed(2)}%`);
}

/** 24. Flush + CVD Breakout */
export function flushCvdBreakoutStrategy(ctx: StrategyContext) {
  const id = "flush_cvd_breakout", name = "Flush + CVD Breakout";
  const c = ctx.candles;
  if (c.length < 15) return neutral(id, name, "Insufficient data");
  const last = c[c.length - 1];
  const drop = ((last.low - c[c.length - 5].close) / c[c.length - 5].close) * 100;
  let buyVol = 0, sellVol = 0;
  for (let i = c.length - 5; i < c.length; i++) {
    if (c[i].close >= c[i].open) buyVol += c[i].volume;
    else sellVol += c[i].volume;
  }
  if (drop < -2 && buyVol > sellVol * 1.3 && last.close > last.open)
    return sig(id, name, "LONG", 74, `Flush ${drop.toFixed(1)}% + CVD breakout`);
  return neutral(id, name, "No flush + CVD setup");
}

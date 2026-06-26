import type { StrategyFn } from "./types";
import {
  emaCrossoverStrategy, rsiMomentumStrategy, volumeBreakoutStrategy, trendAlignmentStrategy,
  squeezeMomentumStrategy, macdCustomStrategy, superTrendStrategy, trendlineBreaksStrategy,
  williamsVixFixStrategy, utBotStrategy, smcStrategy, waveTrendStrategy, srBreaksStrategy,
  msbOrderBlockStrategy, ictKillzonesStrategy, bbRsiStrategy, adxDiStrategy, srChannelsStrategy,
  fundingCrowdingFadeStrategy, fundingCarryBiasStrategy, perpBasisPremiumStrategy,
  oiPriceMatrixStrategy, cvdDivergenceStrategy, liquidationSweepStrategy, regimeSwitchStrategy,
  vwapSessionStrategy, btcRelativeStrengthStrategy, flushCvdBreakoutStrategy,
} from "./advanced";

export const STRATEGY_REGISTRY: { id: string; name: string; fn: StrategyFn }[] = [
  { id: "ema_cross", name: "EMA Crossover", fn: emaCrossoverStrategy },
  { id: "rsi_momentum", name: "RSI Momentum", fn: rsiMomentumStrategy },
  { id: "macd_custom", name: "MACD Custom", fn: macdCustomStrategy },
  { id: "volume_breakout", name: "Volume Breakout", fn: volumeBreakoutStrategy },
  { id: "trend_align", name: "Trend Alignment", fn: trendAlignmentStrategy },
  { id: "squeeze_momentum", name: "Squeeze Momentum", fn: squeezeMomentumStrategy },
  { id: "supertrend", name: "SuperTrend", fn: superTrendStrategy },
  { id: "trendline_breaks", name: "Trendline Breaks", fn: trendlineBreaksStrategy },
  { id: "williams_vix_fix", name: "Williams Vix Fix", fn: williamsVixFixStrategy },
  { id: "ut_bot", name: "UT Bot Alerts", fn: utBotStrategy },
  { id: "smc", name: "Smart Money Concepts", fn: smcStrategy },
  { id: "wavetrend", name: "WaveTrend", fn: waveTrendStrategy },
  { id: "sr_breaks", name: "S/R Breaks", fn: srBreaksStrategy },
  { id: "msb_orderblock", name: "MSB & Order Block", fn: msbOrderBlockStrategy },
  { id: "ict_killzones", name: "ICT Killzones", fn: ictKillzonesStrategy },
  { id: "bb_rsi", name: "Bollinger + RSI", fn: bbRsiStrategy },
  { id: "adx_di", name: "ADX and DI", fn: adxDiStrategy },
  { id: "sr_channels", name: "S/R Channels", fn: srChannelsStrategy },
  { id: "funding_crowding_fade", name: "Funding Crowding Fade", fn: fundingCrowdingFadeStrategy },
  { id: "funding_carry_bias", name: "Funding Carry Bias", fn: fundingCarryBiasStrategy },
  { id: "perp_basis_premium", name: "Perp Basis Premium", fn: perpBasisPremiumStrategy },
  { id: "oi_price_matrix", name: "OI + Price Matrix", fn: oiPriceMatrixStrategy },
  { id: "cvd_divergence", name: "CVD Divergence", fn: cvdDivergenceStrategy },
  { id: "liquidation_sweep", name: "Liquidation Sweep", fn: liquidationSweepStrategy },
  { id: "regime_switch", name: "Regime Switch", fn: regimeSwitchStrategy },
  { id: "vwap_session", name: "VWAP Session", fn: vwapSessionStrategy },
  { id: "btc_relative_strength", name: "BTC Relative Strength", fn: btcRelativeStrengthStrategy },
  { id: "flush_cvd_breakout", name: "Flush + CVD Breakout", fn: flushCvdBreakoutStrategy },
];

export const ALL_STRATEGIES = STRATEGY_REGISTRY.map((s) => s.fn);

export function runAllStrategies(ctx: import("./types").StrategyContext) {
  return STRATEGY_REGISTRY.map(({ id, name, fn }) => {
    const result = fn(ctx);
    return { ...result, id, name };
  });
}

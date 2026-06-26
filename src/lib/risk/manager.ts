import type {
  Candle,
  Position,
  PositionStatus,
  RiskSettings,
  ScanSignal,
  TradeDirection,
  WalletState,
} from "@/types/trading";
import { calcMargin } from "@/lib/wallet";

export function calcLiquidationPrice(
  entry: number,
  direction: TradeDirection,
  leverage: number
): number {
  const margin = 1 / leverage;
  if (direction === "LONG") return entry * (1 - margin * 0.9);
  return entry * (1 + margin * 0.9);
}

export function calcTpSl(
  entry: number,
  direction: TradeDirection,
  volatility: number
): { tp: number; sl: number } {
  const move = Math.max(0.8, Math.min(3, volatility * 0.4));
  if (direction === "LONG") {
    return { tp: entry * (1 + move / 100), sl: entry * (1 - move / 100 * 0.6) };
  }
  return { tp: entry * (1 - move / 100), sl: entry * (1 + move / 100 * 0.6) };
}

export function calcPnl(
  entry: number,
  current: number,
  direction: TradeDirection,
  leverage: number,
  marginUsed: number
): { pnlPercent: number; pnlUsd: number } {
  const raw = direction === "LONG"
    ? (current - entry) / entry
    : (entry - current) / entry;
  const pnlPercent = raw * leverage * 100;
  const pnlUsd = raw * leverage * marginUsed;
  return { pnlPercent: +pnlPercent.toFixed(4), pnlUsd: +pnlUsd.toFixed(4) };
}

export function canOpenPosition(
  risk: RiskSettings,
  openCount: number,
  signal: ScanSignal,
  wallet: WalletState
): { ok: boolean; reason?: string } {
  if (risk.killSwitch) return { ok: false, reason: "Kill switch active" };
  if (openCount >= risk.maxOpenPositions) return { ok: false, reason: "Max positions reached" };
  if (signal.confidence < risk.minConfidence) return { ok: false, reason: "Below min confidence" };
  if (signal.spread > risk.maxSpreadPercent) return { ok: false, reason: "Spread too wide" };
  if (signal.quoteVolume24h < risk.minVolume24h) return { ok: false, reason: "Low liquidity" };
  if (risk.dailyLossUsd >= risk.dailyLossLimitUsd) return { ok: false, reason: "Daily loss limit hit" };
  if (risk.lastLossAt) {
    const cooldownMs = risk.cooldownMinutes * 60_000;
    if (Date.now() - risk.lastLossAt < cooldownMs) return { ok: false, reason: "Cooldown after loss" };
  }
  if (signal.newsScore < 35) return { ok: false, reason: `High news risk (score ${signal.newsScore})` };
  const marginNeeded = calcMargin(wallet.balance, risk.positionSizePercent);
  if (wallet.availableMargin < marginNeeded) return { ok: false, reason: `Insufficient margin (need $${marginNeeded.toFixed(2)})` };
  return { ok: true };
}

export function updatePositionPrices(
  positions: Position[],
  prices: Record<string, number>
): Position[] {
  return positions.map((p) => {
    if (p.status !== "OPEN") return p;
    const current = prices[p.symbol] ?? p.currentPrice;
    const { pnlPercent, pnlUsd } = calcPnl(
      p.entryPrice, current, p.direction, p.leverage, p.marginUsed
    );
    return { ...p, currentPrice: current, pnlPercent, pnlUsd };
  });
}

/** Check TP/SL using candle high/low for realistic fill simulation */
export function checkExits(
  positions: Position[],
  candles?: Record<string, Candle>
): { updated: Position[]; closed: Position[] } {
  const updated: Position[] = [];
  const closed: Position[] = [];

  for (const p of positions) {
    if (p.status !== "OPEN") {
      updated.push(p);
      continue;
    }

    const candle = candles?.[p.symbol];
    const high = candle?.high ?? p.currentPrice;
    const low = candle?.low ?? p.currentPrice;
    const close = candle?.close ?? p.currentPrice;

    let status: PositionStatus = "OPEN";
    let exitPrice = close;
    let exitReason = "";

    if (p.direction === "LONG") {
      if (low <= p.liquidationPrice) {
        status = "LIQUIDATED"; exitPrice = p.liquidationPrice; exitReason = "Liquidation hit";
      } else if (low <= p.stopLoss) {
        status = "CLOSED_SL"; exitPrice = p.stopLoss; exitReason = "Stop loss hit (candle low)";
      } else if (high >= p.takeProfit) {
        status = "CLOSED_TP"; exitPrice = p.takeProfit; exitReason = "Take profit hit (candle high)";
      }
    } else {
      if (high >= p.liquidationPrice) {
        status = "LIQUIDATED"; exitPrice = p.liquidationPrice; exitReason = "Liquidation hit";
      } else if (high >= p.stopLoss) {
        status = "CLOSED_SL"; exitPrice = p.stopLoss; exitReason = "Stop loss hit (candle high)";
      } else if (low <= p.takeProfit) {
        status = "CLOSED_TP"; exitPrice = p.takeProfit; exitReason = "Take profit hit (candle low)";
      }
    }

    if (status !== "OPEN") {
      const { pnlPercent, pnlUsd } = calcPnl(
        p.entryPrice, exitPrice, p.direction, p.leverage, p.marginUsed
      );
      closed.push({
        ...p, status, closedAt: Date.now(), closedPrice: exitPrice,
        currentPrice: exitPrice, pnlPercent, pnlUsd, exitReason,
      });
    } else {
      const { pnlPercent, pnlUsd } = calcPnl(
        p.entryPrice, close, p.direction, p.leverage, p.marginUsed
      );
      updated.push({ ...p, currentPrice: close, pnlPercent, pnlUsd });
    }
  }
  return { updated, closed };
}

export function openPaperPosition(
  signal: ScanSignal,
  risk: RiskSettings,
  wallet: WalletState,
  signalDetectedAt: number,
  executedAt: number
): Position {
  const marginUsed = calcMargin(wallet.balance, risk.positionSizePercent);
  const leverage = risk.maxLeverage;
  const notionalValue = marginUsed * leverage;
  const { tp, sl } = calcTpSl(signal.price, signal.direction, signal.volatility);

  return {
    id: `${signal.symbol}-${executedAt}`,
    symbol: signal.symbol,
    direction: signal.direction,
    entryPrice: signal.price,
    currentPrice: signal.price,
    leverage,
    marginUsed,
    notionalValue,
    takeProfit: tp,
    stopLoss: sl,
    liquidationPrice: calcLiquidationPrice(signal.price, signal.direction, leverage),
    pnlPercent: 0,
    pnlUsd: 0,
    confidence: signal.confidence,
    confidenceBreakdown: signal.confidenceBreakdown,
    strategies: signal.strategies
      .filter((s) => s.direction === signal.direction)
      .map((s) => s.name),
    status: "OPEN",
    openedAt: executedAt,
    mode: "PAPER",
    signalDetectedAt,
    executedAt,
    executionLatencyMs: executedAt - signalDetectedAt,
  };
}

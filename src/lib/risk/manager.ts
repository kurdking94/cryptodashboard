import type { Position, PositionStatus, RiskSettings, ScanSignal, TradeDirection } from "@/types/trading";

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
  sizeUsd: number
): { pnlPercent: number; pnlUsd: number } {
  const raw = direction === "LONG"
    ? (current - entry) / entry
    : (entry - current) / entry;
  const pnlPercent = raw * leverage * 100;
  const pnlUsd = raw * leverage * sizeUsd;
  return { pnlPercent: +pnlPercent.toFixed(4), pnlUsd: +pnlUsd.toFixed(4) };
}

export function canOpenPosition(
  risk: RiskSettings,
  openCount: number,
  signal: ScanSignal
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
  if (signal.newsScore < 35) return { ok: false, reason: "High news risk" };
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
      p.entryPrice, current, p.direction, p.leverage, p.size
    );
    return { ...p, currentPrice: current, pnlPercent, pnlUsd };
  });
}

export function checkExits(positions: Position[]): {
  updated: Position[];
  closed: Position[];
} {
  const updated: Position[] = [];
  const closed: Position[] = [];

  for (const p of positions) {
    if (p.status !== "OPEN") {
      updated.push(p);
      continue;
    }
    const price = p.currentPrice;
    let status: PositionStatus = p.status;
    let closedPrice = p.closedPrice;

    if (p.direction === "LONG") {
      if (price >= p.takeProfit) { status = "CLOSED_TP"; closedPrice = price; }
      else if (price <= p.stopLoss) { status = "CLOSED_SL"; closedPrice = price; }
      else if (price <= p.liquidationPrice) { status = "LIQUIDATED"; closedPrice = price; }
    } else {
      if (price <= p.takeProfit) { status = "CLOSED_TP"; closedPrice = price; }
      else if (price >= p.stopLoss) { status = "CLOSED_SL"; closedPrice = price; }
      else if (price >= p.liquidationPrice) { status = "LIQUIDATED"; closedPrice = price; }
    }

    if (status !== "OPEN") {
      const { pnlPercent, pnlUsd } = calcPnl(
        p.entryPrice, closedPrice!, p.direction, p.leverage, p.size
      );
      closed.push({
        ...p, status, closedAt: Date.now(), closedPrice,
        pnlPercent, pnlUsd,
      });
    } else {
      updated.push(p);
    }
  }
  return { updated, closed };
}

export function openPaperPosition(
  signal: ScanSignal,
  risk: RiskSettings
): Position {
  const { tp, sl } = calcTpSl(signal.price, signal.direction, signal.volatility);
  return {
    id: `${signal.symbol}-${Date.now()}`,
    symbol: signal.symbol,
    direction: signal.direction,
    entryPrice: signal.price,
    currentPrice: signal.price,
    leverage: Math.min(risk.maxLeverage, 10),
    size: risk.positionSizeUsd,
    takeProfit: tp,
    stopLoss: sl,
    liquidationPrice: calcLiquidationPrice(signal.price, signal.direction, risk.maxLeverage),
    pnlPercent: 0,
    pnlUsd: 0,
    confidence: signal.confidence,
    strategies: signal.strategies
      .filter((s) => s.direction === signal.direction)
      .map((s) => s.name),
    status: "OPEN",
    openedAt: Date.now(),
    mode: "PAPER",
  };
}

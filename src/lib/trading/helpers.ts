import { v4 as uuidv4 } from "uuid";
import { STRATEGY_REGISTRY } from "@/lib/strategies";
import { calcTpLevels } from "@/lib/risk/manager";
import type { AnalyzedSignal, BotLog, LogCategory, Position, ScanSignal, StrategyHealth } from "@/types/trading";

export function migrateScanSignal(signal: ScanSignal | (Omit<ScanSignal, "id" | "scanId" | "takeProfits" | "stopLoss"> & Partial<Pick<ScanSignal, "id" | "scanId" | "takeProfits" | "stopLoss">>)): ScanSignal {
  const price = signal.price ?? 0;
  const direction = signal.direction ?? "LONG";
  const volatility = signal.volatility ?? 2;
  const levels = signal.takeProfits && signal.stopLoss != null
    ? { takeProfits: signal.takeProfits, stopLoss: signal.stopLoss }
    : calcTpLevels(price, direction, volatility);

  return {
    ...(signal as ScanSignal),
    id: signal.id ?? uuidv4(),
    scanId: signal.scanId ?? `legacy-${signal.scannedAt ?? Date.now()}`,
    takeProfits: levels.takeProfits,
    stopLoss: levels.stopLoss,
  };
}

export function enrichScanSignal(signal: AnalyzedSignal, scanId: string): ScanSignal {
  return migrateScanSignal({ ...signal, scanId, id: uuidv4() });
}

export function migratePosition(p: Position): Position {
  if (p.takeProfits) return p;
  const { takeProfits, stopLoss } = calcTpLevels(p.entryPrice, p.direction, 2);
  return {
    ...p,
    takeProfits: p.takeProfit != null ? { ...takeProfits, tp3: p.takeProfit } : takeProfits,
    stopLoss: p.stopLoss ?? stopLoss,
  };
}

export function createLog(
  level: BotLog["level"],
  category: LogCategory,
  message: string,
  meta?: Record<string, unknown>
): BotLog {
  return { id: uuidv4(), timestamp: Date.now(), level, category, message, meta };
}

export const INITIAL_STRATEGY_HEALTH: StrategyHealth[] = STRATEGY_REGISTRY.map((s) => ({
  id: s.id,
  name: s.name,
  enabled: !["funding_carry_bias", "williams_vix_fix"].includes(s.id),
  winRate: 0,
  avgWin: 0,
  avgLoss: 0,
  profitFactor: 0,
  maxDrawdown: 0,
  totalTrades: 0,
  wins: 0,
  losses: 0,
  avgRR: 0,
}));

export function updateStrategyHealth(
  health: StrategyHealth[],
  closedTrade: { strategies: string[]; pnlUsd: number; entryPrice: number; stopLoss: number; closedPrice?: number }
): StrategyHealth[] {
  return health.map((h) => {
    if (!closedTrade.strategies.includes(h.name)) return h;
    const win = closedTrade.pnlUsd > 0;
    const wins = h.wins + (win ? 1 : 0);
    const losses = h.losses + (win ? 0 : 1);
    const total = wins + losses;
    const avgWin = win
      ? (h.avgWin * h.wins + closedTrade.pnlUsd) / Math.max(1, wins)
      : h.avgWin;
    const avgLoss = !win
      ? (h.avgLoss * h.losses + Math.abs(closedTrade.pnlUsd)) / Math.max(1, losses)
      : h.avgLoss;
    const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses || 1) : 0;
    const risk = Math.abs(closedTrade.entryPrice - closedTrade.stopLoss) / closedTrade.entryPrice;
    const reward = closedTrade.closedPrice
      ? Math.abs(closedTrade.closedPrice - closedTrade.entryPrice) / closedTrade.entryPrice
      : 0;
    const rr = risk > 0 ? reward / risk : 0;
    const avgRR = total > 0 ? (h.avgRR * (total - 1) + rr) / total : rr;

    return {
      ...h,
      wins, losses, totalTrades: total,
      winRate: total > 0 ? (wins / total) * 100 : 0,
      avgWin: +avgWin.toFixed(4),
      avgLoss: +avgLoss.toFixed(4),
      profitFactor: +profitFactor.toFixed(2),
      maxDrawdown: !win ? Math.max(h.maxDrawdown, Math.abs(closedTrade.pnlUsd)) : h.maxDrawdown,
      avgRR: +avgRR.toFixed(2),
    };
  });
}

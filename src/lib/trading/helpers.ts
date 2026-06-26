import { v4 as uuidv4 } from "uuid";
import type { BotLog, StrategyHealth } from "@/types/trading";

export function createLog(
  level: BotLog["level"],
  message: string,
  meta?: Record<string, unknown>
): BotLog {
  return { id: uuidv4(), timestamp: Date.now(), level, message, meta };
}

export const INITIAL_STRATEGY_HEALTH: StrategyHealth[] = [
  { id: "ema_cross", name: "EMA Crossover", enabled: true, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, maxDrawdown: 0, totalTrades: 0, wins: 0, losses: 0 },
  { id: "rsi_momentum", name: "RSI Momentum", enabled: true, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, maxDrawdown: 0, totalTrades: 0, wins: 0, losses: 0 },
  { id: "macd", name: "MACD", enabled: true, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, maxDrawdown: 0, totalTrades: 0, wins: 0, losses: 0 },
  { id: "volume_breakout", name: "Volume Breakout", enabled: true, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, maxDrawdown: 0, totalTrades: 0, wins: 0, losses: 0 },
  { id: "bollinger", name: "Bollinger Bands", enabled: true, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, maxDrawdown: 0, totalTrades: 0, wins: 0, losses: 0 },
  { id: "trend_align", name: "Trend Alignment", enabled: true, winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, maxDrawdown: 0, totalTrades: 0, wins: 0, losses: 0 },
];

export function updateStrategyHealth(
  health: StrategyHealth[],
  closedTrade: { strategies: string[]; pnlUsd: number }
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
    return {
      ...h,
      wins, losses, totalTrades: total,
      winRate: total > 0 ? (wins / total) * 100 : 0,
      avgWin: +avgWin.toFixed(2),
      avgLoss: +avgLoss.toFixed(2),
      profitFactor: +profitFactor.toFixed(2),
      maxDrawdown: !win ? Math.max(h.maxDrawdown, Math.abs(closedTrade.pnlUsd)) : h.maxDrawdown,
    };
  });
}

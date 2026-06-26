import type { PaperScoreboard, Position } from "@/types/trading";

export function computeScoreboard(closed: Position[]): PaperScoreboard {
  if (closed.length === 0) {
    return {
      winRate: 0, profitFactor: 0, maxDrawdown: 0, avgRR: 0,
      totalTrades: 0, wins: 0, losses: 0, avgWin: 0, avgLoss: 0,
      expectancy: 0, totalPnl: 0,
    };
  }

  const wins = closed.filter((p) => p.pnlUsd > 0);
  const losses = closed.filter((p) => p.pnlUsd <= 0);
  const totalPnl = closed.reduce((s, p) => s + p.pnlUsd, 0);
  const avgWin = wins.length ? wins.reduce((s, p) => s + p.pnlUsd, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, p) => s + p.pnlUsd, 0) / losses.length) : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length || 1) : wins.length > 0 ? 99 : 0;

  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  for (const p of closed) {
    cumulative += p.pnlUsd;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
  }

  const rrRatios = closed.map((p) => {
    const risk = Math.abs(p.entryPrice - p.stopLoss) / p.entryPrice;
    const reward = Math.abs(p.closedPrice! - p.entryPrice) / p.entryPrice;
    return risk > 0 ? reward / risk : 0;
  });
  const avgRR = rrRatios.length ? rrRatios.reduce((a, b) => a + b, 0) / rrRatios.length : 0;
  const winRate = (wins.length / closed.length) * 100;
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

  return {
    winRate: +winRate.toFixed(2),
    profitFactor: +profitFactor.toFixed(2),
    maxDrawdown: +maxDrawdown.toFixed(4),
    avgRR: +avgRR.toFixed(2),
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    avgWin: +avgWin.toFixed(4),
    avgLoss: +avgLoss.toFixed(4),
    expectancy: +expectancy.toFixed(4),
    totalPnl: +totalPnl.toFixed(4),
  };
}

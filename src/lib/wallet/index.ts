import type { Position, WalletState } from "@/types/trading";

export function calcMargin(balance: number, percent: number): number {
  return +(balance * (percent / 100)).toFixed(4);
}

export function buildWallet(
  balance: number,
  initialBalance: number,
  openPositions: Position[]
): WalletState {
  const usedMargin = openPositions.reduce((s, p) => s + p.marginUsed, 0);
  const unrealizedPnl = openPositions.reduce((s, p) => s + p.pnlUsd, 0);
  const equity = balance + unrealizedPnl;
  const availableMargin = Math.max(0, balance - usedMargin);
  return {
    balance: +balance.toFixed(4),
    initialBalance,
    usedMargin: +usedMargin.toFixed(4),
    unrealizedPnl: +unrealizedPnl.toFixed(4),
    equity: +equity.toFixed(4),
    availableMargin: +availableMargin.toFixed(4),
  };
}

export function canAffordMargin(wallet: WalletState, marginNeeded: number): boolean {
  return wallet.availableMargin >= marginNeeded;
}

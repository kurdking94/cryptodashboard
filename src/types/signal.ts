export type SignalDirection = "LONG" | "SHORT";
export type SignalStatus = "ACTIVE" | "CLOSED" | "CANCELLED";

export interface Signal {
  id: string;
  symbol: string;           // e.g. "BTCUSDT"
  direction: SignalDirection;
  /** Price at the exact moment the signal was added — never changes */
  entryPrice: number;
  /** Optional take-profit level (display only, NOT used for PnL) */
  takeProfit?: number;
  /** Optional stop-loss level */
  stopLoss?: number;
  leverage: number;
  status: SignalStatus;
  addedAt: number;           // Unix ms timestamp
  closedAt?: number;
  closedPrice?: number;
  note?: string;
}

/**
 * Computed view model — calculated fresh on every price tick.
 * PnL is ALWAYS relative to entryPrice, so a brand-new signal
 * starts at exactly 0 % profit.
 */
export interface SignalWithPnl extends Signal {
  currentPrice: number;
  pnlPercent: number;        // (currentPrice - entryPrice) / entryPrice * 100 * direction
  pnlUsd: number;            // assumes 1 contract / 1 unit position
  priceChange24h?: number;   // % change from 24-hour Binance ticker
}

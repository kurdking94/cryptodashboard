export type BotMode = "OFF" | "PAPER" | "LIVE";
export type TradeDirection = "LONG" | "SHORT";
export type PositionStatus = "OPEN" | "CLOSED_TP" | "CLOSED_SL" | "CLOSED_MANUAL" | "LIQUIDATED";
export type TrendBias = "BULLISH" | "BEARISH" | "NEUTRAL";
export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h";

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketTicker {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  quoteVolume24h: number;
  high24h: number;
  low24h: number;
  spread: number;
  volatility: number;
}

export interface StrategyResult {
  id: string;
  name: string;
  direction: TradeDirection | "NEUTRAL";
  confidence: number;
  reason: string;
  enabled: boolean;
}

export interface StrategyHealth {
  id: string;
  name: string;
  enabled: boolean;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  totalTrades: number;
  wins: number;
  losses: number;
}

export interface ScanSignal {
  symbol: string;
  direction: TradeDirection;
  confidence: number;
  price: number;
  change24h: number;
  volume24h: number;
  quoteVolume24h: number;
  spread: number;
  volatility: number;
  strategies: StrategyResult[];
  agreeingStrategies: number;
  totalStrategies: number;
  timeframes: Record<Timeframe, TrendBias>;
  newsScore: number;
  whaleScore: number;
  volumeConfirmation: number;
  scannedAt: number;
}

export interface Position {
  id: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  size: number;
  takeProfit: number;
  stopLoss: number;
  liquidationPrice: number;
  pnlPercent: number;
  pnlUsd: number;
  confidence: number;
  strategies: string[];
  status: PositionStatus;
  openedAt: number;
  closedAt?: number;
  closedPrice?: number;
  mode: BotMode;
}

export interface RiskSettings {
  maxLeverage: number;
  maxOpenPositions: number;
  positionSizeUsd: number;
  dailyLossLimitUsd: number;
  dailyLossUsd: number;
  cooldownMinutes: number;
  lastLossAt?: number;
  killSwitch: boolean;
  minConfidence: number;
  maxSpreadPercent: number;
  minVolume24h: number;
}

export interface BotLog {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error" | "trade" | "signal";
  message: string;
  meta?: Record<string, unknown>;
}

export interface BotState {
  mode: BotMode;
  isScanning: boolean;
  lastScanAt?: number;
  scanLatencyMs: number;
  pairsScanned: number;
  signals: ScanSignal[];
  positions: Position[];
  closedPositions: Position[];
  replacementQueue: ScanSignal[];
  risk: RiskSettings;
  strategyHealth: StrategyHealth[];
  logs: BotLog[];
  totalPnlUsd: number;
  paperBalance: number;
}

export const DEFAULT_RISK: RiskSettings = {
  maxLeverage: 10,
  maxOpenPositions: 5,
  positionSizeUsd: 100,
  dailyLossLimitUsd: 500,
  dailyLossUsd: 0,
  cooldownMinutes: 15,
  killSwitch: false,
  minConfidence: 65,
  maxSpreadPercent: 0.15,
  minVolume24h: 5_000_000,
};

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h"];

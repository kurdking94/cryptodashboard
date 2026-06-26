export type BotMode = "OFF" | "PAPER" | "LIVE";
export type TradeDirection = "LONG" | "SHORT";
export type PositionStatus = "OPEN" | "CLOSED_TP" | "CLOSED_SL" | "CLOSED_MANUAL" | "LIQUIDATED";
export type TrendBias = "BULLISH" | "BEARISH" | "NEUTRAL";
/** Timeframes used for multi-TF strategy scans */
export type ScanTimeframe = "45m" | "1h" | "4h";
export type Timeframe = ScanTimeframe;
export type LogCategory = "execution" | "confidence" | "error" | "signal" | "system";

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
  timeframe?: ScanTimeframe;
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
  avgRR: number;
}

export interface ConfidenceBreakdown {
  strategyAvg: number;
  agreementBonus: number;
  volumeBonus: number;
  whaleBonus: number;
  newsMultiplier: number;
  newsPenalty: number;
  raw: number;
  final: number;
}

export interface TakeProfitLevels {
  tp1: number;
  tp2: number;
  tp3: number;
  tp4: number;
}

export interface ScanSignal {
  id: string;
  scanId: string;
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
  confidenceBreakdown: ConfidenceBreakdown;
  rankingReason: string;
  takeProfits: TakeProfitLevels;
  stopLoss: number;
}

/** Signal from analyzer before TP levels and IDs are attached */
export type AnalyzedSignal = Omit<ScanSignal, "id" | "scanId" | "takeProfits" | "stopLoss">;

export interface Position {
  id: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  /** Margin/collateral allocated (5% of balance at entry) */
  marginUsed: number;
  /** Notional = margin × leverage */
  notionalValue: number;
  takeProfits: TakeProfitLevels;
  stopLoss: number;
  /** @deprecated legacy — use takeProfits.tp3 */
  takeProfit?: number;
  liquidationPrice: number;
  pnlPercent: number;
  pnlUsd: number;
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  strategies: string[];
  status: PositionStatus;
  openedAt: number;
  closedAt?: number;
  closedPrice?: number;
  mode: BotMode;
  signalDetectedAt: number;
  executedAt: number;
  executionLatencyMs: number;
  exitReason?: string;
}

export interface RiskSettings {
  maxLeverage: number;
  maxOpenPositions: number;
  /** Percent of wallet balance per trade (e.g. 5 = 5%) */
  positionSizePercent: number;
  initialBalance: number;
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
  category: LogCategory;
  message: string;
  meta?: Record<string, unknown>;
}

export interface ConfidenceLogEntry {
  id: string;
  timestamp: number;
  symbol: string;
  rank: number;
  confidence: number;
  direction: TradeDirection;
  breakdown: ConfidenceBreakdown;
  agreeing: string[];
  blocked?: string;
  rankingReason: string;
}

export interface WalletState {
  balance: number;
  initialBalance: number;
  usedMargin: number;
  unrealizedPnl: number;
  equity: number;
  availableMargin: number;
}

export interface PaperScoreboard {
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  avgRR: number;
  totalTrades: number;
  wins: number;
  losses: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  totalPnl: number;
}

export interface ValidationChecks {
  liveSignals: boolean;
  confidenceRanking: boolean;
  correctEntry: boolean;
  correctExit: boolean;
  replacement: boolean;
}

export interface BotState {
  mode: BotMode;
  isScanning: boolean;
  lastScanAt?: number;
  scanLatencyMs: number;
  lastExecutionLatencyMs: number;
  pairsScanned: number;
  /** Latest scan results only */
  signals: ScanSignal[];
  /** Append-only history — never cleared on new scans */
  signalHistory: ScanSignal[];
  positions: Position[];
  closedPositions: Position[];
  replacementQueue: ScanSignal[];
  risk: RiskSettings;
  strategyHealth: StrategyHealth[];
  logs: BotLog[];
  confidenceLog: ConfidenceLogEntry[];
  wallet: WalletState;
  scoreboard: PaperScoreboard;
  validation: ValidationChecks;
  lastReplacementAt?: number;
}

export const INITIAL_BALANCE = 100;

export const DEFAULT_RISK: RiskSettings = {
  maxLeverage: 20,
  maxOpenPositions: 5,
  positionSizePercent: 5,
  initialBalance: INITIAL_BALANCE,
  dailyLossLimitUsd: 25,
  dailyLossUsd: 0,
  cooldownMinutes: 5,
  killSwitch: false,
  minConfidence: 50,
  maxSpreadPercent: 0.15,
  minVolume24h: 5_000_000,
};

export const TIMEFRAMES: Timeframe[] = ["45m", "1h", "4h"];

/** Top USDT perpetual pairs analyzed each market scan */
export const SCAN_PAIR_COUNT = 100;

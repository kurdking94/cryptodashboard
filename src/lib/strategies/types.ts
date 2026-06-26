import type { Candle, MarketTicker } from "@/types/trading";

export interface StrategyContext {
  candles: Candle[];
  ticker?: MarketTicker;
  fundingRate?: number;
  openInterest?: number;
  prevOpenInterest?: number;
  markPrice?: number;
  indexPrice?: number;
  btcChange24h?: number;
}

export interface StrategyResult {
  id: string;
  name: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  confidence: number;
  reason: string;
  enabled: boolean;
}

export type StrategyFn = (ctx: StrategyContext) => StrategyResult;

export function neutral(id: string, name: string, reason: string): StrategyResult {
  return { id, name, direction: "NEUTRAL", confidence: 0, reason, enabled: true };
}

export function sig(id: string, name: string, direction: "LONG" | "SHORT", confidence: number, reason: string): StrategyResult {
  return { id, name, direction, confidence: Math.min(99, confidence), reason, enabled: true };
}

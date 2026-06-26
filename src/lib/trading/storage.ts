import type { BotState, ScanSignal } from "@/types/trading";
import { migrateScanSignal } from "@/lib/trading/helpers";

export const STORAGE_KEY = "futures_bot_v4";
const LEGACY_KEYS = ["futures_bot_v3", "futures_bot_v2"];
export const MAX_SIGNAL_HISTORY = 5000;

export type PersistedState = Partial<BotState> & {
  balance?: number;
  paperBalance?: number;
  botRunning?: boolean;
  dataProvider?: string;
};

export function loadPersistedState(): PersistedState {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as PersistedState;
    } catch {
      /* try next key */
    }
  }
  return {};
}

export function migrateSignals(signals: ScanSignal[] | undefined): ScanSignal[] {
  if (!signals?.length) return [];
  return signals.map((s) => migrateScanSignal(s));
}

/** Restore latest-scan signals from history when only history was saved. */
export function restoreLatestSignals(
  signals: ScanSignal[],
  history: ScanSignal[]
): ScanSignal[] {
  if (signals.length) return signals;
  if (!history.length) return [];
  const latestScanId = history[0].scanId;
  return history.filter((s) => s.scanId === latestScanId);
}

export function savePersistedState(state: PersistedState) {
  const payload: PersistedState = {
    mode: state.mode,
    signals: state.signals,
    signalHistory: (state.signalHistory ?? []).slice(-MAX_SIGNAL_HISTORY),
    positions: state.positions,
    closedPositions: (state.closedPositions ?? []).slice(-200),
    replacementQueue: state.replacementQueue,
    risk: state.risk,
    strategyHealth: state.strategyHealth,
    logs: (state.logs ?? []).slice(-400),
    confidenceLog: (state.confidenceLog ?? []).slice(-100),
    validation: state.validation,
    lastScanAt: state.lastScanAt,
    scanLatencyMs: state.scanLatencyMs,
    pairsScanned: state.pairsScanned,
    lastReplacementAt: state.lastReplacementAt,
    balance: state.balance,
    botRunning: state.botRunning,
    dataProvider: state.dataProvider,
  };

  const write = (data: PersistedState) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  try {
    write(payload);
  } catch {
    try {
      write({
        ...payload,
        signalHistory: (payload.signalHistory ?? []).slice(0, 800),
        signals: (payload.signals ?? []).slice(0, 100),
        logs: (payload.logs ?? []).slice(0, 100),
      });
    } catch {
      /* storage full — keep positions/balance at minimum */
      try {
        write({
          balance: payload.balance,
          positions: payload.positions,
          closedPositions: payload.closedPositions,
          risk: payload.risk,
          signalHistory: (payload.signalHistory ?? []).slice(0, 200),
          signals: payload.signals ?? [],
        });
      } catch {
        /* ignore */
      }
    }
  }
}

export function clearPersistedState() {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

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

/** Merge patch into existing storage — undefined fields keep prior values. */
export function mergeAndSave(patch: PersistedState) {
  const existing = loadPersistedState();
  const payload: PersistedState = { ...existing, ...patch };

  if (payload.logs) payload.logs = payload.logs.slice(-400);
  if (payload.confidenceLog) payload.confidenceLog = payload.confidenceLog.slice(-100);
  if (payload.closedPositions) payload.closedPositions = payload.closedPositions.slice(-200);
  if (payload.signalHistory) payload.signalHistory = payload.signalHistory.slice(-MAX_SIGNAL_HISTORY);

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

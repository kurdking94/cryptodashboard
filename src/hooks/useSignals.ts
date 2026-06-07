"use client";

import { useCallback, useSyncExternalStore } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Signal, SignalDirection } from "@/types/signal";

const STORAGE_KEY = "crypto_signals_v1";

// ── Storage helpers ──────────────────────────────────────────────────────────

function readStorage(): Signal[] {
  try {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as Signal[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(signals: Signal[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signals));
  } catch {
    // ignore quota errors
  }
}

// ── useSyncExternalStore store ───────────────────────────────────────────────
// Using useSyncExternalStore avoids calling setState inside effects, which is
// the React-idiomatic way to integrate with external state systems like localStorage.

let _listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  for (const l of _listeners) l();
}

export interface AddSignalInput {
  symbol: string;
  direction: SignalDirection;
  /** Must be the live market price fetched BEFORE calling addSignal */
  entryPrice: number;
  takeProfit?: number;
  stopLoss?: number;
  leverage?: number;
  note?: string;
}

export function useSignals() {
  // useSyncExternalStore: React 18 idiomatic way to read from external stores
  const signals = useSyncExternalStore(
    subscribe,
    readStorage,         // client snapshot
    () => [] as Signal[] // server snapshot (SSR)
  );

  const persist = useCallback((updated: Signal[]) => {
    writeStorage(updated);
    notifyListeners();
  }, []);

  /**
   * Add a new signal.
   * entryPrice MUST come from a live price fetch done right before this call.
   * The PnL on a brand-new signal will therefore be exactly 0 %.
   */
  const addSignal = useCallback(
    (input: AddSignalInput): Signal => {
      const current = readStorage();
      const signal: Signal = {
        id: uuidv4(),
        symbol: input.symbol.toUpperCase().replace(/\s/g, ""),
        direction: input.direction,
        entryPrice: input.entryPrice, // locked here — never changes
        takeProfit: input.takeProfit,
        stopLoss: input.stopLoss,
        leverage: input.leverage ?? 1,
        status: "ACTIVE",
        addedAt: Date.now(),
        note: input.note,
      };
      persist([...current, signal]);
      return signal;
    },
    [persist]
  );

  const closeSignal = useCallback(
    (id: string, closedPrice: number) => {
      persist(
        readStorage().map((s) =>
          s.id === id
            ? { ...s, status: "CLOSED", closedAt: Date.now(), closedPrice }
            : s
        )
      );
    },
    [persist]
  );

  const cancelSignal = useCallback(
    (id: string) => {
      persist(
        readStorage().map((s) =>
          s.id === id ? { ...s, status: "CANCELLED" } : s
        )
      );
    },
    [persist]
  );

  const deleteSignal = useCallback(
    (id: string) => {
      persist(readStorage().filter((s) => s.id !== id));
    },
    [persist]
  );

  return {
    signals,
    hydrated: true, // useSyncExternalStore handles SSR correctly
    addSignal,
    closeSignal,
    cancelSignal,
    deleteSignal,
  };
}

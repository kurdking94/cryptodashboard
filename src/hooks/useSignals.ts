"use client";

import { useCallback, useSyncExternalStore } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Signal, SignalDirection } from "@/types/signal";

const STORAGE_KEY = "crypto_signals_v1";

// ── Module-level cache ───────────────────────────────────────────────────────
// useSyncExternalStore requires getSnapshot to return the same reference
// when the data has not changed. We keep a single cached array here and
// only replace it when we explicitly write new data.

const SERVER_SNAPSHOT: Signal[] = []; // stable empty array for SSR

let _cache: Signal[] | null = null;

function getSnapshot(): Signal[] {
  if (_cache !== null) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _cache = raw ? (JSON.parse(raw) as Signal[]) : SERVER_SNAPSHOT;
  } catch {
    _cache = SERVER_SNAPSHOT;
  }
  return _cache;
}

function getServerSnapshot(): Signal[] {
  // Always return the same stable reference during SSR / hydration
  return SERVER_SNAPSHOT;
}

function writeStorage(signals: Signal[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signals));
  } catch {
    // ignore quota errors
  }
  // Replace the cache with the new array, then notify subscribers
  _cache = signals;
  notifyListeners();
}

// ── Pub/sub ──────────────────────────────────────────────────────────────────

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

// ── Hook ─────────────────────────────────────────────────────────────────────

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
  const signals = useSyncExternalStore(
    subscribe,
    getSnapshot,        // client: returns cached reference — stable between writes
    getServerSnapshot   // server/SSR: always returns the same [] reference
  );

  const addSignal = useCallback((input: AddSignalInput): Signal => {
    const signal: Signal = {
      id: uuidv4(),
      symbol: input.symbol.toUpperCase().replace(/\s/g, ""),
      direction: input.direction,
      entryPrice: input.entryPrice, // locked at live price — PnL starts at 0%
      takeProfit: input.takeProfit,
      stopLoss: input.stopLoss,
      leverage: input.leverage ?? 1,
      status: "ACTIVE",
      addedAt: Date.now(),
      note: input.note,
    };
    writeStorage([...getSnapshot(), signal]);
    return signal;
  }, []);

  const closeSignal = useCallback((id: string, closedPrice: number) => {
    writeStorage(
      getSnapshot().map((s) =>
        s.id === id
          ? { ...s, status: "CLOSED", closedAt: Date.now(), closedPrice }
          : s
      )
    );
  }, []);

  const cancelSignal = useCallback((id: string) => {
    writeStorage(
      getSnapshot().map((s) =>
        s.id === id ? { ...s, status: "CANCELLED" } : s
      )
    );
  }, []);

  const deleteSignal = useCallback((id: string) => {
    writeStorage(getSnapshot().filter((s) => s.id !== id));
  }, []);

  return {
    signals,
    hydrated: true,
    addSignal,
    closeSignal,
    cancelSignal,
    deleteSignal,
  };
}

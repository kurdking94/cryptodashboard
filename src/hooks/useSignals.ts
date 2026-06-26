"use client";

import { useCallback, useSyncExternalStore } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Signal, SignalDirection } from "@/types/signal";

const STORAGE_KEY = "crypto_signals_v1";

// Stable empty array — used for SSR and as the initial client snapshot.
const EMPTY_SNAPSHOT: Signal[] = [];

let snapshot: Signal[] = EMPTY_SNAPSHOT;
let storeHydrated = false;
let listeners: Array<() => void> = [];

function hydrateOnce() {
  if (storeHydrated) return;
  storeHydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      snapshot = JSON.parse(raw) as Signal[];
    }
  } catch {
    snapshot = EMPTY_SNAPSHOT;
  }
}

function subscribe(listener: () => void) {
  const needsHydration = !storeHydrated;
  listeners.push(listener);
  if (needsHydration) {
    hydrateOnce();
    // Force one re-render after hydration even when localStorage is empty.
    queueMicrotask(() => listener());
  }
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): Signal[] {
  return snapshot;
}

function getServerSnapshot(): Signal[] {
  return EMPTY_SNAPSHOT;
}

function commitSnapshot(next: Signal[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  snapshot = next;
  for (const listener of listeners) listener();
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
  const signals = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addSignal = useCallback((input: AddSignalInput): Signal => {
    const signal: Signal = {
      id: uuidv4(),
      symbol: input.symbol.toUpperCase().replace(/\s/g, ""),
      direction: input.direction,
      entryPrice: input.entryPrice,
      takeProfit: input.takeProfit,
      stopLoss: input.stopLoss,
      leverage: input.leverage ?? 1,
      status: "ACTIVE",
      addedAt: Date.now(),
      note: input.note,
    };
    commitSnapshot([...getSnapshot(), signal]);
    return signal;
  }, []);

  const closeSignal = useCallback((id: string, closedPrice: number) => {
    commitSnapshot(
      getSnapshot().map((s) =>
        s.id === id
          ? { ...s, status: "CLOSED", closedAt: Date.now(), closedPrice }
          : s
      )
    );
  }, []);

  const cancelSignal = useCallback((id: string) => {
    commitSnapshot(
      getSnapshot().map((s) =>
        s.id === id ? { ...s, status: "CANCELLED" } : s
      )
    );
  }, []);

  const deleteSignal = useCallback((id: string) => {
    commitSnapshot(getSnapshot().filter((s) => s.id !== id));
  }, []);

  return {
    signals,
    hydrated: storeHydrated,
    addSignal,
    closeSignal,
    cancelSignal,
    deleteSignal,
  };
}

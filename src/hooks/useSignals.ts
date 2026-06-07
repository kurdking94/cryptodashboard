"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Signal, SignalDirection } from "@/types/signal";

const STORAGE_KEY = "crypto_signals_v1";

function loadFromStorage(): Signal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Signal[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(signals: Signal[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signals));
  } catch {
    // ignore quota errors
  }
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
  const [signals, setSignals] = useState<Signal[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const initialized = useRef(false);

  // One-time hydration from localStorage (client only).
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = loadFromStorage();
    requestAnimationFrame(() => {
      setSignals(stored);
      setHydrated(true);
    });
  }, []);

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
    setSignals((prev) => {
      const updated = [...prev, signal];
      saveToStorage(updated);
      return updated;
    });
    return signal;
  }, []);

  const closeSignal = useCallback((id: string, closedPrice: number) => {
    setSignals((prev) => {
      const updated = prev.map((s) =>
        s.id === id
          ? { ...s, status: "CLOSED" as const, closedAt: Date.now(), closedPrice }
          : s
      );
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const cancelSignal = useCallback((id: string) => {
    setSignals((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, status: "CANCELLED" as const } : s
      );
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const deleteSignal = useCallback((id: string) => {
    setSignals((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  return {
    signals,
    hydrated,
    addSignal,
    closeSignal,
    cancelSignal,
    deleteSignal,
  };
}

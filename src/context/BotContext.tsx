"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { runMarketScan } from "@/lib/engine/scanner";
import {
  canOpenPosition,
  checkExits,
  openPaperPosition,
  updatePositionPrices,
} from "@/lib/risk/manager";
import { createLog, INITIAL_STRATEGY_HEALTH, updateStrategyHealth } from "@/lib/trading/helpers";
import type {
  BotLog,
  BotMode,
  BotState,
  Position,
  RiskSettings,
  ScanSignal,
  StrategyHealth,
} from "@/types/trading";
import { DEFAULT_RISK } from "@/types/trading";

const STORAGE_KEY = "futures_bot_v1";
const SCAN_INTERVAL_MS = 45_000;

interface BotContextValue extends BotState {
  startBot: () => void;
  stopBot: () => void;
  setMode: (mode: BotMode) => void;
  runScanNow: () => Promise<void>;
  closePosition: (id: string) => void;
  killAll: () => void;
  updateRisk: (patch: Partial<RiskSettings>) => void;
  toggleStrategy: (id: string) => void;
  addLog: (level: BotLog["level"], message: string, meta?: Record<string, unknown>) => void;
}

const BotContext = createContext<BotContextValue | null>(null);

function loadState(): Partial<BotState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState(state: BotState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode: state.mode,
      positions: state.positions,
      closedPositions: state.closedPositions.slice(-200),
      risk: state.risk,
      strategyHealth: state.strategyHealth,
      logs: state.logs.slice(-300),
      paperBalance: state.paperBalance,
      totalPnlUsd: state.totalPnlUsd,
    }));
  } catch { /* ignore */ }
}

export function BotProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<BotMode>("PAPER");
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanAt, setLastScanAt] = useState<number | undefined>();
  const [scanLatencyMs, setScanLatencyMs] = useState(0);
  const [pairsScanned, setPairsScanned] = useState(0);
  const [signals, setSignals] = useState<ScanSignal[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [replacementQueue, setReplacementQueue] = useState<ScanSignal[]>([]);
  const [risk, setRisk] = useState<RiskSettings>(DEFAULT_RISK);
  const [strategyHealth, setStrategyHealth] = useState<StrategyHealth[]>(INITIAL_STRATEGY_HEALTH);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [paperBalance, setPaperBalance] = useState(10_000);
  const [totalPnlUsd, setTotalPnlUsd] = useState(0);
  const [botRunning, setBotRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scanLock = useRef(false);

  // Hydrate persisted state once on client mount
  useEffect(() => {
    const saved = loadState();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time localStorage hydration */
    if (saved.mode) setModeState(saved.mode);
    if (saved.positions) setPositions(saved.positions);
    if (saved.closedPositions) setClosedPositions(saved.closedPositions);
    if (saved.risk) setRisk({ ...DEFAULT_RISK, ...saved.risk });
    if (saved.strategyHealth) setStrategyHealth(saved.strategyHealth);
    if (saved.logs) setLogs(saved.logs);
    if (saved.paperBalance != null) setPaperBalance(saved.paperBalance);
    if (saved.totalPnlUsd != null) setTotalPnlUsd(saved.totalPnlUsd);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const addLog = useCallback((level: BotLog["level"], message: string, meta?: Record<string, unknown>) => {
    setLogs((prev) => [...prev.slice(-299), createLog(level, message, meta)]);
  }, []);

  const enabledIds = useRef(
    new Set(strategyHealth.filter((s) => s.enabled).map((s) => s.id))
  );

  useEffect(() => {
    enabledIds.current = new Set(strategyHealth.filter((s) => s.enabled).map((s) => s.id));
  }, [strategyHealth]);

  const persist = useCallback(() => {
    saveState({
      mode, isScanning, lastScanAt, scanLatencyMs, pairsScanned,
      signals, positions, closedPositions, replacementQueue,
      risk, strategyHealth, logs, paperBalance, totalPnlUsd,
    });
  }, [mode, isScanning, lastScanAt, scanLatencyMs, pairsScanned, signals, positions, closedPositions, replacementQueue, risk, strategyHealth, logs, paperBalance, totalPnlUsd]);

  useEffect(() => {
    if (!hydrated) return;
    persist();
  }, [hydrated, persist]);

  const processAutoTrades = useCallback((
    newSignals: ScanSignal[],
    currentPositions: Position[]
  ) => {
    if (mode === "OFF" || risk.killSwitch) return currentPositions;

    const openSymbols = new Set(currentPositions.filter((p) => p.status === "OPEN").map((p) => p.symbol));
    const updated = [...currentPositions];
    const queue: ScanSignal[] = [];

    for (const signal of newSignals) {
      if (openSymbols.has(signal.symbol)) continue;
      const openCount = updated.filter((p) => p.status === "OPEN").length;
      const check = canOpenPosition(risk, openCount, signal);
      if (!check.ok) {
        queue.push(signal);
        continue;
      }
      const pos = openPaperPosition(signal, risk);
      updated.push(pos);
      openSymbols.add(signal.symbol);
      addLog("trade", `Opened ${signal.direction} ${signal.symbol} @ $${signal.price.toFixed(4)} (conf ${signal.confidence}%)`, { signal });
    }

    setReplacementQueue(queue.slice(0, 10));
    return updated;
  }, [mode, risk, addLog]);

  const runScanNow = useCallback(async () => {
    if (scanLock.current) return;
    scanLock.current = true;
    setIsScanning(true);
    addLog("info", "Market scan started — top 100 futures pairs");

    try {
      const result = await runMarketScan(
        enabledIds.current,
        risk.minConfidence,
        (_scanned) => setPairsScanned(_scanned)
      );

      setSignals(result.signals);
      setScanLatencyMs(result.latencyMs);
      setLastScanAt(Date.now());
      addLog("signal", `Scan complete: ${result.signals.length} signals from ${result.pairsScanned} pairs (${result.latencyMs}ms)`);

      // Update open position prices from scan results
      const priceMap: Record<string, number> = {};
      for (const s of result.signals) priceMap[s.symbol] = s.price;

      setPositions((prev) => {
        let updated = updatePositionPrices(prev, priceMap);
        const { updated: afterExit, closed } = checkExits(updated);
        updated = afterExit;

        if (closed.length > 0) {
          for (const c of closed) {
            addLog("trade", `Closed ${c.symbol} ${c.status} PnL $${c.pnlUsd.toFixed(2)}`);
            setClosedPositions((cp) => [...cp, c]);
            setTotalPnlUsd((t) => t + c.pnlUsd);
            setPaperBalance((b) => b + c.pnlUsd);
            if (c.pnlUsd < 0) {
              setRisk((r) => ({ ...r, dailyLossUsd: r.dailyLossUsd + Math.abs(c.pnlUsd), lastLossAt: Date.now() }));
            }
            setStrategyHealth((h) => updateStrategyHealth(h, c));
          }
        }

        if (mode !== "OFF") {
          updated = processAutoTrades(result.signals, updated);
        }
        return updated;
      });
    } catch (err) {
      addLog("error", `Scan failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setIsScanning(false);
      scanLock.current = false;
    }
  }, [risk.minConfidence, mode, addLog, processAutoTrades]);

  // Auto-scan loop
  useEffect(() => {
    if (!botRunning) return;
    runScanNow();
    const id = setInterval(runScanNow, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [botRunning, runScanNow]);

  const startBot = useCallback(() => {
    setBotRunning(true);
    addLog("info", `Bot started in ${mode} mode`);
  }, [mode, addLog]);

  const stopBot = useCallback(() => {
    setBotRunning(false);
    addLog("warn", "Bot stopped");
  }, [addLog]);

  const setMode = useCallback((m: BotMode) => {
    setModeState(m);
    addLog("info", `Mode changed to ${m}`);
  }, [addLog]);

  const closePosition = useCallback((id: string) => {
    setPositions((prev) => {
      const pos = prev.find((p) => p.id === id);
      if (!pos || pos.status !== "OPEN") return prev;
      const closed: Position = {
        ...pos,
        status: "CLOSED_MANUAL",
        closedAt: Date.now(),
        closedPrice: pos.currentPrice,
      };
      setClosedPositions((cp) => [...cp, closed]);
      setTotalPnlUsd((t) => t + closed.pnlUsd);
      setPaperBalance((b) => b + closed.pnlUsd);
      addLog("trade", `Manual close ${pos.symbol} PnL $${closed.pnlUsd.toFixed(2)}`);
      return prev.filter((p) => p.id !== id);
    });
  }, [addLog]);

  const killAll = useCallback(() => {
    setPositions((prev) => {
      const open = prev.filter((p) => p.status === "OPEN");
      if (open.length === 0) return prev;

      const closedManual = open.map((p) => ({
        ...p,
        status: "CLOSED_MANUAL" as const,
        closedAt: Date.now(),
        closedPrice: p.currentPrice,
      }));

      setClosedPositions((cp) => [...cp, ...closedManual]);
      const totalPnl = closedManual.reduce((s, p) => s + p.pnlUsd, 0);
      setTotalPnlUsd((t) => t + totalPnl);
      setPaperBalance((b) => b + totalPnl);
      addLog("error", `KILL SWITCH — closed ${open.length} positions, total PnL $${totalPnl.toFixed(2)}`);

      return prev.filter((p) => p.status !== "OPEN");
    });
    setRisk((r) => ({ ...r, killSwitch: true }));
    setBotRunning(false);
  }, [addLog]);

  const updateRisk = useCallback((patch: Partial<RiskSettings>) => {
    setRisk((r) => ({ ...r, ...patch }));
    addLog("info", "Risk settings updated", patch);
  }, [addLog]);

  const toggleStrategy = useCallback((id: string) => {
    setStrategyHealth((prev) =>
      prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s)
    );
    addLog("info", `Strategy toggled: ${id}`);
  }, [addLog]);

  return (
    <BotContext.Provider value={{
      mode, isScanning, lastScanAt, scanLatencyMs, pairsScanned,
      signals, positions, closedPositions, replacementQueue,
      risk, strategyHealth, logs, paperBalance, totalPnlUsd,
      startBot, stopBot, setMode, runScanNow, closePosition,
      killAll, updateRisk, toggleStrategy, addLog,
    }}>
      {children}
    </BotContext.Provider>
  );
}

export function useBot() {
  const ctx = useContext(BotContext);
  if (!ctx) throw new Error("useBot must be used within BotProvider");
  return ctx;
}

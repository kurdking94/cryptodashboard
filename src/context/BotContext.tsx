"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchKlines, fetchLivePrices } from "@/lib/binance/futures";
import { runMarketScan } from "@/lib/engine/scanner";
import { getActiveProvider } from "@/lib/binance/futures";
import {
  canOpenPosition,
  openPaperPosition,
} from "@/lib/risk/manager";
import { refreshOpenPositions, summarizeOpenPnl } from "@/lib/trading/positions";
import { computeScoreboard } from "@/lib/trading/scoreboard";
import { runReplay, type ReplayResult } from "@/lib/trading/replay";
import { createLog, enrichScanSignal, INITIAL_STRATEGY_HEALTH, migratePosition, updateStrategyHealth } from "@/lib/trading/helpers";
import {
  clearPersistedState,
  loadPersistedState,
  MAX_SIGNAL_HISTORY,
  mergeAndSave,
  migrateSignals,
  restoreLatestSignals,
  type PersistedState,
} from "@/lib/trading/storage";
import { buildWallet } from "@/lib/wallet";
import type {
  BotLog,
  BotMode,
  BotState,
  ConfidenceLogEntry,
  LogCategory,
  Position,
  RiskSettings,
  ScanSignal,
  StrategyHealth,
  ValidationChecks,
  WalletState,
} from "@/types/trading";
import { DEFAULT_RISK, INITIAL_BALANCE, SCAN_PAIR_COUNT } from "@/types/trading";
import { v4 as uuidv4 } from "uuid";

const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface BotContextValue extends BotState {
  wallet: WalletState;
  dataProvider: string;
  startBot: () => void;
  stopBot: () => void;
  setMode: (mode: BotMode) => void;
  runScanNow: () => Promise<void>;
  runReplay: (symbol: string) => Promise<ReplayResult>;
  closePosition: (id: string) => void;
  killAll: () => void;
  resetWallet: () => void;
  updateRisk: (patch: Partial<RiskSettings>) => void;
  toggleStrategy: (id: string) => void;
  addLog: (level: BotLog["level"], category: LogCategory, message: string, meta?: Record<string, unknown>) => void;
  executionLogs: BotLog[];
  errorLogs: BotLog[];
}

const BotContext = createContext<BotContextValue | null>(null);

export function BotProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<BotMode>("PAPER");
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanAt, setLastScanAt] = useState<number>();
  const [scanLatencyMs, setScanLatencyMs] = useState(0);
  const [lastExecutionLatencyMs, setLastExecutionLatencyMs] = useState(0);
  const [pairsScanned, setPairsScanned] = useState(0);
  const [signals, setSignals] = useState<ScanSignal[]>([]);
  const [signalHistory, setSignalHistory] = useState<ScanSignal[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [replacementQueue, setReplacementQueue] = useState<ScanSignal[]>([]);
  const [risk, setRisk] = useState<RiskSettings>(DEFAULT_RISK);
  const [strategyHealth, setStrategyHealth] = useState<StrategyHealth[]>(INITIAL_STRATEGY_HEALTH);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [confidenceLog, setConfidenceLog] = useState<ConfidenceLogEntry[]>([]);
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [validation, setValidation] = useState<ValidationChecks>({
    liveSignals: false, confidenceRanking: false, correctEntry: false, correctExit: false, replacement: false,
  });
  const [lastReplacementAt, setLastReplacementAt] = useState<number>();
  const [dataProvider, setDataProvider] = useState("okx");
  const [botRunning, setBotRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scanLock = useRef(false);
  const hydratedRef = useRef(false);
  const balanceRef = useRef(balance);
  const positionsRef = useRef(positions);
  const signalsRef = useRef(signals);
  const signalHistoryRef = useRef(signalHistory);
  const closedPositionsRef = useRef(closedPositions);
  const logsRef = useRef(logs);
  const confidenceLogRef = useRef(confidenceLog);
  balanceRef.current = balance;
  positionsRef.current = positions;
  signalsRef.current = signals;
  signalHistoryRef.current = signalHistory;
  closedPositionsRef.current = closedPositions;
  logsRef.current = logs;
  confidenceLogRef.current = confidenceLog;

  const snapshotStorage = useCallback((patch?: Partial<PersistedState>): PersistedState => ({
    mode: patch?.mode ?? mode,
    lastScanAt: patch?.lastScanAt ?? lastScanAt,
    scanLatencyMs: patch?.scanLatencyMs ?? scanLatencyMs,
    pairsScanned: patch?.pairsScanned ?? pairsScanned,
    signals: patch?.signals ?? signalsRef.current,
    signalHistory: patch?.signalHistory ?? signalHistoryRef.current,
    positions: patch?.positions ?? positionsRef.current,
    closedPositions: patch?.closedPositions ?? closedPositionsRef.current,
    replacementQueue: patch?.replacementQueue ?? replacementQueue,
    risk: patch?.risk ?? risk,
    strategyHealth: patch?.strategyHealth ?? strategyHealth,
    logs: patch?.logs ?? logsRef.current,
    confidenceLog: patch?.confidenceLog ?? confidenceLogRef.current,
    validation: patch?.validation ?? validation,
    lastReplacementAt: patch?.lastReplacementAt ?? lastReplacementAt,
    balance: patch?.balance ?? balanceRef.current,
    botRunning: patch?.botRunning ?? botRunning,
    dataProvider: patch?.dataProvider ?? dataProvider,
  }), [mode, lastScanAt, scanLatencyMs, pairsScanned, replacementQueue, risk, strategyHealth, validation, lastReplacementAt, botRunning, dataProvider]);

  const writeStorage = useCallback((patch?: Partial<PersistedState>) => {
    if (!hydratedRef.current) return;
    mergeAndSave(snapshotStorage(patch));
  }, [snapshotStorage]);

  useEffect(() => {
    const saved = loadPersistedState();
    const history = migrateSignals(saved.signalHistory);
    const latest = restoreLatestSignals(migrateSignals(saved.signals), history);

    /* eslint-disable react-hooks/set-state-in-effect -- one-time localStorage hydration */
    if (saved.mode) setModeState(saved.mode);
    if (saved.positions) {
      const migrated = saved.positions.map(migratePosition);
      setPositions(migrated);
      positionsRef.current = migrated;
    }
    if (saved.closedPositions) {
      setClosedPositions(saved.closedPositions);
      closedPositionsRef.current = saved.closedPositions;
    }
    if (saved.risk) setRisk({ ...DEFAULT_RISK, ...saved.risk });
    if (saved.strategyHealth) setStrategyHealth(saved.strategyHealth);
    if (saved.logs) {
      setLogs(saved.logs);
      logsRef.current = saved.logs;
    }
    if (saved.confidenceLog) {
      setConfidenceLog(saved.confidenceLog);
      confidenceLogRef.current = saved.confidenceLog;
    }
    setSignalHistory(history);
    setSignals(latest);
    signalsRef.current = latest;
    signalHistoryRef.current = history;
    if (saved.balance != null) setBalance(saved.balance);
    else if (saved.paperBalance != null) setBalance(saved.paperBalance);
    if (saved.validation) setValidation(saved.validation);
    if (saved.lastReplacementAt) setLastReplacementAt(saved.lastReplacementAt);
    if (saved.lastScanAt) setLastScanAt(saved.lastScanAt);
    if (saved.scanLatencyMs != null) setScanLatencyMs(saved.scanLatencyMs);
    if (saved.pairsScanned != null) setPairsScanned(saved.pairsScanned);
    if (saved.replacementQueue) setReplacementQueue(migrateSignals(saved.replacementQueue));
    if (saved.dataProvider) setDataProvider(saved.dataProvider);
    if (saved.botRunning) setBotRunning(true);
    hydratedRef.current = true;
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const openPositions = useMemo(() => positions.filter((p) => p.status === "OPEN"), [positions]);
  const wallet = useMemo(() => buildWallet(balance, risk.initialBalance, openPositions), [balance, risk.initialBalance, openPositions]);
  const scoreboard = useMemo(() => computeScoreboard(closedPositions), [closedPositions]);

  const addLog = useCallback((level: BotLog["level"], category: LogCategory, message: string, meta?: Record<string, unknown>) => {
    setLogs((prev) => {
      const next = [...prev.slice(-399), createLog(level, category, message, meta)];
      logsRef.current = next;
      return next;
    });
  }, []);

  const executionLogs = useMemo(() => logs.filter((l) => l.category === "execution" || l.level === "trade"), [logs]);
  const errorLogs = useMemo(() => logs.filter((l) => l.category === "error" || l.level === "error"), [logs]);

  const enabledIds = useRef(new Set(strategyHealth.filter((s) => s.enabled).map((s) => s.id)));
  useEffect(() => {
    enabledIds.current = new Set(strategyHealth.filter((s) => s.enabled).map((s) => s.id));
  }, [strategyHealth]);

  const persist = useCallback(() => writeStorage(), [writeStorage]);

  useEffect(() => {
    if (!hydrated) return;
    persist();
  }, [hydrated, persist]);

  const recordConfidenceLog = useCallback((ranked: ScanSignal[], blocked: Map<string, string>) => {
    const entries: ConfidenceLogEntry[] = ranked.map((s, i) => ({
      id: uuidv4(),
      timestamp: Date.now(),
      symbol: s.symbol,
      rank: i + 1,
      confidence: s.confidence,
      direction: s.direction,
      breakdown: s.confidenceBreakdown,
      agreeing: s.strategies
        .filter((st) => st.direction === s.direction)
        .map((st) => `${st.name}${st.timeframe ? ` (${st.timeframe})` : ""}`),
      blocked: blocked.get(s.symbol),
      rankingReason: s.rankingReason,
    }));
    setConfidenceLog((prev) => {
      const next = [...prev.slice(-80), ...entries];
      confidenceLogRef.current = next;
      return next;
    });
    if (ranked.length >= 2 && ranked[0].confidence >= ranked[1].confidence) {
      setValidation((v) => ({ ...v, confidenceRanking: true }));
    }
  }, []);

  const handleClosed = useCallback((closed: Position[]) => {
    for (const c of closed) {
      addLog("trade", "execution", `EXIT ${c.symbol} ${c.status}: ${c.exitReason ?? "closed"} @ $${c.closedPrice?.toFixed(4)} PnL $${c.pnlUsd.toFixed(2)}`, { position: c });
      setClosedPositions((cp) => {
        const next = [...cp, c];
        closedPositionsRef.current = next;
        return next;
      });
      setBalance((b) => {
        const next = b + c.pnlUsd;
        balanceRef.current = next;
        return next;
      });
      if (c.pnlUsd < 0) {
        setRisk((r) => ({ ...r, dailyLossUsd: r.dailyLossUsd + Math.abs(c.pnlUsd), lastLossAt: Date.now() }));
      }
      setStrategyHealth((h) => updateStrategyHealth(h, c));
      setValidation((v) => ({ ...v, correctExit: true }));
    }
  }, [addLog]);

  const processAutoTrades = useCallback(async (
    newSignals: ScanSignal[],
    currentPositions: Position[],
    currentWallet: WalletState,
    scanCompletedAt: number,
    livePrices: Record<string, number>
  ): Promise<Position[]> => {
    if (mode === "OFF" || risk.killSwitch) return currentPositions;

    const openSymbols = new Set(currentPositions.filter((p) => p.status === "OPEN").map((p) => p.symbol));
    const updated = [...currentPositions];
    const queue: ScanSignal[] = [];
    let filled = 0;
    const slotsAvailable = risk.maxOpenPositions - updated.filter((p) => p.status === "OPEN").length;

    for (const signal of newSignals) {
      if (openSymbols.has(signal.symbol)) continue;
      const openCount = updated.filter((p) => p.status === "OPEN").length;
      const check = canOpenPosition(risk, openCount, signal, currentWallet);
      if (!check.ok) {
        queue.push(signal);
        continue;
      }

      const executionPrice = livePrices[signal.symbol] ?? signal.price;
      const executedAt = Date.now();
      const pos = openPaperPosition(signal, risk, currentWallet, executionPrice, signal.scannedAt, executedAt);
      updated.push(pos);
      openSymbols.add(signal.symbol);
      const latency = executedAt - scanCompletedAt;
      setLastExecutionLatencyMs(latency);

      const scanRef = signal.price;
      const slipPct = scanRef > 0 ? Math.abs((executionPrice - scanRef) / scanRef) * 100 : 0;
      const slipNote = slipPct > 0.05 ? ` (scan ref $${scanRef.toFixed(4)}, slip ${slipPct.toFixed(2)}%)` : "";

      addLog("trade", "execution",
        `ENTRY ${signal.direction} ${signal.symbol} @ $${executionPrice.toFixed(4)}${slipNote} | margin $${pos.marginUsed.toFixed(2)} × ${pos.leverage}x | conf ${signal.confidence}% | PnL 0.00% at fill`,
        { signal, position: pos, executionPrice, scanReferencePrice: scanRef }
      );

      setValidation((v) => ({ ...v, correctEntry: true, liveSignals: true }));
      filled++;
    }

    setReplacementQueue(queue.slice(0, 15));
    if (filled > 0 && slotsAvailable > 0) {
      setLastReplacementAt(Date.now());
      setValidation((v) => ({ ...v, replacement: true }));
      addLog("info", "execution", `Opened ${filled} virtual position(s) — ${slotsAvailable - filled} slot(s) remaining`);
    }

    return updated;
  }, [mode, risk, addLog]);

  const fetchCandlesForOpen = async (open: Position[]): Promise<Record<string, import("@/types/trading").Candle>> => {
    const map: Record<string, import("@/types/trading").Candle> = {};
    await Promise.allSettled(
      open.map(async (p) => {
        const kl = await fetchKlines(p.symbol, "1m", 2);
        if (kl.length) map[p.symbol] = kl[kl.length - 1];
      })
    );
    return map;
  };

  const runScanNow = useCallback(async () => {
    if (scanLock.current) return;
    scanLock.current = true;
    setIsScanning(true);
    addLog("info", "signal", `Market scan started — analyzing top ${SCAN_PAIR_COUNT} pairs · open trades & history are preserved`);

    try {
      // 1) Refresh open positions first — entry prices stay locked
      const beforePnl = summarizeOpenPnl(positionsRef.current);
      const preRefresh = await refreshOpenPositions(positionsRef.current);
      if (preRefresh.closed.length > 0) {
        handleClosed(preRefresh.closed);
        balanceRef.current += preRefresh.closed.reduce((s, c) => s + c.pnlUsd, 0);
      }
      positionsRef.current = preRefresh.positions;
      setPositions(preRefresh.positions);

      setPairsScanned(0);
      const result = await runMarketScan(enabledIds.current, risk.minConfidence, (n) => setPairsScanned(n));
      const scanCompletedAt = Date.now();

      const scanId = uuidv4();
      const enriched = result.signals.map((s) => enrichScanSignal(s, scanId));

      let mergedHistory: ScanSignal[] = [];
      setSignalHistory((prev) => {
        mergedHistory = [...enriched, ...prev].slice(0, MAX_SIGNAL_HISTORY);
        signalHistoryRef.current = mergedHistory;
        return mergedHistory;
      });

      signalsRef.current = enriched;
      setSignals(enriched);
      setScanLatencyMs(result.latencyMs);
      setLastScanAt(scanCompletedAt);
      setPairsScanned(result.pairsScanned);
      setDataProvider(getActiveProvider());
      setValidation((v) => ({ ...v, liveSignals: result.signals.length > 0 }));

      addLog(
        "signal",
        "signal",
        `Scan complete: ${result.signals.length} new signals · history now ${mergedHistory.length} total · ${result.pairsScanned} pairs (${result.latencyMs}ms)`
      );
      if (result.errors.length > 0) {
        addLog("warn", "error", `${result.errors.length} pair analysis errors (rate limit or data)`, { errors: result.errors.slice(0, 5) });
      }

      const blocked = new Map<string, string>();
      recordConfidenceLog(enriched, blocked);

      const open = positionsRef.current.filter((p) => p.status === "OPEN");
      const candles = await fetchCandlesForOpen(open);
      const postRefresh = await refreshOpenPositions(positionsRef.current, candles);
      if (postRefresh.closed.length > 0) {
        handleClosed(postRefresh.closed);
        balanceRef.current += postRefresh.closed.reduce((s, c) => s + c.pnlUsd, 0);
      }

      const afterPnl = summarizeOpenPnl(postRefresh.positions);
      for (const after of afterPnl) {
        const before = beforePnl.find((b) => b.id === after.id);
        if (before && Math.abs(before.pnlPercent - after.pnlPercent) > 0.01) {
          addLog(
            "info",
            "execution",
            `PnL update ${after.symbol}: ${before.pnlPercent.toFixed(2)}% → ${after.pnlPercent.toFixed(2)}% (entry $${before.entry.toFixed(4)} locked)`
          );
        }
      }

      const openSymbols = new Set(postRefresh.positions.filter((p) => p.status === "OPEN").map((p) => p.symbol));
      const tradeCandidates = enriched.filter((s) => !openSymbols.has(s.symbol));
      const livePrices = await fetchLivePrices(tradeCandidates.map((s) => s.symbol));

      let finalPositions = postRefresh.positions;
      if (mode !== "OFF" && !risk.killSwitch) {
        const w = buildWallet(balanceRef.current, risk.initialBalance, finalPositions);
        finalPositions = await processAutoTrades(enriched, finalPositions, w, scanCompletedAt, livePrices);
      }

      positionsRef.current = finalPositions;
      setPositions(finalPositions);

      writeStorage({
        signals: enriched,
        signalHistory: mergedHistory,
        positions: finalPositions,
        balance: balanceRef.current,
        lastScanAt: scanCompletedAt,
        scanLatencyMs: result.latencyMs,
        pairsScanned: result.pairsScanned,
        dataProvider: getActiveProvider(),
        closedPositions: closedPositionsRef.current,
        logs: logsRef.current,
        confidenceLog: confidenceLogRef.current,
      });
    } catch (err) {
      addLog("error", "error", `Scan failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setIsScanning(false);
      scanLock.current = false;
    }
  }, [risk.minConfidence, risk.killSwitch, mode, addLog, recordConfidenceLog, handleClosed, processAutoTrades, writeStorage]);

  useEffect(() => {
    if (!botRunning) return;
    runScanNow();
    const id = setInterval(runScanNow, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [botRunning, runScanNow]);

  // Live PnL refresh between scans — entry price never changes
  useEffect(() => {
    const open = positions.filter((p) => p.status === "OPEN");
    if (!open.length || !hydrated) return;

    const refresh = async () => {
      const { positions: next, closed } = await refreshOpenPositions(positionsRef.current);
      if (closed.length > 0) {
        handleClosed(closed);
        balanceRef.current += closed.reduce((s, c) => s + c.pnlUsd, 0);
      }
      positionsRef.current = next;
      setPositions(next);
      writeStorage({ positions: next, balance: balanceRef.current });
    };

    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [positions, hydrated, handleClosed, writeStorage]);

  const startBot = useCallback(() => {
    setBotRunning(true);
    writeStorage({ botRunning: true });
    addLog("info", "system", `Paper simulator started — $${balanceRef.current.toFixed(2)} balance, ${risk.positionSizePercent}% per trade, ${risk.maxLeverage}x leverage, auto-scan every 5 min`);
  }, [risk, addLog, writeStorage]);

  const stopBot = useCallback(() => {
    setBotRunning(false);
    writeStorage({ botRunning: false });
    addLog("warn", "system", "Bot stopped");
  }, [addLog, writeStorage]);

  const setMode = useCallback((m: BotMode) => {
    setModeState(m);
    addLog("info", "system", `Mode changed to ${m}`);
  }, [addLog]);

  const closePosition = useCallback((id: string) => {
    setPositions((prev) => {
      const pos = prev.find((p) => p.id === id);
      if (!pos || pos.status !== "OPEN") return prev;
      const closed: Position = {
        ...pos, status: "CLOSED_MANUAL", closedAt: Date.now(),
        closedPrice: pos.currentPrice, exitReason: "Manual close",
      };
      handleClosed([closed]);
      const next = prev.filter((p) => p.id !== id);
      positionsRef.current = next;
      writeStorage({ positions: next, closedPositions: closedPositionsRef.current, balance: balanceRef.current });
      return next;
    });
  }, [handleClosed, writeStorage]);

  const killAll = useCallback(() => {
    setPositions((prev) => {
      const open = prev.filter((p) => p.status === "OPEN");
      if (open.length === 0) return prev;
      const closedManual = open.map((p) => ({
        ...p, status: "CLOSED_MANUAL" as const, closedAt: Date.now(),
        closedPrice: p.currentPrice, exitReason: "Kill switch",
      }));
      handleClosed(closedManual);
      return prev.filter((p) => p.status !== "OPEN");
    });
    setRisk((r) => ({ ...r, killSwitch: true }));
    setBotRunning(false);
    addLog("error", "error", "KILL SWITCH — all positions closed, bot halted");
  }, [handleClosed, addLog]);

  const resetWallet = useCallback(() => {
    setBalance(INITIAL_BALANCE);
    setPositions([]);
    setClosedPositions([]);
    setSignals([]);
    setSignalHistory([]);
    signalsRef.current = [];
    signalHistoryRef.current = [];
    setReplacementQueue([]);
    setRisk((r) => ({ ...DEFAULT_RISK, killSwitch: false, dailyLossUsd: 0 }));
    setStrategyHealth(INITIAL_STRATEGY_HEALTH);
    setValidation({ liveSignals: false, confidenceRanking: false, correctEntry: false, correctExit: false, replacement: false });
    setConfidenceLog([]);
    setLastScanAt(undefined);
    setPairsScanned(0);
    clearPersistedState();
    addLog("info", "system", `Wallet reset to $${INITIAL_BALANCE} — paper simulator ready`);
  }, [addLog]);

  const runReplayMode = useCallback(async (symbol: string) => {
    addLog("info", "system", `Replay started for ${symbol}`);
    try {
      const result = await runReplay(symbol, enabledIds.current);
      addLog("info", "system", `Replay complete: ${result.signals.length} historical signals from ${result.candlesAnalyzed} candles (${result.latencyMs}ms)`);
      return result;
    } catch (err) {
      addLog("error", "error", `Replay failed: ${err instanceof Error ? err.message : "unknown"}`);
      throw err;
    }
  }, [addLog]);

  const updateRisk = useCallback((patch: Partial<RiskSettings>) => {
    setRisk((r) => ({ ...r, ...patch }));
    addLog("info", "system", "Risk settings updated", patch);
  }, [addLog]);

  const toggleStrategy = useCallback((id: string) => {
    setStrategyHealth((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
    addLog("info", "system", `Strategy toggled: ${id}`);
  }, [addLog]);

  return (
    <BotContext.Provider value={{
      mode, isScanning, lastScanAt, scanLatencyMs, lastExecutionLatencyMs, pairsScanned,
      signals, signalHistory, positions, closedPositions, replacementQueue, risk, strategyHealth,
      logs, confidenceLog, wallet, scoreboard, validation, lastReplacementAt, dataProvider,
      startBot, stopBot, setMode, runScanNow, runReplay: runReplayMode,
      closePosition, killAll, resetWallet, updateRisk, toggleStrategy, addLog,
      executionLogs, errorLogs,
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

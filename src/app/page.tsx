"use client";

import { useMemo, useState } from "react";
import { useSignals } from "@/hooks/useSignals";
import { useBinancePriceFeed } from "@/hooks/useBinancePriceFeed";
import { buildSignalWithPnl } from "@/lib/pnl";
import type { SignalWithPnl } from "@/types/signal";
import AddSignalModal from "@/components/AddSignalModal";
import SignalRow from "@/components/SignalRow";
import StatCard from "@/components/StatCard";
import PriceTicker from "@/components/PriceTicker";

const TICKER_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

type FilterTab = "ALL" | "ACTIVE" | "CLOSED" | "CANCELLED";

export default function Dashboard() {
  const { signals, hydrated, addSignal, closeSignal, cancelSignal, deleteSignal } =
    useSignals();

  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("ACTIVE");
  const [sortBy, setSortBy] = useState<"time" | "pnl">("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Collect all unique symbols from active signals + ticker symbols
  const allSymbols = useMemo(() => {
    const fromSignals = signals.map((s) => s.symbol);
    return [...new Set([...TICKER_SYMBOLS, ...fromSignals])];
  }, [signals]);

  const prices = useBinancePriceFeed(allSymbols);

  // Build enriched signals with live PnL
  const enriched: SignalWithPnl[] = useMemo(
    () =>
      signals.map((s) => {
        const ticker = prices[s.symbol];
        // Use closed price for closed signals so PnL is locked
        const priceToUse =
          s.status !== "ACTIVE" && s.closedPrice
            ? s.closedPrice
            : ticker?.price ?? s.entryPrice;
        return buildSignalWithPnl(s, priceToUse, ticker?.priceChange24h);
      }),
    [signals, prices]
  );

  // Stats
  const activeSignals = enriched.filter((s) => s.status === "ACTIVE");
  const closedSignals = enriched.filter((s) => s.status === "CLOSED");

  const totalActivePnl = activeSignals.reduce((acc, s) => acc + s.pnlPercent, 0);
  const avgActivePnl =
    activeSignals.length > 0 ? totalActivePnl / activeSignals.length : 0;

  const winCount = closedSignals.filter((s) => s.pnlPercent > 0).length;
  const winRate =
    closedSignals.length > 0 ? (winCount / closedSignals.length) * 100 : 0;

  // Filtered + sorted list
  const displayed = useMemo(() => {
    const filtered =
      filter === "ALL" ? enriched : enriched.filter((s) => s.status === filter);

    return [...filtered].sort((a, b) => {
      const val = sortBy === "pnl" ? a.pnlPercent - b.pnlPercent : a.addedAt - b.addedAt;
      return sortDir === "asc" ? val : -val;
    });
  }, [enriched, filter, sortBy, sortDir]);

  function toggleSort(col: "time" | "pnl") {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
  }

  const sortIcon = (col: "time" | "pnl") =>
    sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">
                C
              </div>
              <h1 className="text-lg font-bold text-white">Crypto Signal Dashboard</h1>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors flex items-center gap-1.5"
            >
              <span className="text-lg leading-none">+</span> Add Signal
            </button>
          </div>
          <PriceTicker prices={prices} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Active Signals"
            value={String(activeSignals.length)}
            color="blue"
          />
          <StatCard
            label="Avg Active PnL"
            value={`${avgActivePnl >= 0 ? "+" : ""}${avgActivePnl.toFixed(2)}%`}
            sub="across active signals"
            color={avgActivePnl >= 0 ? "green" : "red"}
          />
          <StatCard
            label="Closed Signals"
            value={String(closedSignals.length)}
          />
          <StatCard
            label="Win Rate"
            value={closedSignals.length ? `${winRate.toFixed(0)}%` : "—"}
            sub={`${winCount} / ${closedSignals.length} wins`}
            color={winRate >= 50 ? "green" : "red"}
          />
        </div>

        {/* Signal table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Tabs + sort */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex gap-1">
              {(["ACTIVE", "ALL", "CLOSED", "CANCELLED"] as FilterTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    filter === t
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2 text-xs text-gray-400">
              <button
                onClick={() => toggleSort("time")}
                className="hover:text-white transition-colors"
              >
                Time{sortIcon("time")}
              </button>
              <button
                onClick={() => toggleSort("pnl")}
                className="hover:text-white transition-colors"
              >
                PnL{sortIcon("pnl")}
              </button>
            </div>
          </div>

          {displayed.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-3">📡</p>
              <p className="font-semibold text-gray-400">No signals yet</p>
              <p className="text-sm mt-1">
                Click <strong className="text-white">+ Add Signal</strong> to start tracking.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-3 text-left">Pair</th>
                    <th className="px-4 py-3 text-left">Entry</th>
                    <th className="px-4 py-3 text-left">Current</th>
                    <th className="px-4 py-3 text-left">PnL</th>
                    <th className="px-4 py-3 text-left">TP / SL</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Added</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((s) => (
                    <SignalRow
                      key={s.id}
                      signal={s}
                      onClose={closeSignal}
                      onCancel={cancelSignal}
                      onDelete={deleteSignal}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-600 text-center">
          Prices via Binance WebSocket · PnL = (current − entry) / entry × leverage ·
          Entry is locked at the live price when you add a signal → always starts at 0.00%
        </p>
      </main>

      {showModal && (
        <AddSignalModal
          prices={prices}
          onAdd={addSignal}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useBot } from "@/context/BotContext";
import { Badge } from "@/components/shared/ui";
import type { ReplayResult } from "@/lib/trading/replay";

export default function ReplayPage() {
  const { runReplay, scoreboard, strategyHealth } = useBot();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReplayResult | null>(null);

  async function handleReplay() {
    setLoading(true);
    try {
      const r = await runReplay(symbol);
      setResult(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Replay & Backtest</h1>
        <p className="text-xs text-gray-500">Re-run strategies on historical 15m candles to validate logic</p>
      </div>

      <div className="flex gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Symbol</label>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-40" />
        </div>
        <button onClick={handleReplay} disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-sm font-semibold">
          {loading ? "Running…" : "Run Replay"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500">Paper Win Rate</p>
          <p className="text-xl font-bold">{scoreboard.winRate.toFixed(1)}%</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500">Paper Profit Factor</p>
          <p className="text-xl font-bold">{scoreboard.profitFactor.toFixed(2)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500">Paper Trades</p>
          <p className="text-xl font-bold">{scoreboard.totalTrades}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500">Expectancy</p>
          <p className="text-xl font-bold">${scoreboard.expectancy.toFixed(2)}</p>
        </div>
      </div>

      {result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-bold">{result.symbol} — {result.signals.length} historical signals ({result.candlesAnalyzed} candles, {result.latencyMs}ms)</h2>
          </div>
          <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
            {result.signals.slice(0, 20).map((s, i) => (
              <div key={`${s.scannedAt}-${i}`} className="px-4 py-2 flex justify-between text-xs">
                <span>#{i + 1} <Badge color={s.direction === "LONG" ? "green" : "red"}>{s.direction}</Badge> @ ${s.price.toFixed(2)}</span>
                <span className="text-blue-400 font-bold">{s.confidence}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-bold mb-3">Strategy Health (Paper)</h2>
        <div className="grid gap-2">
          {strategyHealth.map((s) => (
            <div key={s.id} className="flex justify-between text-xs bg-gray-800/50 rounded-lg px-3 py-2">
              <span>{s.name} {s.enabled ? "" : "(off)"}</span>
              <span>WR {s.winRate.toFixed(0)}% · PF {s.profitFactor.toFixed(2)} · {s.totalTrades} trades · RR {s.avgRR.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

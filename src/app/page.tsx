"use client";

import { useBot } from "@/context/BotContext";
import BotControls from "@/components/layout/BotControls";
import { StatCard } from "@/components/shared/ui";

export default function OverviewPage() {
  const {
    mode, isScanning, lastScanAt, scanLatencyMs, pairsScanned,
    signals, positions, totalPnlUsd, paperBalance, risk,
  } = useBot();

  const open = positions.filter((p) => p.status === "OPEN");
  const topSignals = signals.slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold">Overview</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Auto-scanning top 100 USDT perpetual futures · every 45s
          </p>
        </div>
        <BotControls />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Bot Mode" value={mode} color={mode === "PAPER" ? "yellow" : "white"} />
        <StatCard label="Paper Balance" value={`$${paperBalance.toFixed(2)}`} color="blue" />
        <StatCard label="Total PnL" value={`${totalPnlUsd >= 0 ? "+" : ""}$${totalPnlUsd.toFixed(2)}`} color={totalPnlUsd >= 0 ? "green" : "red"} />
        <StatCard label="Open Positions" value={`${open.length} / ${risk.maxOpenPositions}`} color="white" />
        <StatCard label="Signals Found" value={String(signals.length)} sub={`${pairsScanned} pairs scanned`} color="blue" />
        <StatCard label="Scan Latency" value={`${scanLatencyMs}ms`} sub={lastScanAt ? new Date(lastScanAt).toLocaleTimeString() : "Never"} color="white" />
        <StatCard label="Min Confidence" value={`${risk.minConfidence}%`} color="yellow" />
        <StatCard label="Status" value={isScanning ? "SCANNING" : "IDLE"} color={isScanning ? "green" : "white"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top signals */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-bold">Top Signals</h2>
          </div>
          {topSignals.length === 0 ? (
            <p className="p-6 text-center text-gray-500 text-sm">Click &quot;Scan Now&quot; or Start Bot to scan markets</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {topSignals.map((s) => (
                <div key={s.symbol} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm">{s.symbol.replace("USDT", "")}</span>
                    <span className={`ml-2 text-xs font-semibold ${s.direction === "LONG" ? "text-green-400" : "text-red-400"}`}>
                      {s.direction}
                    </span>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {s.agreeingStrategies}/{s.totalStrategies} strategies agree
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-400">{s.confidence}%</p>
                    <p className="text-[10px] text-gray-500">${s.price.toFixed(4)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Open positions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-bold">Open Positions</h2>
          </div>
          {open.length === 0 ? (
            <p className="p-6 text-center text-gray-500 text-sm">No open positions</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {open.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm">{p.symbol.replace("USDT", "")}</span>
                    <span className={`ml-2 text-xs ${p.direction === "LONG" ? "text-green-400" : "text-red-400"}`}>{p.direction}</span>
                    <p className="text-[10px] text-gray-500">{p.leverage}x · conf {p.confidence}%</p>
                  </div>
                  <p className={`font-bold ${p.pnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(2)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

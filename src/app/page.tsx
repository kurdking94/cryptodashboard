"use client";

import { useBot } from "@/context/BotContext";
import BotControls from "@/components/layout/BotControls";
import { StatCard, Badge } from "@/components/shared/ui";

function ValidationRow({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <Badge color={pass ? "green" : "gray"}>{pass ? "PASS" : "PENDING"}</Badge>
    </div>
  );
}

export default function OverviewPage() {
  const {
    mode, isScanning, lastScanAt, scanLatencyMs, lastExecutionLatencyMs,
    pairsScanned, signals, positions, wallet, scoreboard, risk, validation,
  } = useBot();

  const open = positions.filter((p) => p.status === "OPEN");
  const topSignals = signals.slice(0, 5);
  const passCount = Object.values(validation).filter(Boolean).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold">Paper Simulator</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            ${risk.initialBalance} wallet · {risk.positionSizePercent}% per trade · {risk.maxLeverage}x leverage · auto-scan every 45s
          </p>
        </div>
        <BotControls />
      </div>

      {/* Virtual Wallet */}
      <div className="bg-gradient-to-r from-blue-900/30 to-gray-900 border border-blue-800/40 rounded-xl p-5">
        <h2 className="text-sm font-bold text-blue-400 mb-3">Virtual Wallet</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
          <div><span className="text-gray-500">Balance</span><p className="text-lg font-bold text-white">${wallet.balance.toFixed(2)}</p></div>
          <div><span className="text-gray-500">Equity</span><p className="text-lg font-bold text-white">${wallet.equity.toFixed(2)}</p></div>
          <div><span className="text-gray-500">Used Margin</span><p className="text-lg font-bold text-yellow-400">${wallet.usedMargin.toFixed(2)}</p></div>
          <div><span className="text-gray-500">Available</span><p className="text-lg font-bold text-green-400">${wallet.availableMargin.toFixed(2)}</p></div>
          <div><span className="text-gray-500">Unrealized PnL</span><p className={`text-lg font-bold ${wallet.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>${wallet.unrealizedPnl.toFixed(2)}</p></div>
          <div><span className="text-gray-500">Per Trade</span><p className="text-lg font-bold text-white">${(wallet.balance * risk.positionSizePercent / 100).toFixed(2)}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Mode" value={mode} color={mode === "PAPER" ? "yellow" : "white"} />
        <StatCard label="Open / Max" value={`${open.length} / ${risk.maxOpenPositions}`} color="blue" />
        <StatCard label="Scan Latency" value={`${scanLatencyMs}ms`} sub={lastScanAt ? new Date(lastScanAt).toLocaleTimeString() : "—"} color="white" />
        <StatCard label="Exec Latency" value={`${lastExecutionLatencyMs}ms`} sub="signal → trade" color="white" />
        <StatCard label="Win Rate" value={`${scoreboard.winRate.toFixed(1)}%`} sub={`${scoreboard.wins}W / ${scoreboard.losses}L`} color={scoreboard.winRate >= 50 ? "green" : "red"} />
        <StatCard label="Profit Factor" value={scoreboard.profitFactor.toFixed(2)} color="white" />
        <StatCard label="Max Drawdown" value={`$${scoreboard.maxDrawdown.toFixed(2)}`} color="red" />
        <StatCard label="Avg R:R" value={scoreboard.avgRR.toFixed(2)} color="white" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Validation checklist */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold">Simulator Validation</h2>
            <Badge color={passCount === 5 ? "green" : "yellow"}>{passCount}/5</Badge>
          </div>
          <ValidationRow label="1. Detects live signals" pass={validation.liveSignals} />
          <ValidationRow label="2. Ranks by confidence" pass={validation.confidenceRanking} />
          <ValidationRow label="3. Opens at correct price" pass={validation.correctEntry} />
          <ValidationRow label="4. Closes at TP/SL" pass={validation.correctExit} />
          <ValidationRow label="5. Replaces closed trades" pass={validation.replacement} />
        </div>

        {/* Top signals */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 border-b border-gray-800 flex justify-between">
            <h2 className="text-sm font-bold">Live Signal Feed</h2>
            <span className="text-xs text-gray-500">{signals.length} signals · {pairsScanned} scanned</span>
          </div>
          {topSignals.length === 0 ? (
            <p className="p-6 text-center text-gray-500 text-sm">Click Scan Now or Start Bot</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {topSignals.map((s, i) => (
                <div key={s.symbol} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-gray-500 text-xs">#{i + 1}</span>
                      <span className="font-bold text-sm ml-2">{s.symbol.replace("USDT", "")}</span>
                      <Badge color={s.direction === "LONG" ? "green" : "red"}>{s.direction}</Badge>
                    </div>
                    <p className="text-lg font-bold text-blue-400">{s.confidence}%</p>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">{s.rankingReason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Open positions summary */}
      {open.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-bold mb-3">Open Virtual Trades</h2>
          <div className="grid gap-2">
            {open.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs bg-gray-800/50 rounded-lg px-3 py-2">
                <span className="font-bold">{p.symbol.replace("USDT", "")} {p.direction} {p.leverage}x</span>
                <span className="text-gray-500">margin ${p.marginUsed.toFixed(2)} → ${p.notionalValue.toFixed(2)}</span>
                <span className={p.pnlPercent >= 0 ? "text-green-400" : "text-red-400"}>
                  {p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

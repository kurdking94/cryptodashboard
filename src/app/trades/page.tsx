"use client";

import { useBot } from "@/context/BotContext";
import { Badge, fmtPrice } from "@/components/shared/ui";

export default function TradesPage() {
  const { positions, closedPositions, replacementQueue, closePosition } = useBot();
  const open = positions.filter((p) => p.status === "OPEN");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Trade Management</h1>
        <p className="text-xs text-gray-500">Open positions · TP/SL · liquidation risk · auto-replacement queue</p>
      </div>

      {/* Open positions */}
      <div>
        <h2 className="text-sm font-bold mb-3">Open Positions ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-gray-500 text-sm">No open positions. Start the bot to auto-trade top signals.</p>
        ) : (
          <div className="grid gap-3">
            {open.map((p) => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold">{p.symbol.replace("USDT", "")}</span>
                    <Badge color={p.direction === "LONG" ? "green" : "red"}>{p.direction}</Badge>
                    <span className="text-xs text-yellow-400 ml-2">{p.leverage}x</span>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${p.pnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-500">${p.pnlUsd.toFixed(2)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
                  <div><span className="text-gray-500">Entry</span><p>${fmtPrice(p.entryPrice)}</p></div>
                  <div><span className="text-gray-500">Current</span><p>${fmtPrice(p.currentPrice)}</p></div>
                  <div><span className="text-gray-500">TP</span><p className="text-green-400">${fmtPrice(p.takeProfit)}</p></div>
                  <div><span className="text-gray-500">SL</span><p className="text-red-400">${fmtPrice(p.stopLoss)}</p></div>
                  <div><span className="text-gray-500">Liq. Price</span><p className="text-orange-400">${fmtPrice(p.liquidationPrice)}</p></div>
                  <div><span className="text-gray-500">Size</span><p>${p.size}</p></div>
                  <div><span className="text-gray-500">Conf</span><p>{p.confidence}%</p></div>
                  <div><span className="text-gray-500">Strategies</span><p>{p.strategies.join(", ")}</p></div>
                </div>
                <button onClick={() => closePosition(p.id)}
                  className="px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-white">
                  Manual Close
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Replacement queue */}
      <div>
        <h2 className="text-sm font-bold mb-3">Auto-Replacement Queue</h2>
        <p className="text-xs text-gray-500 mb-2">When a position closes at TP/SL, the bot picks the next highest-confidence signal from this queue.</p>
        {replacementQueue.length === 0 ? (
          <p className="text-gray-500 text-sm">Queue empty — run a scan first</p>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
            {replacementQueue.map((s, i) => (
              <div key={s.symbol} className="px-4 py-2 flex items-center justify-between text-xs">
                <span className="text-gray-500">#{i + 1}</span>
                <span className="font-bold">{s.symbol.replace("USDT", "")}</span>
                <Badge color={s.direction === "LONG" ? "green" : "red"}>{s.direction}</Badge>
                <span className="text-blue-400 font-bold">{s.confidence}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Closed history */}
      <div>
        <h2 className="text-sm font-bold mb-3">Closed Trades ({closedPositions.length})</h2>
        {closedPositions.length === 0 ? (
          <p className="text-gray-500 text-sm">No closed trades yet</p>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="px-3 py-2 text-left">Pair</th>
                  <th className="px-3 py-2 text-left">Dir</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">PnL</th>
                  <th className="px-3 py-2 text-left">Closed</th>
                </tr>
              </thead>
              <tbody>
                {[...closedPositions].reverse().slice(0, 20).map((p) => (
                  <tr key={p.id} className="border-b border-gray-800/50">
                    <td className="px-3 py-2 font-bold">{p.symbol.replace("USDT", "")}</td>
                    <td className="px-3 py-2">{p.direction}</td>
                    <td className="px-3 py-2"><Badge color={p.status.includes("TP") ? "green" : "red"}>{p.status}</Badge></td>
                    <td className={`px-3 py-2 font-bold ${p.pnlUsd >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {p.pnlUsd >= 0 ? "+" : ""}${p.pnlUsd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{p.closedAt ? new Date(p.closedAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

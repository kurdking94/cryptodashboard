"use client";

import { useBot } from "@/context/BotContext";
import { getPositionTpLevels } from "@/lib/risk/manager";
import { Badge, fmtPrice } from "@/components/shared/ui";

export default function TradesPage() {
  const { positions, closedPositions, replacementQueue, closePosition, wallet, risk, lastReplacementAt } = useBot();
  const open = positions.filter((p) => p.status === "OPEN");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Virtual Trades</h1>
        <p className="text-xs text-gray-500">
          ${wallet.balance.toFixed(2)} balance · closes at TP3, SL, or manual only
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 text-xs">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500">Used Margin</p>
          <p className="text-xl font-bold text-yellow-400">${wallet.usedMargin.toFixed(2)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500">Available</p>
          <p className="text-xl font-bold text-green-400">${wallet.availableMargin.toFixed(2)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500">Last Replacement</p>
          <p className="text-sm font-bold">{lastReplacementAt ? new Date(lastReplacementAt).toLocaleTimeString() : "—"}</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold mb-3">Open ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-gray-500 text-sm">No open virtual trades</p>
        ) : (
          <div className="grid gap-3">
            {open.map((p) => {
              const tp = getPositionTpLevels(p);
              return (
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <div>
                      <span className="font-bold">{p.symbol.replace("USDT", "")}</span>
                      <Badge color={p.direction === "LONG" ? "green" : "red"}>{p.direction}</Badge>
                      <span className="text-xs text-yellow-400 ml-2">{p.leverage}x</span>
                    </div>
                    <p className={`font-bold ${p.pnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(2)}% (${p.pnlUsd.toFixed(2)})
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                    <div><span className="text-gray-500">Entry</span><p>${fmtPrice(p.entryPrice)}</p></div>
                    <div><span className="text-gray-500">Current</span><p>${fmtPrice(p.currentPrice)}</p></div>
                    <div><span className="text-gray-500">Margin</span><p>${p.marginUsed.toFixed(2)}</p></div>
                    <div><span className="text-gray-500">Notional</span><p>${p.notionalValue.toFixed(2)}</p></div>
                    <div><span className="text-gray-500">TP1</span><p className="text-green-400/80">${fmtPrice(tp.tp1)}</p></div>
                    <div><span className="text-gray-500">TP2</span><p className="text-green-400/80">${fmtPrice(tp.tp2)}</p></div>
                    <div><span className="text-gray-500">TP3 (exit)</span><p className="text-green-400 font-semibold">${fmtPrice(tp.tp3)}</p></div>
                    <div><span className="text-gray-500">TP4</span><p className="text-green-400/80">${fmtPrice(tp.tp4)}</p></div>
                    <div><span className="text-gray-500">SL (exit)</span><p className="text-red-400">${fmtPrice(p.stopLoss)}</p></div>
                    <div><span className="text-gray-500">Liq.</span><p className="text-orange-400">${fmtPrice(p.liquidationPrice)}</p></div>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-2">
                    Conf {p.confidence}% · Entry locked @ ${fmtPrice(p.entryPrice)} · PnL starts at 0%
                  </p>
                  <button onClick={() => closePosition(p.id)} className="px-3 py-1 rounded-lg bg-gray-700 text-xs hover:bg-gray-600">
                    Manual Close
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-bold mb-3">Replacement Queue ({replacementQueue.length})</h2>
        {replacementQueue.length === 0 ? (
          <p className="text-gray-500 text-sm">Empty — run scan</p>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
            {replacementQueue.map((s) => (
              <div key={s.id} className="px-4 py-2 flex justify-between text-xs flex-wrap gap-2">
                <span>
                  {s.symbol.replace("USDT", "")} <Badge color={s.direction === "LONG" ? "green" : "red"}>{s.direction}</Badge>
                </span>
                <span className="text-gray-500">
                  TP3 ${fmtPrice(s.takeProfits.tp3)} · SL ${fmtPrice(s.stopLoss)}
                </span>
                <span className="text-blue-400 font-bold">{s.confidence}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-bold mb-3">Closed History</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="px-3 py-2 text-left">Pair</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Entry</th>
                <th className="px-3 py-2 text-left">Exit</th>
                <th className="px-3 py-2 text-left">Margin</th>
                <th className="px-3 py-2 text-left">PnL</th>
                <th className="px-3 py-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {[...closedPositions].reverse().slice(0, 50).map((p) => (
                <tr key={p.id} className="border-b border-gray-800/50">
                  <td className="px-3 py-2 font-bold">{p.symbol.replace("USDT", "")}</td>
                  <td className="px-3 py-2"><Badge color={p.status.includes("TP") ? "green" : "red"}>{p.status}</Badge></td>
                  <td className="px-3 py-2">${fmtPrice(p.entryPrice)}</td>
                  <td className="px-3 py-2">${fmtPrice(p.closedPrice ?? 0)}</td>
                  <td className="px-3 py-2">${p.marginUsed.toFixed(2)}</td>
                  <td className={`px-3 py-2 font-bold ${p.pnlUsd >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {p.pnlUsd >= 0 ? "+" : ""}${p.pnlUsd.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{p.exitReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

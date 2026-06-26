"use client";

import { useBot } from "@/context/BotContext";
import { Badge } from "@/components/shared/ui";

export default function StrategiesPage() {
  const { strategyHealth, signals, toggleStrategy } = useBot();

  const latestByStrategy = (id: string) => {
    for (const sig of signals) {
      const s = sig.strategies.find((st) => st.id === id);
      if (s) return s;
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Strategy Lab</h1>
        <p className="text-xs text-gray-500">Per-strategy performance · toggle to enable/disable · combined into confidence score</p>
      </div>

      <div className="grid gap-4">
        {strategyHealth.map((s) => {
          const live = latestByStrategy(s.id);
          return (
            <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-sm">{s.name}</h3>
                  <Badge color={s.enabled ? "green" : "gray"}>{s.enabled ? "ON" : "OFF"}</Badge>
                  {live && live.direction !== "NEUTRAL" && (
                    <Badge color={live.direction === "LONG" ? "green" : "red"}>
                      {live.direction} {live.confidence.toFixed(0)}%
                    </Badge>
                  )}
                </div>
                <button
                  onClick={() => toggleStrategy(s.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${s.enabled ? "bg-red-900/40 text-red-400" : "bg-green-900/40 text-green-400"}`}
                >
                  {s.enabled ? "Disable" : "Enable"}
                </button>
              </div>

              {live && <p className="text-xs text-gray-400 mb-3">{live.reason}</p>}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div><span className="text-gray-500">Win Rate</span><p className="font-bold text-white">{s.winRate.toFixed(1)}%</p></div>
                <div><span className="text-gray-500">Trades</span><p className="font-bold">{s.totalTrades}</p></div>
                <div><span className="text-gray-500">Avg Win</span><p className="font-bold text-green-400">${s.avgWin.toFixed(2)}</p></div>
                <div><span className="text-gray-500">Avg Loss</span><p className="font-bold text-red-400">${s.avgLoss.toFixed(2)}</p></div>
                <div><span className="text-gray-500">Profit Factor</span><p className="font-bold">{s.profitFactor.toFixed(2)}</p></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-4 text-xs text-yellow-300">
        <strong>How confidence works:</strong> Each strategy votes LONG/SHORT/NEUTRAL.
        Signals need ≥2 agreeing strategies. Confidence = average strategy score + agreement bonus + volume/whale filters − news risk penalty.
        Higher agreement = higher rank in scanner.
      </div>
    </div>
  );
}

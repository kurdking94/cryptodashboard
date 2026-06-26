"use client";

import { useState } from "react";
import { useBot } from "@/context/BotContext";
import { Badge, fmtPrice } from "@/components/shared/ui";

type Tab = "execution" | "confidence" | "errors" | "all";

export default function LogsPage() {
  const { logs, executionLogs, errorLogs, confidenceLog } = useBot();
  const [tab, setTab] = useState<Tab>("execution");

  const LEVEL_COLORS: Record<string, string> = {
    info: "text-blue-400", warn: "text-yellow-400", error: "text-red-400",
    trade: "text-green-400", signal: "text-purple-400",
  };

  const displayLogs = tab === "execution" ? executionLogs : tab === "errors" ? errorLogs : tab === "all" ? logs : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Logs & Debug</h1>
        <p className="text-xs text-gray-500">Execution log · confidence ranking · errors</p>
      </div>

      <div className="flex gap-2">
        {(["execution", "confidence", "errors", "all"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${tab === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "confidence" ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {confidenceLog.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">No confidence logs — run a scan first</p>
          ) : (
            <div className="divide-y divide-gray-800/50 max-h-[70vh] overflow-y-auto">
              {[...confidenceLog].reverse().map((e) => (
                <div key={e.id} className="px-4 py-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span><span className="text-gray-500">#{e.rank}</span> <strong>{e.symbol.replace("USDT", "")}</strong> <Badge color={e.direction === "LONG" ? "green" : "red"}>{e.direction}</Badge></span>
                    <span className="text-blue-400 font-bold">{e.confidence}%</span>
                  </div>
                  <p className="text-gray-400">{e.rankingReason}</p>
                  <p className="text-gray-600 mt-1">
                    Strategies: {e.agreeing.join(", ")}
                    {e.blocked && <span className="text-red-400"> · BLOCKED: {e.blocked}</span>}
                  </p>
                  <p className="text-gray-600">
                    Breakdown: base {e.breakdown.strategyAvg} + agree {e.breakdown.agreementBonus} + vol {e.breakdown.volumeBonus} + whale {e.breakdown.whaleBonus} × news {e.breakdown.newsMultiplier} = {e.breakdown.final}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {displayLogs.length === 0 ? (
            <p className="p-8 text-center text-gray-500 text-sm">No logs in this category</p>
          ) : (
            <div className="divide-y divide-gray-800/50 max-h-[70vh] overflow-y-auto">
              {[...displayLogs].reverse().map((log) => (
                <div key={log.id} className="px-4 py-2 flex items-start gap-3 text-xs">
                  <span className="text-gray-600 shrink-0 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={`uppercase font-bold shrink-0 w-16 ${LEVEL_COLORS[log.level] ?? "text-gray-400"}`}>{log.category}</span>
                  <span className="text-gray-300">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

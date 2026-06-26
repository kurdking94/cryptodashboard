"use client";

import { useState } from "react";
import { useBot } from "@/context/BotContext";
import BotControls from "@/components/layout/BotControls";
import { Badge, fmtPrice } from "@/components/shared/ui";

export default function ScannerPage() {
  const { signals, isScanning, lastScanAt, scanLatencyMs, pairsScanned } = useBot();
  const [filter, setFilter] = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [minConf, setMinConf] = useState(0);

  const filtered = signals
    .filter((s) => filter === "ALL" || s.direction === filter)
    .filter((s) => s.confidence >= minConf);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold">Market Scanner</h1>
          <p className="text-xs text-gray-500">
            Top 100 futures · all 28 strategies × 45m/1h/4h · {pairsScanned} analyzed per scan
            {lastScanAt && ` · ${new Date(lastScanAt).toLocaleTimeString()} (${scanLatencyMs}ms)`}
          </p>
        </div>
        <BotControls />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {(["ALL", "LONG", "SHORT"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold ${filter === f ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
            {f}
          </button>
        ))}
        <label className="text-xs text-gray-500 ml-4">
          Min conf: {minConf}%
          <input type="range" min={0} max={90} value={minConf} onChange={(e) => setMinConf(+e.target.value)}
            className="ml-2 w-24 accent-blue-500" />
        </label>
        {isScanning && <span className="text-xs text-green-400 animate-pulse">Scanning…</span>}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 uppercase">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Pair</th>
              <th className="px-3 py-2 text-left">Dir</th>
              <th className="px-3 py-2 text-left">Conf</th>
              <th className="px-3 py-2 text-left">Price</th>
              <th className="px-3 py-2 text-left">24h</th>
              <th className="px-3 py-2 text-left">Vol (USDT)</th>
              <th className="px-3 py-2 text-left">Spread</th>
              <th className="px-3 py-2 text-left">Volatility</th>
              <th className="px-3 py-2 text-left">Strategies</th>
              <th className="px-3 py-2 text-left">Whale</th>
              <th className="px-3 py-2 text-left">News</th>
              <th className="px-3 py-2 text-left">TF Align</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={13} className="text-center py-12 text-gray-500">
                {isScanning ? "Scanning markets…" : "No signals — click Scan Now"}
              </td></tr>
            ) : filtered.map((s, i) => (
              <tr key={s.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                <td className="px-3 py-2 font-bold">{s.symbol.replace("USDT", "")}</td>
                <td className="px-3 py-2">
                  <Badge color={s.direction === "LONG" ? "green" : "red"}>{s.direction}</Badge>
                </td>
                <td className="px-3 py-2 font-bold text-blue-400">{s.confidence}%</td>
                <td className="px-3 py-2 font-mono">${fmtPrice(s.price)}</td>
                <td className={`px-3 py-2 ${s.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {s.change24h >= 0 ? "+" : ""}{s.change24h.toFixed(2)}%
                </td>
                <td className="px-3 py-2">{(s.quoteVolume24h / 1e6).toFixed(1)}M</td>
                <td className="px-3 py-2">{s.spread.toFixed(3)}%</td>
                <td className="px-3 py-2">{s.volatility.toFixed(2)}%</td>
                <td className="px-3 py-2">{s.agreeingStrategies}/{s.totalStrategies}</td>
                <td className="px-3 py-2">{s.whaleScore}</td>
                <td className="px-3 py-2">{s.newsScore}</td>
                <td className="px-3 py-2">
                  {Object.entries(s.timeframes).map(([tf, bias]) => (
                    <span key={tf} className={`mr-1 ${bias === "BULLISH" ? "text-green-400" : bias === "BEARISH" ? "text-red-400" : "text-gray-600"}`}>
                      {tf}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

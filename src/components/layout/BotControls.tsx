"use client";

import { useBot } from "@/context/BotContext";

export default function BotControls() {
  const { mode, isScanning, startBot, stopBot, setMode, runScanNow, killAll, resetWallet, risk } = useBot();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as "OFF" | "PAPER" | "LIVE")}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white"
      >
        <option value="OFF">OFF</option>
        <option value="PAPER">PAPER</option>
        <option value="LIVE">LIVE</option>
      </select>
      <button onClick={startBot} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold">Start Bot</button>
      <button onClick={stopBot} className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold">Stop</button>
      <button onClick={runScanNow} disabled={isScanning} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold">
        {isScanning ? "Scanning…" : "Scan Now"}
      </button>
      <button onClick={resetWallet} className="px-3 py-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-semibold">Reset $100</button>
      <button onClick={killAll} className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-bold">KILL SWITCH</button>
      {risk.killSwitch && <span className="text-xs text-red-400 font-bold animate-pulse">⚠ KILL ACTIVE</span>}
    </div>
  );
}

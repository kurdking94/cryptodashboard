"use client";

import { useBot } from "@/context/BotContext";

export default function RiskPage() {
  const { risk, updateRisk, killAll, wallet, positions } = useBot();
  const open = positions.filter((p) => p.status === "OPEN");
  const exposure = open.reduce((s, p) => s + p.notionalValue, 0);
  const marginPerTrade = wallet.balance * risk.positionSizePercent / 100;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Risk Controls</h1>
        <p className="text-xs text-gray-500">${risk.initialBalance} wallet · {risk.positionSizePercent}% = ${marginPerTrade.toFixed(2)}/trade · {risk.maxLeverage}x</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500">Total Notional Exposure</p>
          <p className="text-xl font-bold text-orange-400">${exposure.toFixed(0)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500">Daily Loss</p>
          <p className="text-xl font-bold text-red-400">${risk.dailyLossUsd.toFixed(2)} / ${risk.dailyLossLimitUsd}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500">Margin Per Trade</p>
          <p className="text-xl font-bold">${marginPerTrade.toFixed(2)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500">Kill Switch</p>
          <p className={`text-xl font-bold ${risk.killSwitch ? "text-red-400" : "text-green-400"}`}>{risk.killSwitch ? "ACTIVE" : "OFF"}</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        <Slider label="Leverage" value={risk.maxLeverage} min={1} max={50} onChange={(v) => updateRisk({ maxLeverage: v })} suffix="x" />
        <Slider label="Position Size (% of balance)" value={risk.positionSizePercent} min={1} max={25} onChange={(v) => updateRisk({ positionSizePercent: v })} suffix="%" />
        <Slider label="Max Open Positions" value={risk.maxOpenPositions} min={1} max={10} onChange={(v) => updateRisk({ maxOpenPositions: v })} />
        <Slider label="Daily Loss Limit" value={risk.dailyLossLimitUsd} min={5} max={50} onChange={(v) => updateRisk({ dailyLossLimitUsd: v })} prefix="$" />
        <Slider label="Min Confidence" value={risk.minConfidence} min={50} max={95} onChange={(v) => updateRisk({ minConfidence: v })} suffix="%" />
        <Slider label="Cooldown After Loss" value={risk.cooldownMinutes} min={0} max={60} onChange={(v) => updateRisk({ cooldownMinutes: v })} suffix=" min" />
      </div>

      <div className="flex gap-3">
        <button onClick={() => updateRisk({ killSwitch: false, dailyLossUsd: 0 })}
          className="px-4 py-2 rounded-xl bg-green-700 hover:bg-green-600 text-sm font-semibold">
          Reset Kill Switch & Daily Loss
        </button>
        <button onClick={killAll} className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-bold">
          EMERGENCY KILL ALL
        </button>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, prefix = "", suffix = "" }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; prefix?: string; suffix?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-bold">{prefix}{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} className="w-full accent-blue-500" />
    </div>
  );
}

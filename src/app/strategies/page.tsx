"use client";

import { useBot } from "@/context/BotContext";
import { Badge } from "@/components/shared/ui";

export default function StrategiesPage() {
  const { strategyHealth, signals, toggleStrategy } = useBot();

  const latestByStrategy = (id: string) => {
    for (const sig of signals) {
      const s = sig.strategies.find((st) => st.id === id);
      if (s && s.direction !== "NEUTRAL") return s;
    }
    return null;
  };

  const categories = [
    { title: "Trend & Momentum", ids: ["ema_cross", "macd_custom", "supertrend", "adx_di", "trend_align", "ut_bot"] },
    { title: "Mean Reversion", ids: ["rsi_momentum", "bb_rsi", "williams_vix_fix", "wavetrend", "squeeze_momentum"] },
    { title: "Structure & S/R", ids: ["smc", "trendline_breaks", "sr_breaks", "sr_channels", "msb_orderblock", "liquidation_sweep"] },
    { title: "Volume & Flow", ids: ["volume_breakout", "cvd_divergence", "flush_cvd_breakout", "oi_price_matrix", "vwap_session"] },
    { title: "Derivatives & Funding", ids: ["funding_crowding_fade", "funding_carry_bias", "perp_basis_premium", "btc_relative_strength"] },
    { title: "Session & Regime", ids: ["ict_killzones", "regime_switch"] },
  ];

  const allIds = new Set(strategyHealth.map((s) => s.id));
  const shown = new Set<string>();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Strategy Lab</h1>
        <p className="text-xs text-gray-500">{strategyHealth.length} strategies · toggle on/off · combined into confidence score</p>
      </div>

      {categories.map((cat) => {
        const items = strategyHealth.filter((s) => cat.ids.includes(s.id));
        items.forEach((s) => shown.add(s.id));
        if (items.length === 0) return null;
        return (
          <div key={cat.title}>
            <h2 className="text-sm font-bold text-gray-400 mb-2">{cat.title}</h2>
            <div className="grid gap-3">
              {items.map((s) => {
                const live = latestByStrategy(s.id);
                return (
                  <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm">{s.name}</h3>
                        <Badge color={s.enabled ? "green" : "gray"}>{s.enabled ? "ON" : "OFF"}</Badge>
                        {live && <Badge color={live.direction === "LONG" ? "green" : "red"}>{live.direction} {live.confidence.toFixed(0)}%</Badge>}
                      </div>
                      <button onClick={() => toggleStrategy(s.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold ${s.enabled ? "bg-red-900/40 text-red-400" : "bg-green-900/40 text-green-400"}`}>
                        {s.enabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                    {live && <p className="text-xs text-gray-400 mb-2">{live.reason}</p>}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      <div><span className="text-gray-500">Win Rate</span><p className="font-bold">{s.winRate.toFixed(1)}%</p></div>
                      <div><span className="text-gray-500">Trades</span><p className="font-bold">{s.totalTrades}</p></div>
                      <div><span className="text-gray-500">PF</span><p className="font-bold">{s.profitFactor.toFixed(2)}</p></div>
                      <div><span className="text-gray-500">Avg R:R</span><p className="font-bold">{s.avgRR.toFixed(2)}</p></div>
                      <div><span className="text-gray-500">Max DD</span><p className="font-bold text-red-400">${s.maxDrawdown.toFixed(2)}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Any strategies not in categories */}
      {strategyHealth.filter((s) => !shown.has(s.id)).map((s) => (
        <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm">{s.name}</div>
      ))}
    </div>
  );
}

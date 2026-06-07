"use client";

import type { TickerData } from "@/hooks/useBinancePriceFeed";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

interface Props {
  prices: Record<string, TickerData>;
}

function fmtPrice(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export default function PriceTicker({ prices }: Props) {
  return (
    <div className="flex items-center gap-6 overflow-x-auto pb-1 scrollbar-hide">
      {SYMBOLS.map((sym) => {
        const t = prices[sym];
        const change = t?.priceChange24h ?? 0;
        const up = change >= 0;
        return (
          <div key={sym} className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400 font-semibold">
              {sym.replace("USDT", "")}
            </span>
            <span className="text-sm font-mono text-white">
              {t ? `$${fmtPrice(t.price)}` : "—"}
            </span>
            <span
              className={`text-xs font-mono ${up ? "text-green-400" : "text-red-400"}`}
            >
              {t ? `${up ? "+" : ""}${change.toFixed(2)}%` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

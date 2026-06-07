"use client";

import { useState } from "react";
import type { SignalDirection } from "@/types/signal";
import type { AddSignalInput } from "@/hooks/useSignals";
import type { TickerData } from "@/hooks/useBinancePriceFeed";

interface Props {
  prices: Record<string, TickerData>;
  onAdd: (input: AddSignalInput) => void;
  onClose: () => void;
}

const POPULAR = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"];

export default function AddSignalModal({ prices, onAdd, onClose }: Props) {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [customSymbol, setCustomSymbol] = useState("");
  const [direction, setDirection] = useState<SignalDirection>("LONG");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [leverage, setLeverage] = useState("1");
  const [note, setNote] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [error, setError] = useState("");

  const effectiveSymbol = (useCustom ? customSymbol : symbol)
    .toUpperCase()
    .replace(/\s/g, "");

  const livePrice = prices[effectiveSymbol]?.price;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!effectiveSymbol) {
      setError("Please enter a trading pair.");
      return;
    }

    if (!livePrice || livePrice <= 0) {
      setError(
        `No live price found for ${effectiveSymbol}. Check the symbol and try again.`
      );
      return;
    }

    const tp = takeProfit ? parseFloat(takeProfit) : undefined;
    const sl = stopLoss ? parseFloat(stopLoss) : undefined;
    const lev = parseInt(leverage) || 1;

    if (tp && tp <= 0) { setError("Take-profit must be positive."); return; }
    if (sl && sl <= 0) { setError("Stop-loss must be positive."); return; }
    if (lev < 1 || lev > 125) { setError("Leverage must be between 1 and 125."); return; }

    onAdd({
      symbol: effectiveSymbol,
      direction,
      /**
       * CRITICAL: entryPrice is taken directly from the live WebSocket price
       * at the moment the user clicks Add. This guarantees PnL = 0% on creation.
       */
      entryPrice: livePrice,
      takeProfit: tp,
      stopLoss: sl,
      leverage: lev,
      note: note || undefined,
    });

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Add Signal</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol picker */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Trading Pair</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {POPULAR.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSymbol(s); setUseCustom(false); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    !useCustom && symbol === s
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {s.replace("USDT", "")}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  useCustom
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                Custom
              </button>
            </div>
            {useCustom && (
              <input
                type="text"
                placeholder="e.g. AVAXUSDT"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            )}
          </div>

          {/* Live price preview */}
          <div className="bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-gray-400 text-sm">Live Entry Price</span>
            <span className="text-white font-mono font-semibold">
              {livePrice
                ? `$${livePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                : "Waiting for price…"}
            </span>
          </div>
          <p className="text-xs text-gray-500 -mt-2 px-1">
            Entry price is locked to the live market price when you click Add Signal.
            PnL will start at <strong className="text-gray-300">0.00%</strong>.
          </p>

          {/* Direction */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Direction</label>
            <div className="grid grid-cols-2 gap-2">
              {(["LONG", "SHORT"] as SignalDirection[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`py-2 rounded-lg font-bold text-sm transition-colors ${
                    direction === d
                      ? d === "LONG"
                        ? "bg-green-600 text-white"
                        : "bg-red-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {d === "LONG" ? "▲ LONG" : "▼ SHORT"}
                </button>
              ))}
            </div>
          </div>

          {/* Leverage */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Leverage: <span className="text-white font-bold">{leverage}x</span>
            </label>
            <input
              type="range"
              min={1}
              max={125}
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1x</span><span>25x</span><span>50x</span><span>100x</span><span>125x</span>
            </div>
          </div>

          {/* TP / SL */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Take Profit ($)</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Optional"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Stop Loss ($)</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Optional"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Note (optional)</label>
            <input
              type="text"
              placeholder="Strategy, timeframe, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!livePrice}
            className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add Signal
          </button>
        </form>
      </div>
    </div>
  );
}

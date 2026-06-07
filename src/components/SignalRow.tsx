"use client";

import type { SignalWithPnl } from "@/types/signal";

interface Props {
  signal: SignalWithPnl;
  onClose: (id: string, price: number) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtPrice(n: number) {
  if (n >= 1000) return fmt(n, 2);
  if (n >= 1) return fmt(n, 4);
  return fmt(n, 6);
}

export default function SignalRow({ signal, onClose, onCancel, onDelete }: Props) {
  const isActive = signal.status === "ACTIVE";
  const isProfit = signal.pnlPercent >= 0;
  const pnlColor = isProfit ? "text-green-400" : "text-red-400";
  const pnlBg = isProfit ? "bg-green-900/20" : "bg-red-900/20";

  const directionBadge =
    signal.direction === "LONG"
      ? "bg-green-900/40 text-green-400 border border-green-800"
      : "bg-red-900/40 text-red-400 border border-red-800";

  const statusBadge = {
    ACTIVE: "bg-blue-900/40 text-blue-400 border border-blue-800",
    CLOSED: "bg-gray-800 text-gray-400 border border-gray-700",
    CANCELLED: "bg-yellow-900/40 text-yellow-400 border border-yellow-800",
  }[signal.status];

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
      {/* Symbol + direction */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-sm">
            {signal.symbol.replace("USDT", "")}
            <span className="text-gray-500 font-normal">/USDT</span>
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${directionBadge}`}>
            {signal.direction === "LONG" ? "▲" : "▼"} {signal.direction}
          </span>
        </div>
        {signal.leverage > 1 && (
          <span className="text-xs text-yellow-400 mt-0.5 block">{signal.leverage}x</span>
        )}
        {signal.note && (
          <span className="text-xs text-gray-500 mt-0.5 block truncate max-w-[140px]">
            {signal.note}
          </span>
        )}
      </td>

      {/* Entry price */}
      <td className="px-4 py-3 font-mono text-sm text-gray-300">
        ${fmtPrice(signal.entryPrice)}
      </td>

      {/* Current price */}
      <td className="px-4 py-3 font-mono text-sm">
        {isActive ? (
          <span className="text-white">${fmtPrice(signal.currentPrice)}</span>
        ) : (
          <span className="text-gray-500">
            ${fmtPrice(signal.closedPrice ?? signal.currentPrice)}
          </span>
        )}
      </td>

      {/* PnL */}
      <td className={`px-4 py-3 font-mono text-sm font-bold ${pnlColor}`}>
        <div className={`inline-flex flex-col items-end px-2 py-1 rounded ${pnlBg}`}>
          <span>
            {signal.pnlPercent >= 0 ? "+" : ""}
            {fmt(signal.pnlPercent, 2)}%
          </span>
          <span className="text-xs font-normal opacity-75">
            {signal.pnlUsd >= 0 ? "+" : ""}${fmt(Math.abs(signal.pnlUsd), 2)}
          </span>
        </div>
      </td>

      {/* TP / SL */}
      <td className="px-4 py-3 text-xs">
        <div className="space-y-0.5">
          {signal.takeProfit ? (
            <div className="text-green-400">
              TP ${fmtPrice(signal.takeProfit)}
            </div>
          ) : null}
          {signal.stopLoss ? (
            <div className="text-red-400">SL ${fmtPrice(signal.stopLoss)}</div>
          ) : null}
          {!signal.takeProfit && !signal.stopLoss && (
            <span className="text-gray-600">—</span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusBadge}`}>
          {signal.status}
        </span>
      </td>

      {/* Time */}
      <td className="px-4 py-3 text-xs text-gray-500">
        {new Date(signal.addedAt).toLocaleString()}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {isActive ? (
          <div className="flex gap-1">
            <button
              title="Close at current price"
              onClick={() => onClose(signal.id, signal.currentPrice)}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-xs transition-colors"
            >
              Close
            </button>
            <button
              title="Cancel signal"
              onClick={() => onCancel(signal.id)}
              className="px-2 py-1 rounded bg-gray-700 hover:bg-yellow-800 text-yellow-400 text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            title="Delete signal"
            onClick={() => onDelete(signal.id)}
            className="px-2 py-1 rounded bg-gray-800 hover:bg-red-900 text-red-400 text-xs transition-colors"
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}

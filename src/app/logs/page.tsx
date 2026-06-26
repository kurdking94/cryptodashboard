"use client";

import { useBot } from "@/context/BotContext";

const LEVEL_COLORS: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  trade: "text-green-400",
  signal: "text-purple-400",
};

export default function LogsPage() {
  const { logs } = useBot();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Bot Logs</h1>
        <p className="text-xs text-gray-500">Signal decisions · trade execution · API errors · bot actions</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {logs.length === 0 ? (
          <p className="p-8 text-center text-gray-500 text-sm">No logs yet — start the bot or run a scan</p>
        ) : (
          <div className="divide-y divide-gray-800/50 max-h-[70vh] overflow-y-auto">
            {[...logs].reverse().map((log) => (
              <div key={log.id} className="px-4 py-2 flex items-start gap-3 text-xs">
                <span className="text-gray-600 shrink-0 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`uppercase font-bold shrink-0 w-12 ${LEVEL_COLORS[log.level] ?? "text-gray-400"}`}>
                  {log.level}
                </span>
                <span className="text-gray-300">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

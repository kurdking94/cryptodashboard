"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBot } from "@/context/BotContext";

const NAV = [
  { href: "/", label: "Overview", icon: "◉" },
  { href: "/scanner", label: "Scanner", icon: "◎" },
  { href: "/strategies", label: "Strategy Lab", icon: "◈" },
  { href: "/trades", label: "Trades", icon: "◫" },
  { href: "/risk", label: "Risk", icon: "◬" },
  { href: "/replay", label: "Replay", icon: "◐" },
  { href: "/logs", label: "Logs", icon: "◧" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { mode, isScanning } = useBot();
  const running = isScanning;

  return (
    <aside className="w-56 shrink-0 border-r border-gray-800 bg-gray-900/50 flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">F</div>
          <div>
            <p className="text-sm font-bold text-white">Futures Bot</p>
            <p className="text-[10px] text-gray-500">Auto Scanner v2</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-blue-600/20 text-blue-400 font-semibold"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Mode</span>
          <span className={`font-bold ${mode === "PAPER" ? "text-yellow-400" : mode === "LIVE" ? "text-red-400" : "text-gray-500"}`}>
            {mode}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${running ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
          <span className="text-gray-400">{running ? "Scanning…" : "Idle"}</span>
        </div>
      </div>
    </aside>
  );
}

"use client";

import Sidebar from "@/components/layout/Sidebar";
import { BotProvider } from "@/context/BotContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BotProvider>
      <BotShell>{children}</BotShell>
    </BotProvider>
  );
}

function BotShell({ children }: { children: React.ReactNode }) {
  // BotProvider handles hydration internally; children render immediately
  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

export function Badge({ children, color = "gray" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    green: "bg-green-900/40 text-green-400 border-green-800",
    red: "bg-red-900/40 text-red-400 border-red-800",
    blue: "bg-blue-900/40 text-blue-400 border-blue-800",
    yellow: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
    gray: "bg-gray-800 text-gray-400 border-gray-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${colors[color] ?? colors.gray}`}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, sub, color = "white" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    white: "text-white", green: "text-green-400", red: "text-red-400",
    blue: "text-blue-400", yellow: "text-yellow-400",
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${colors[color] ?? colors.white}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtPrice(n: number) {
  if (n >= 1000) return fmt(n, 2);
  if (n >= 1) return fmt(n, 4);
  return fmt(n, 6);
}

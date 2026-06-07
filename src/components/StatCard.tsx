"use client";

interface Props {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red" | "blue" | "default";
}

const colorMap = {
  green: "text-green-400",
  red: "text-red-400",
  blue: "text-blue-400",
  default: "text-white",
};

export default function StatCard({ label, value, sub, color = "default" }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${colorMap[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

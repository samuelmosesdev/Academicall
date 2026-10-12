import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function GrowthChart({ data }) {
  const [range, setRange] = useState("year");

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">User Growth Over Time</h3>
        <div className="flex gap-2">
          {[
            { key: "6m", label: "Paid Users" },
            { key: "year", label: "Total Users" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === opt.key
                  ? "bg-accent text-white"
                  : "bg-bg-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="4 6" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="var(--color-text-muted)"
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--color-text-primary)",
              }}
            />
            <Area
              type="monotone"
              dataKey="users"
              stroke="var(--color-accent)"
              strokeWidth={2}
              fill="url(#growthFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

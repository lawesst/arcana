"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface GasUsageChartProps {
  data: Array<{ time: string; gasUsed: number }>;
}

export function GasUsageChart({ data }: GasUsageChartProps) {
  return (
    <div className="card">
      <h3 className="card-header mb-4">Gas Usage (Avg)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="gasGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5c7cfa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#5c7cfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3040" />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              tickFormatter={(v) =>
                v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1f2e",
                border: "1px solid #2a3040",
                borderRadius: "8px",
                color: "#f1f5f9",
              }}
              formatter={(value: number) => [value.toLocaleString(), "Gas Used"]}
            />
            <Area
              type="monotone"
              dataKey="gasUsed"
              stroke="#5c7cfa"
              fillOpacity={1}
              fill="url(#gasGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

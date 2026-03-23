"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ErrorRateChartProps {
  data: Array<{ time: string; errorRate: number }>;
}

export function ErrorRateChart({ data }: ErrorRateChartProps) {
  return (
    <div className="card">
      <h3 className="card-header mb-4">Error Rate (%)</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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
              domain={[0, "auto"]}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1f2e",
                border: "1px solid #2a3040",
                borderRadius: "8px",
                color: "#f1f5f9",
              }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, "Error Rate"]}
            />
            <Line
              type="monotone"
              dataKey="errorRate"
              stroke="#f87171"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#f87171" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

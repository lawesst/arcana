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
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(60, 73, 78, 0.35)"
            />
            <XAxis
              dataKey="time"
              stroke="#859399"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              stroke="#859399"
              fontSize={11}
              tickLine={false}
              domain={[0, "auto"]}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(22, 29, 31, 0.92)",
                border: "1px solid rgba(60, 73, 78, 0.24)",
                borderRadius: "16px",
                color: "#dde3e7",
              }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, "Error Rate"]}
            />
            <Line
              type="monotone"
              dataKey="errorRate"
              stroke="#ffb4ab"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#ffb4ab" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

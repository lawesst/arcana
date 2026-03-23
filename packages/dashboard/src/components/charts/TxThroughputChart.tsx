"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface TxThroughputChartProps {
  data: Array<{ time: string; txCount: number; stylusTxCount: number }>;
}

export function TxThroughputChart({ data }: TxThroughputChartProps) {
  return (
    <div className="card">
      <h3 className="card-header mb-4">Transaction Throughput</h3>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-arcana-500"></span>
          <span className="text-xs text-slate-400">Stylus</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-slate-600"></span>
          <span className="text-xs text-slate-400">EVM</span>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3040" />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
            />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1f2e",
                border: "1px solid #2a3040",
                borderRadius: "8px",
                color: "#f1f5f9",
              }}
            />
            <Bar dataKey="txCount" stackId="a" fill="#475569" radius={[0, 0, 0, 0]} name="Total Txs" />
            <Bar dataKey="stylusTxCount" stackId="b" fill="#5c7cfa" radius={[2, 2, 0, 0]} name="Stylus Txs" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

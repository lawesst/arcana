"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TxThroughputChartProps {
  data: Array<{ time: string; txCount: number; stylusTxCount: number }>;
}

export function TxThroughputChart({ data }: TxThroughputChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    evmTxCount: Math.max(point.txCount - point.stylusTxCount, 0),
  }));

  return (
    <div className="card">
      <h3 className="card-header mb-4">Transaction Throughput</h3>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#00d1ff]"></span>
          <span className="text-xs text-[#bbc9cf]">Stylus</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#475569]"></span>
          <span className="text-xs text-[#bbc9cf]">EVM</span>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
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
            <YAxis stroke="#859399" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(22, 29, 31, 0.92)",
                border: "1px solid rgba(60, 73, 78, 0.24)",
                borderRadius: "16px",
                color: "#dde3e7",
              }}
            />
            <Bar
              dataKey="evmTxCount"
              stackId="txs"
              fill="#475569"
              radius={[0, 0, 0, 0]}
              name="EVM Txs"
            />
            <Bar
              dataKey="stylusTxCount"
              stackId="txs"
              fill="#5c7cfa"
              radius={[2, 2, 0, 0]}
              name="Stylus Txs"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

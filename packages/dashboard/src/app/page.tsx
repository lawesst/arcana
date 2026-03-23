"use client";

import { useState, useCallback } from "react";
import { useMetrics } from "@/hooks/useMetrics";
import { useWebSocket } from "@/hooks/useWebSocket";
import { MetricCard } from "@/components/cards/MetricCard";
import { GasUsageChart } from "@/components/charts/GasUsageChart";
import { TxThroughputChart } from "@/components/charts/TxThroughputChart";
import { ErrorRateChart } from "@/components/charts/ErrorRateChart";
import { RecentTxTable } from "@/components/tables/RecentTxTable";
import { ErrorState } from "@/components/ErrorState";

export default function OverviewPage() {
  const [range, setRange] = useState("24h");
  const { metrics, latest, loading, error, refresh } = useMetrics(range);

  // Real-time updates via WebSocket
  const onMetrics = useCallback(() => {
    // When new metrics arrive via WS, trigger a refresh
    refresh();
  }, [refresh]);

  const { connected } = useWebSocket({
    onMetrics,
    onTransaction: onMetrics, // Also refresh on new transactions
  });

  const ranges = ["1h", "6h", "24h", "7d", "30d"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Network Overview</h2>
          <p className="text-sm text-slate-400 mt-1">
            Arbitrum One — Stylus dApp Analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? "bg-arcana-600 text-white"
                  : "bg-[#1a1f2e] text-slate-400 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-20 mb-3"></div>
              <div className="h-8 bg-slate-800 rounded w-32"></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Transactions (5m)"
              value={latest?.txCount.toLocaleString() ?? "—"}
              subtitle="in current window"
            />
            <MetricCard
              title="Avg Gas Used"
              value={
                latest
                  ? `${(latest.avgGasUsed / 1e6).toFixed(2)}M`
                  : "—"
              }
              subtitle="per transaction"
            />
            <MetricCard
              title="Error Rate"
              value={latest ? `${latest.errorRate.toFixed(2)}%` : "—"}
              subtitle="reverted txs"
            />
            <MetricCard
              title="Stylus Transactions"
              value={latest?.stylusTxCount.toLocaleString() ?? "—"}
              subtitle="WASM contract calls"
              highlight
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GasUsageChart data={metrics} />
            <TxThroughputChart data={metrics} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ErrorRateChart data={metrics} />
            <div className="card">
              <h3 className="card-header mb-4">Unique Addresses</h3>
              <div className="flex items-center justify-center h-56">
                {latest ? (
                  <div className="text-center">
                    <div className="text-4xl font-bold text-arcana-400">
                      {latest.uniqueAddresses.toLocaleString()}
                    </div>
                    <p className="text-sm text-slate-400 mt-2">
                      active wallets in current window
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500">No data yet</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Recent Transactions */}
      <RecentTxTable />

      {/* Connection Status */}
      <div className="fixed bottom-4 right-4">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
            connected
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
            }`}
          ></span>
          {connected ? "Live" : "Reconnecting..."}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { fetchDapp, fetchDappMetrics } from "@/lib/api";
import { MetricCard } from "@/components/cards/MetricCard";
import { GasUsageChart } from "@/components/charts/GasUsageChart";
import { TxThroughputChart } from "@/components/charts/TxThroughputChart";
import { ErrorRateChart } from "@/components/charts/ErrorRateChart";
import { truncateAddress, EXPLORER_URLS } from "@arcana/shared";

interface DApp {
  id: string;
  name: string;
  contractAddresses: string[];
  chainId: number;
}

export default function DAppDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [dapp, setDapp] = useState<DApp | null>(null);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [range, setRange] = useState("24h");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [dappRes, metricsRes] = await Promise.all([
        fetchDapp(id),
        fetchDappMetrics(id, range),
      ]);
      setDapp(dappRes.data);
      setMetrics(
        metricsRes.data.map((m) => ({
          time: new Date(m.windowStart).toLocaleTimeString(),
          gasUsed: parseFloat(m.avgGasUsed),
          gasPrice: parseFloat(m.avgGasPrice),
          txCount: m.txCount,
          errorRate: parseFloat(m.errorRate) * 100,
          uniqueAddresses: m.uniqueAddresses,
          stylusTxCount: m.stylusTxCount,
        })),
      );
    } catch (err) {
      console.error("Failed to load dApp:", err);
    } finally {
      setLoading(false);
    }
  }, [id, range]);

  useEffect(() => {
    load();
  }, [load]);

  const ranges = ["1h", "6h", "24h", "7d"];
  const latest = metrics[0];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-800 rounded w-64 animate-pulse"></div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-24"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!dapp) {
    return (
      <div className="card text-center py-12">
        <p className="text-slate-400">dApp not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{dapp.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            {dapp.contractAddresses.map((addr) => (
              <a
                key={addr}
                href={`${EXPLORER_URLS[42161]}/address/${addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-arcana-400 hover:text-arcana-300"
              >
                {truncateAddress(addr, 8)}
              </a>
            ))}
          </div>
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

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Transactions"
          value={latest?.txCount.toLocaleString() ?? "—"}
        />
        <MetricCard
          title="Avg Gas"
          value={latest ? `${(latest.gasUsed / 1e6).toFixed(2)}M` : "—"}
        />
        <MetricCard
          title="Error Rate"
          value={latest ? `${latest.errorRate.toFixed(2)}%` : "—"}
        />
        <MetricCard
          title="Stylus Txs"
          value={latest?.stylusTxCount.toLocaleString() ?? "—"}
          highlight
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GasUsageChart data={metrics} />
        <TxThroughputChart data={metrics} />
      </div>
      <ErrorRateChart data={metrics} />
    </div>
  );
}

interface MetricData {
  time: string;
  gasUsed: number;
  gasPrice: number;
  txCount: number;
  errorRate: number;
  uniqueAddresses: number;
  stylusTxCount: number;
}

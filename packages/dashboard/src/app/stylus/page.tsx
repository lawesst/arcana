"use client";

import { useState, useEffect } from "react";
import {
  fetchGasComparison,
  fetchGasComparisonTimeSeries,
  fetchTopStylusContracts,
  fetchStylusAdoption,
} from "@/lib/api";
import { MetricCard } from "@/components/cards/MetricCard";
import { ErrorState } from "@/components/ErrorState";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface GasComparison {
  stylusAvgGas: number;
  evmAvgGas: number;
  stylusTotalGas: string;
  evmTotalGas: string;
  stylusCount: number;
  evmCount: number;
  stylusAvgGasPrice: number;
  evmAvgGasPrice: number;
  gasSavingsPercent: string;
}

interface GasComparisonPoint {
  time: string;
  stylusAvgGas: number;
  evmAvgGas: number;
  stylusCount: number;
  evmCount: number;
}

interface StylusContract {
  address: string | null;
  txCount: number;
  avgGas: string;
  totalGas: string;
  errorCount: number;
  uniqueCallers: number;
  firstSeen: string;
  lastSeen: string;
}

interface StylusAdoption {
  totalTxs: number;
  stylusTxs: number;
  evmTxs: number;
  stylusRatio: string;
  stylusContracts: number;
  evmContracts: number;
  stylusErrorRate: string;
  evmErrorRate: string;
}

const PIE_COLORS = ["#5c7cfa", "#475569"];

export default function StylusPage() {
  const [range, setRange] = useState("24h");
  const [gasComp, setGasComp] = useState<GasComparison | null>(null);
  const [timeSeries, setTimeSeries] = useState<GasComparisonPoint[]>([]);
  const [contracts, setContracts] = useState<StylusContract[]>([]);
  const [adoption, setAdoption] = useState<StylusAdoption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ranges = ["1h", "6h", "24h", "7d", "30d"];

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [gasRes, tsRes, contractsRes, adoptionRes] = await Promise.all([
          fetchGasComparison(range),
          fetchGasComparisonTimeSeries(range),
          fetchTopStylusContracts(range),
          fetchStylusAdoption(range),
        ]);
        setGasComp(gasRes.data);
        setTimeSeries(
          tsRes.data.map((p) => ({
            ...p,
            time: new Date(p.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })),
        );
        setContracts(contractsRes.data);
        setAdoption(adoptionRes.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Stylus data");
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [range]);

  const pieData = adoption
    ? [
        { name: "Stylus", value: adoption.stylusTxs },
        { name: "EVM", value: adoption.evmTxs },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Stylus Analytics</h2>
          <p className="text-sm text-slate-400 mt-1">
            WASM contract performance, gas comparison &amp; adoption metrics
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

      {error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); setError(null); }} />
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
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Stylus Tx Ratio"
              value={`${adoption?.stylusRatio ?? 0}%`}
              subtitle={`${adoption?.stylusTxs ?? 0} of ${adoption?.totalTxs ?? 0} txs`}
              highlight
            />
            <MetricCard
              title="Gas Savings"
              value={`${gasComp?.gasSavingsPercent ?? 0}%`}
              subtitle="Stylus vs EVM avg gas"
            />
            <MetricCard
              title="Stylus Contracts"
              value={(adoption?.stylusContracts ?? 0).toLocaleString()}
              subtitle="unique WASM contracts"
            />
            <MetricCard
              title="Stylus Error Rate"
              value={`${adoption?.stylusErrorRate ?? 0}%`}
              subtitle={`EVM: ${adoption?.evmErrorRate ?? 0}%`}
            />
          </div>

          {/* Gas Comparison Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Avg Gas Comparison Bar */}
            <div className="card">
              <h3 className="card-header mb-4">Average Gas per Transaction</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        name: "Stylus (WASM)",
                        gas: gasComp?.stylusAvgGas ?? 0,
                        fill: "#5c7cfa",
                      },
                      {
                        name: "EVM (Solidity)",
                        gas: gasComp?.evmAvgGas ?? 0,
                        fill: "#475569",
                      },
                    ]}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3040" />
                    <XAxis
                      type="number"
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(v) =>
                        v >= 1e6
                          ? `${(v / 1e6).toFixed(1)}M`
                          : v >= 1e3
                            ? `${(v / 1e3).toFixed(0)}K`
                            : v.toString()
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#64748b"
                      fontSize={12}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1f2e",
                        border: "1px solid #2a3040",
                        borderRadius: "8px",
                        color: "#f1f5f9",
                      }}
                      formatter={(value: number) =>
                        value.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })
                      }
                    />
                    <Bar dataKey="gas" radius={[0, 4, 4, 0]} name="Avg Gas">
                      {[gasComp?.stylusAvgGas ?? 0, gasComp?.evmAvgGas ?? 0].map(
                        (_, i) => (
                          <Cell
                            key={i}
                            fill={i === 0 ? "#5c7cfa" : "#475569"}
                          />
                        ),
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {gasComp && parseFloat(gasComp.gasSavingsPercent) > 0 && (
                <div className="mt-3 px-3 py-2 bg-arcana-500/10 border border-arcana-500/20 rounded-lg">
                  <p className="text-sm text-arcana-300">
                    Stylus contracts use{" "}
                    <span className="font-bold text-arcana-400">
                      {gasComp.gasSavingsPercent}% less gas
                    </span>{" "}
                    on average compared to EVM contracts
                  </p>
                </div>
              )}
            </div>

            {/* Tx Distribution Pie */}
            <div className="card">
              <h3 className="card-header mb-4">Transaction Distribution</h3>
              <div className="h-64 flex items-center justify-center">
                {pieData.every((d) => d.value === 0) ? (
                  <p className="text-slate-500">No transaction data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(1)}%`
                        }
                        labelLine={false}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1a1f2e",
                          border: "1px solid #2a3040",
                          borderRadius: "8px",
                          color: "#f1f5f9",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-[#5c7cfa]"></span>
                  <span className="text-xs text-slate-400">
                    Stylus ({adoption?.stylusTxs ?? 0})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-[#475569]"></span>
                  <span className="text-xs text-slate-400">
                    EVM ({adoption?.evmTxs ?? 0})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Gas Comparison Over Time */}
          <div className="card">
            <h3 className="card-header mb-4">
              Gas Usage Over Time — Stylus vs EVM
            </h3>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#5c7cfa]"></span>
                <span className="text-xs text-slate-400">Stylus Avg Gas</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#f59e0b]"></span>
                <span className="text-xs text-slate-400">EVM Avg Gas</span>
              </div>
            </div>
            <div className="h-72">
              {timeSeries.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-500">
                    No time-series data available for this range
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeries}>
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
                        v >= 1e6
                          ? `${(v / 1e6).toFixed(1)}M`
                          : v >= 1e3
                            ? `${(v / 1e3).toFixed(0)}K`
                            : v.toString()
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1f2e",
                        border: "1px solid #2a3040",
                        borderRadius: "8px",
                        color: "#f1f5f9",
                      }}
                      formatter={(value: number) =>
                        value.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="stylusAvgGas"
                      stroke="#5c7cfa"
                      strokeWidth={2}
                      dot={false}
                      name="Stylus Avg Gas"
                    />
                    <Line
                      type="monotone"
                      dataKey="evmAvgGas"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      name="EVM Avg Gas"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Stylus Contracts Table */}
          <div className="card overflow-hidden">
            <h3 className="card-header mb-4">Top Stylus Contracts</h3>
            {contracts.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-slate-500">
                  No Stylus contracts detected in this time range
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2a3040]">
                      <th className="text-left py-2 px-3 text-slate-500 font-medium">
                        Contract
                      </th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">
                        Transactions
                      </th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">
                        Avg Gas
                      </th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">
                        Total Gas
                      </th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">
                        Errors
                      </th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">
                        Callers
                      </th>
                      <th className="text-right py-2 px-3 text-slate-500 font-medium">
                        Last Active
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((c, i) => (
                      <tr
                        key={i}
                        className="border-b border-[#2a3040]/50 hover:bg-[#1a1f2e]/50"
                      >
                        <td className="py-2.5 px-3 font-mono text-arcana-400">
                          {c.address
                            ? `${c.address.slice(0, 10)}...${c.address.slice(-6)}`
                            : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {c.txCount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300 font-mono">
                          {parseInt(c.avgGas).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300 font-mono">
                          {parseInt(c.totalGas).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {c.errorCount > 0 ? (
                            <span className="text-red-400">
                              {c.errorCount}
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {c.uniqueCallers}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs text-slate-500">
                          {new Date(c.lastSeen).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

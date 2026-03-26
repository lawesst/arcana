"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Download,
  Gauge,
  MoreHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useMetrics } from "@/hooks/useMetrics";
import { useWebSocket } from "@/hooks/useWebSocket";
import { fetchTransactions } from "@/lib/api";
import { ErrorState } from "@/components/ErrorState";
import { EXPLORER_URLS, truncateAddress } from "@arcana/shared";

const rangeOptions = [
  { id: "24h", label: "24H", requestRange: "24h" as const },
  { id: "7d", label: "7D", requestRange: "7d" as const },
  { id: "30d", label: "30D", requestRange: "30d" as const },
  { id: "all", label: "ALL", requestRange: "30d" as const },
] as const;

type SelectedRange = (typeof rangeOptions)[number]["id"];

interface RecentTransaction {
  txHash: string;
  blockNumber: number;
  fromAddress: string;
  toAddress: string | null;
  gasUsed: string;
  gasPrice: string;
  status: number;
  isStylus: boolean;
  methodId: string | null;
  timestamp: string;
}

export default function OverviewPage() {
  const router = useRouter();
  const [selectedRange, setSelectedRange] = useState<SelectedRange>("24h");
  const activeRange =
    rangeOptions.find((option) => option.id === selectedRange) ??
    rangeOptions[0];
  const { metrics, latest, loading, error, refresh } = useMetrics(
    activeRange.requestRange,
  );

  const [recentTransactions, setRecentTransactions] = useState<
    RecentTransaction[]
  >([]);
  const [txError, setTxError] = useState<string | null>(null);

  const loadRecentTransactions = useCallback(async () => {
    try {
      const res = await fetchTransactions({ limit: 4 });
      setRecentTransactions(res.data);
      setTxError(null);
    } catch (err) {
      setTxError(
        err instanceof Error ? err.message : "Failed to load transactions",
      );
    }
  }, []);

  useEffect(() => {
    loadRecentTransactions();
    const interval = setInterval(loadRecentTransactions, 30000);
    return () => clearInterval(interval);
  }, [loadRecentTransactions]);

  const handleRealtimeRefresh = useCallback(() => {
    refresh();
    loadRecentTransactions();
  }, [loadRecentTransactions, refresh]);

  useWebSocket({
    onMetrics: refresh,
    onTransaction: handleRealtimeRefresh,
  });

  const chartData = useMemo(
    () =>
      metrics.map((point) => ({
        ...point,
        label: formatXAxisLabel(point.windowStart, selectedRange),
        avgGasGwei: point.gasPrice / 1e9,
        stylusRatio:
          point.txCount > 0 ? (point.stylusTxCount / point.txCount) * 100 : 0,
      })),
    [metrics, selectedRange],
  );

  const firstPoint = chartData[0];
  const latestPoint = chartData[chartData.length - 1];

  const stylusRatio = latest
    ? latest.txCount > 0
      ? (latest.stylusTxCount / latest.txCount) * 100
      : 0
    : 0;
  const stylusTrend = getPercentDelta(
    stylusRatio,
    firstPoint?.stylusRatio ?? stylusRatio,
  );

  const totalTransactionLoad = chartData.reduce(
    (sum, point) => sum + point.txCount,
    0,
  );
  const txLoadTrend = getPercentDelta(
    latestPoint?.txCount ?? 0,
    firstPoint?.txCount ?? latestPoint?.txCount ?? 0,
  );

  const activeCallers = latest?.uniqueAddresses ?? 0;
  const callerTrend = getPercentDelta(
    activeCallers,
    firstPoint?.uniqueAddresses ?? activeCallers,
  );

  const correlation = calculateCorrelation(
    chartData.map((point) => point.txCount),
    chartData.map((point) => point.avgGasGwei),
  );

  const lowestLatencyPoint = [...chartData]
    .filter((point) => Number.isFinite(point.avgTxSpeed) && point.avgTxSpeed > 0)
    .sort((a, b) => a.avgTxSpeed - b.avgTxSpeed)[0];

  const peakErrorRate = chartData.reduce(
    (max, point) => Math.max(max, point.errorRate),
    0,
  );

  const handleExport = () => {
    if (chartData.length === 0) return;

    const csv = [
      [
        "window_start",
        "label",
        "tx_count",
        "stylus_tx_count",
        "avg_gas_gwei",
        "avg_gas_used",
        "unique_addresses",
        "error_rate_percent",
        "avg_tx_speed",
      ].join(","),
      ...chartData.map((point) =>
        [
          point.windowStart,
          point.label,
          point.txCount,
          point.stylusTxCount,
          point.avgGasGwei.toFixed(6),
          point.gasUsed.toFixed(2),
          point.uniqueAddresses,
          point.errorRate.toFixed(2),
          point.avgTxSpeed.toFixed(2),
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arcana-historical-${selectedRange}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <div className="space-y-10">
      <section className="mb-2 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="max-w-2xl text-base text-[#bbc9cf] lg:text-lg">
            Multi-metric comparative analysis for Stylus protocols on Arbitrum,
            tuned for fast incident review and performance optimization.
          </p>
          {selectedRange === "all" && (
            <p className="mt-3 text-sm text-[#859399]">
              Using the longest history currently indexed in the MVP.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-[#161d1f] p-1">
          {rangeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedRange(option.id)}
              className={`rounded-lg px-4 py-2 text-xs font-extrabold tracking-[0.16em] transition-colors ${
                selectedRange === option.id
                  ? "bg-[#2f3639] text-[#00d1ff]"
                  : "text-[#bbc9cf] hover:bg-[#1a2123] hover:text-[#dde3e7]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {loading && chartData.length === 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="card h-32 animate-pulse" />
            ))}
          </div>
          <div className="card h-[420px] animate-pulse" />
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <div className="card h-[360px] animate-pulse" />
            <div className="card h-[360px] animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <InsightCard
              title="Stylus Participation"
              value={`${stylusRatio.toFixed(1)}%`}
              accent="cyan"
              icon={<Sparkles className="h-4 w-4" />}
              trend={stylusTrend}
              helper="share of transactions in the current window"
            />
            <InsightCard
              title="Transaction Load"
              value={formatCompactNumber(totalTransactionLoad)}
              accent="amber"
              icon={<Zap className="h-4 w-4" />}
              trend={txLoadTrend}
              helper={`indexed across ${activeRange.label}`}
            />
            <InsightCard
              title="Active Callers"
              value={formatCompactNumber(activeCallers)}
              accent="ice"
              icon={<Users className="h-4 w-4" />}
              trend={callerTrend}
              helper="unique addresses in the latest window"
            />
          </section>

          <section className="overflow-hidden rounded-[28px] border border-[#3c494e]/15 bg-[#161d1f]">
            <div className="flex flex-col gap-4 border-b border-[#3c494e]/15 bg-[#2f3639]/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-5">
                <LegendPill color="#00d1ff" label="Transactions" glow />
                <LegendPill color="#ffd59c" label="Avg Gas Price (Gwei)" />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#859399]">
                  Export
                </span>
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#3c494e]/20 bg-[#161d1f] text-[#bbc9cf] transition-colors hover:text-[#00d1ff]"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/explorer")}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#3c494e]/20 bg-[#161d1f] text-[#bbc9cf] transition-colors hover:text-[#00d1ff]"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative h-[420px] p-4 sm:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,209,255,0.08),transparent_38%)]" />
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[#859399]">
                  No historical data available yet.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="historicalTxGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#00d1ff"
                            stopOpacity={0.24}
                          />
                          <stop
                            offset="100%"
                            stopColor="#00d1ff"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(60, 73, 78, 0.35)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="#859399"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                      />
                      <YAxis
                        yAxisId="txs"
                        stroke="#859399"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tickFormatter={(value: number) =>
                          compactNumberFormatter.format(value)
                        }
                      />
                      <YAxis
                        yAxisId="gas"
                        orientation="right"
                        stroke="#859399"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        tickFormatter={(value: number) => formatGwei(value)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(22, 29, 31, 0.92)",
                          border: "1px solid rgba(60, 73, 78, 0.24)",
                          borderRadius: "16px",
                          color: "#dde3e7",
                        }}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.windowStart
                            ? formatTooltipLabel(payload[0].payload.windowStart)
                            : ""
                        }
                        formatter={(value, name) => {
                          if (name === "Transactions") {
                            return [
                              compactNumberFormatter.format(Number(value)),
                              "Transactions",
                            ];
                          }

                          return [formatGwei(Number(value)), "Avg Gas Price"];
                        }}
                      />
                      <Area
                        yAxisId="txs"
                        type="monotone"
                        dataKey="txCount"
                        stroke="#00d1ff"
                        fill="url(#historicalTxGradient)"
                        strokeWidth={3}
                        name="Transactions"
                      />
                      <Line
                        yAxisId="gas"
                        type="monotone"
                        dataKey="avgGasGwei"
                        stroke="#ffd59c"
                        strokeWidth={2.25}
                        strokeDasharray="5 5"
                        dot={false}
                        name="Avg Gas Price"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>

                  {latestPoint && (
                    <div className="glass-panel absolute right-6 top-6 max-w-[220px] rounded-2xl border border-[#3c494e]/20 p-4 shadow-2xl">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#859399]">
                        Latest Window
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-6">
                          <span className="text-[#bbc9cf]">Transactions</span>
                          <span className="font-extrabold text-[#00d1ff]">
                            {compactNumberFormatter.format(latestPoint.txCount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-6">
                          <span className="text-[#bbc9cf]">Avg Gas</span>
                          <span className="font-extrabold text-[#ffd59c]">
                            {formatGwei(latestPoint.avgGasGwei)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <div className="rounded-[28px] border border-[#3c494e]/15 bg-[#161d1f] p-6">
              <h3 className="mb-6 flex items-center gap-2 text-xl font-extrabold tracking-tight text-[#dde3e7]">
                <Zap className="h-5 w-5 text-[#00d1ff]" />
                Execution History
              </h3>

              {txError ? (
                <ErrorState message={txError} onRetry={loadRecentTransactions} />
              ) : recentTransactions.length === 0 ? (
                <div className="rounded-2xl bg-[#1a2123] px-4 py-12 text-center text-sm text-[#859399]">
                  No recent executions indexed yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {recentTransactions.map((tx) => (
                    <a
                      key={tx.txHash}
                      href={`${EXPLORER_URLS[42161]}/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between gap-4 rounded-2xl bg-[#1a2123] p-4 transition-colors hover:bg-[#242b2e]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#3c494e]/20 bg-[#0e1417]">
                          <span
                            className={`text-sm ${
                              tx.status === 1 ? "text-[#00d1ff]" : "text-[#ffb4ab]"
                            }`}
                          >
                            {tx.isStylus ? "◎" : "◇"}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-[#dde3e7]">
                            {getTransactionLabel(tx)}
                          </p>
                          <p className="text-[11px] text-[#859399]">
                            {truncateAddress(tx.txHash, 6)} •{" "}
                            {formatExecutionTime(tx.timestamp)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-extrabold text-[#00d1ff]">
                          {formatGwei(Number(tx.gasPrice) / 1e9)}
                        </p>
                        <p className="text-[11px] font-mono text-[#859399]">
                          #{tx.blockNumber}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-[#3c494e]/15 bg-[#161d1f] p-6">
              <div className="absolute right-0 top-0 p-8 opacity-10">
                <Gauge className="h-28 w-28 text-[#a4e6ff]" />
              </div>
              <div className="relative z-10">
                <h3 className="mb-4 text-xl font-extrabold tracking-tight text-[#dde3e7]">
                  Correlation Insight
                </h3>
                <p className="mb-6 max-w-xl text-sm leading-7 text-[#bbc9cf]">
                  {buildInsightNarrative(correlation)}
                </p>

                <div className="space-y-4">
                  <InsightRow
                    color="#00d1ff"
                    title="Optimal Window Detected"
                    description={
                      lowestLatencyPoint
                        ? `${formatTooltipLabel(lowestLatencyPoint.windowStart)} showed the lowest observed confirmation speed.`
                        : "More data is needed before a clear execution window emerges."
                    }
                  />
                  <InsightRow
                    color="#ffd59c"
                    title="Network Stability"
                    description={
                      peakErrorRate > 0
                        ? `Peak revert pressure reached ${peakErrorRate.toFixed(2)}% during the selected range.`
                        : "No revert spikes were detected across the selected history."
                    }
                  />
                </div>

                <Link
                  href="/explorer"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-[#00d1ff] transition-colors hover:text-[#a4e6ff]"
                >
                  View Detailed Report
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function InsightCard({
  title,
  value,
  accent,
  icon,
  trend,
  helper,
}: {
  title: string;
  value: string;
  accent: "cyan" | "amber" | "ice";
  icon: React.ReactNode;
  trend: number | null;
  helper: string;
}) {
  const accentClass =
    accent === "cyan"
      ? "border-[#00d1ff]"
      : accent === "amber"
        ? "border-[#ffd59c]"
        : "border-[#a4e6ff]";

  const trendUp = trend !== null && trend >= 0;

  return (
    <div
      className={`flex h-36 flex-col justify-between rounded-[24px] border border-[#3c494e]/10 border-l-2 bg-[#161d1f] p-6 ${accentClass}`}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#859399]">
          {title}
        </p>
        <div className="rounded-xl bg-[#1a2123] p-2 text-[#bbc9cf]">{icon}</div>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-3xl font-extrabold tracking-tight text-[#dde3e7]">
          {value}
        </span>
        {trend !== null && (
          <span
            className={`mb-1 inline-flex items-center gap-1 text-xs font-bold ${
              trendUp ? "text-[#00d1ff]" : "text-[#ffb4ab]"
            }`}
          >
            {trendUp ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {formatSignedPercent(trend)}
          </span>
        )}
      </div>

      <p className="text-xs text-[#859399]">{helper}</p>
    </div>
  );
}

function LegendPill({
  color,
  label,
  glow = false,
}: {
  color: string;
  label: string;
  glow?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-3 w-3 rounded-full ${glow ? "chart-glow" : ""}`}
        style={{ backgroundColor: color }}
      />
      <span className="text-sm font-bold text-[#dde3e7]">{label}</span>
    </div>
  );
}

function InsightRow({
  color,
  title,
  description,
}: {
  color: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-12 w-2 rounded-full" style={{ backgroundColor: color }} />
      <div>
        <p className="text-sm font-extrabold text-[#dde3e7]">{title}</p>
        <p className="text-xs text-[#859399]">{description}</p>
      </div>
    </div>
  );
}

function getPercentDelta(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function calculateCorrelation(xValues: number[], yValues: number[]) {
  if (xValues.length < 2 || xValues.length !== yValues.length) {
    return null;
  }

  const xMean = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
  const yMean = yValues.reduce((sum, value) => sum + value, 0) / yValues.length;

  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;

  for (let index = 0; index < xValues.length; index += 1) {
    const xDiff = xValues[index] - xMean;
    const yDiff = yValues[index] - yMean;
    numerator += xDiff * yDiff;
    xVariance += xDiff ** 2;
    yVariance += yDiff ** 2;
  }

  if (xVariance === 0 || yVariance === 0) {
    return null;
  }

  return numerator / Math.sqrt(xVariance * yVariance);
}

function buildInsightNarrative(correlation: number | null) {
  if (correlation === null) {
    return "Arcana is still collecting enough history to produce a reliable relationship between throughput and gas price movement for this window.";
  }

  const direction =
    correlation < 0 ? "negative" : correlation > 0 ? "positive" : "neutral";
  const strength =
    Math.abs(correlation) >= 0.6
      ? "strong"
      : Math.abs(correlation) >= 0.3
        ? "moderate"
        : "light";

  return `Across the selected range, ARCANA observes a ${strength} ${direction} correlation (${correlation.toFixed(2)}) between transaction volume and gas pricing. This helps separate healthy throughput expansion from pricing stress before it turns into a user-facing regression.`;
}

function formatXAxisLabel(windowStart: string, range: SelectedRange) {
  if (range === "24h") {
    return utcTimeFormatter.format(new Date(windowStart));
  }

  if (range === "7d") {
    return utcDateFormatter.format(new Date(windowStart));
  }

  return utcDateFormatter.format(new Date(windowStart));
}

function formatTooltipLabel(windowStart: string) {
  return utcDateTimeFormatter.format(new Date(windowStart));
}

function formatGwei(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1) return `${value.toFixed(2)} Gwei`;
  if (value >= 0.01) return `${value.toFixed(3)} Gwei`;
  return `${value.toFixed(4)} Gwei`;
}

function formatSignedPercent(value: number) {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(value);
}

function formatExecutionTime(timestamp: string) {
  return `${utcDateTimeFormatter.format(new Date(timestamp))} UTC`;
}

function getTransactionLabel(tx: RecentTransaction) {
  if (tx.isStylus && tx.methodId) {
    return `Stylus ${tx.methodId}`;
  }

  if (tx.isStylus) {
    return "Stylus Execution";
  }

  if (tx.methodId) {
    return `EVM ${tx.methodId}`;
  }

  return "Contract Interaction";
}

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const utcTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const utcDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const utcDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

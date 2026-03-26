"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchDapp,
  fetchDappMetrics,
  fetchDappBackfillStatus,
  fetchEvents,
  deleteDapp,
  type BackfillStatus,
} from "@/lib/api";
import { MetricCard } from "@/components/cards/MetricCard";
import { GasUsageChart } from "@/components/charts/GasUsageChart";
import { TxThroughputChart } from "@/components/charts/TxThroughputChart";
import { ErrorRateChart } from "@/components/charts/ErrorRateChart";
import { ErrorState } from "@/components/ErrorState";
import { truncateAddress, EXPLORER_URLS } from "@arcana/shared";

interface DApp {
  id: string;
  name: string;
  contractAddresses: string[];
  chainId: number;
  createdAt: string;
}

interface ContractEvent {
  id: number;
  dappId: string;
  eventName: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  eventData: Record<string, unknown>;
  timestamp: string;
}

export default function DAppDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [dapp, setDapp] = useState<DApp | null>(null);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus | null>(
    null,
  );
  const [range, setRange] = useState("24h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const applyMetrics = useCallback((rows: MetricAggregateResponse[]) => {
    setMetrics(
      rows
        .slice()
        .sort(
          (a, b) =>
            new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime(),
        )
        .map((m) => ({
          time: new Date(m.windowStart).toLocaleTimeString(),
          gasUsed: parseFloat(m.avgGasUsed),
          gasPrice: parseFloat(m.avgGasPrice),
          txCount: m.txCount,
          errorRate: parseFloat(m.errorRate) * 100,
          uniqueAddresses: m.uniqueAddresses,
          stylusTxCount: m.stylusTxCount,
        })),
    );
  }, []);

  const refreshBackfill = useCallback(async () => {
    const [metricsRes, eventsRes, backfillRes] = await Promise.all([
      fetchDappMetrics(id, range),
      fetchEvents({ dappId: id, limit: 20 }),
      fetchDappBackfillStatus(id),
    ]);
    applyMetrics(metricsRes.data);
    setEvents(eventsRes.data);
    setBackfillStatus(backfillRes.data);
  }, [applyMetrics, id, range]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dappRes, metricsRes, eventsRes, backfillRes] = await Promise.all([
        fetchDapp(id),
        fetchDappMetrics(id, range),
        fetchEvents({ dappId: id, limit: 20 }),
        fetchDappBackfillStatus(id),
      ]);
      setDapp(dappRes.data);
      applyMetrics(metricsRes.data);
      setEvents(eventsRes.data);
      setBackfillStatus(backfillRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dApp");
    } finally {
      setLoading(false);
    }
  }, [applyMetrics, id, range]);

  useEffect(() => {
    load();
  }, [load]);

  const ranges = ["1h", "6h", "24h", "7d"];
  const latest = metrics[metrics.length - 1];
  const backfillInProgress =
    backfillStatus?.state === "queued" ||
    backfillStatus?.state === "scanning" ||
    backfillStatus?.state === "syncing";
  const backfillProgress =
    backfillStatus?.totalTransactions && backfillStatus.totalTransactions > 0
      ? Math.min(
          100,
          Math.round(
            (backfillStatus.processedTransactions /
              backfillStatus.totalTransactions) *
              100,
          ),
        )
      : null;

  useEffect(() => {
    if (!backfillInProgress) return;

    const interval = setInterval(() => {
      void refreshBackfill().catch(() => {
        // Ignore transient polling errors and keep the latest successful state.
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [backfillInProgress, refreshBackfill]);

  async function handleDelete() {
    if (!dapp) return;
    if (!window.confirm(`Stop monitoring ${dapp.name}?`)) return;

    setDeleting(true);
    setActionError(null);

    try {
      await deleteDapp(dapp.id);
      router.push("/dapps");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to archive dApp",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-800 rounded w-64 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-24"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{dapp.name}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
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
        <div className="flex items-center gap-2 flex-wrap justify-end">
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
          <button
            data-testid="archive-dapp-button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Archiving..." : "Archive dApp"}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      {backfillStatus && (
        <div
          data-testid="backfill-status-panel"
          className={`rounded-lg border px-4 py-4 text-sm ${
            backfillStatus.state === "failed"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : backfillStatus.state === "completed"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em]">
                Historical Backfill
              </p>
              <p className="mt-1">
                {backfillStatus.error ??
                  backfillStatus.message ??
                  "Backfill status unavailable"}
              </p>
            </div>
            <span className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
              {backfillStatus.state}
            </span>
          </div>

          {backfillInProgress && (
            <div className="mt-4 space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-black/20">
                <div
                  className={`h-full rounded-full ${
                    backfillProgress === null
                      ? "w-1/3 animate-pulse bg-cyan-300"
                      : "bg-cyan-300 transition-[width] duration-500"
                  }`}
                  style={
                    backfillProgress === null
                      ? undefined
                      : { width: `${backfillProgress}%` }
                  }
                />
              </div>
              <p className="text-xs text-current/80">
                {backfillStatus.totalTransactions
                  ? `${backfillStatus.processedTransactions.toLocaleString()} of ${backfillStatus.totalTransactions.toLocaleString()} transactions processed`
                  : "Scanning chain history to determine total workload"}
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-current/70">
                Processed
              </p>
              <p className="mt-1 font-semibold">
                {backfillStatus.processedTransactions.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-current/70">
                Indexed Txs
              </p>
              <p className="mt-1 font-semibold">
                {backfillStatus.indexedTransactions.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-current/70">
                Indexed Events
              </p>
              <p className="mt-1 font-semibold">
                {backfillStatus.indexedEvents.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Transactions"
          value={latest?.txCount.toLocaleString() ?? "\u2014"}
        />
        <MetricCard
          title="Avg Gas"
          value={latest ? `${(latest.gasUsed / 1e6).toFixed(2)}M` : "\u2014"}
        />
        <MetricCard
          title="Error Rate"
          value={latest ? `${latest.errorRate.toFixed(2)}%` : "\u2014"}
        />
        <MetricCard
          title="Stylus Txs"
          value={latest?.stylusTxCount.toLocaleString() ?? "\u2014"}
          highlight
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GasUsageChart data={metrics} />
        <TxThroughputChart data={metrics} />
      </div>
      <ErrorRateChart data={metrics} />

      {/* Recent Events */}
      <div className="card overflow-hidden">
        <h3 className="card-header mb-4">Recent Events</h3>
        {events.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            {backfillInProgress
              ? "Historical backfill in progress..."
              : backfillStatus?.state === "completed" &&
                  backfillStatus.indexedEvents === 0
                ? "No historical events found for this dApp."
              : "No events captured for this dApp yet"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a3040]">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Event</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Tx Hash</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Block</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Log #</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr
                    key={`${ev.txHash}-${ev.logIndex}`}
                    className="border-b border-[#2a3040]/50 hover:bg-[#1a1f2e]/50"
                  >
                    <td className="py-2.5 px-3">
                      <span className="badge badge-stylus">{ev.eventName}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <a
                        href={`${EXPLORER_URLS[42161]}/tx/${ev.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-arcana-400 hover:text-arcana-300 font-mono"
                      >
                        {truncateAddress(ev.txHash, 6)}
                      </a>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono">{ev.blockNumber}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300">{ev.logIndex}</td>
                    <td className="py-2.5 px-3 text-right text-xs text-slate-500">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

interface MetricAggregateResponse {
  windowStart: string;
  avgGasUsed: string;
  avgGasPrice: string;
  txCount: number;
  errorRate: string;
  uniqueAddresses: number;
  stylusTxCount: number;
}

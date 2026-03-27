"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Database,
  HardDriveUpload,
  RadioTower,
  RefreshCw,
  ServerCog,
} from "lucide-react";
import {
  fetchSystemStatus,
  type CollectorRuntimeStatus,
  type SystemStatus,
} from "@/lib/api";

const POLL_MS = 15_000;

export default function OpsPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const res = await fetchSystemStatus();
      setStatus(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus("initial");
  }, [loadStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadStatus();
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [loadStatus]);

  const collectorRuntime = status?.collector.runtime ?? null;
  const collectorSecondsSinceUpdate = status?.collector.secondsSinceUpdate ?? null;
  const collectorFreshness =
    collectorSecondsSinceUpdate === null
      ? "Unavailable"
      : `${collectorSecondsSinceUpdate}s ago`;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#859399]">
            Operations
          </p>
          <h1 className="text-4xl font-extrabold tracking-[-0.06em] text-[#dde3e7]">
            System Status
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#bbc9cf]">
            Live health for the API, indexer, Redis, Postgres, and historical
            backfill queue.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadStatus()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#3c494e]/20 bg-[#161d1f] px-4 py-2 text-sm font-semibold text-[#dde3e7] transition-colors hover:bg-[#1a2123]"
        >
          <RefreshCw
            className={`h-4 w-4 text-[#00d1ff] ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </section>

      {error && (
        <div className="rounded-2xl border border-[#93000a]/30 bg-[#2a1517] px-4 py-3 text-sm text-[#ffdad6]">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          icon={<ServerCog className="h-5 w-5" />}
          label="API"
          state={status?.api.status === "ok" ? "healthy" : "missing"}
          detail={
            status
              ? `Uptime ${formatDuration(status.api.uptimeSeconds)}`
              : "Waiting for status"
          }
        />
        <StatusCard
          icon={<Activity className="h-5 w-5" />}
          label="Collector"
          state={status?.collector.status ?? "missing"}
          detail={
            collectorRuntime
              ? `${collectorRuntime.state} • updated ${collectorFreshness}`
              : "No heartbeat yet"
          }
        />
        <StatusCard
          icon={<Database className="h-5 w-5" />}
          label="Postgres"
          state={status?.database.status ?? "missing"}
          detail={
            status?.database.status === "ok"
              ? `${formatNumber(status.database.blockCount)} indexed blocks`
              : status?.database.error ?? "Unavailable"
          }
        />
        <StatusCard
          icon={<RadioTower className="h-5 w-5" />}
          label="Redis"
          state={status?.redis.status === "ok" ? "healthy" : "error"}
          detail={
            status?.redis.status === "ok"
              ? "Pub/sub and shared state online"
              : status?.redis.error ?? "Unavailable"
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-[#3c494e]/15 bg-[#161d1f] p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1a2123] text-[#00d1ff]">
              <HardDriveUpload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#dde3e7]">
                Indexer Runtime
              </h2>
              <p className="text-sm text-[#859399]">
                Latest heartbeat, chain lag, and job cadence.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricTile
              label="Latest Indexed Block"
              value={formatNullableNumber(collectorRuntime?.latestIndexedBlock)}
              note={formatTimestamp(status?.database.latestBlockTimestamp ?? null)}
            />
            <MetricTile
              label="Chain Head"
              value={formatNullableNumber(collectorRuntime?.currentChainBlock)}
              note={`Lag ${formatNullableNumber(collectorRuntime?.blockLag)}`}
            />
            <MetricTile
              label="Next Block"
              value={formatNullableNumber(collectorRuntime?.nextBlockToProcess)}
              note={collectorRuntime?.collecting ? "Collecting now" : "Standing by"}
            />
            <MetricTile
              label="Last Collection"
              value={formatTimestamp(collectorRuntime?.lastCollectionCompletedAt ?? null)}
              note={
                collectorRuntime?.lastCollectionStartedAt
                  ? `Started ${formatTimestamp(collectorRuntime.lastCollectionStartedAt)}`
                  : "No collection recorded"
              }
            />
            <MetricTile
              label="5m Aggregate"
              value={formatTimestamp(collectorRuntime?.lastAggregationAt ?? null)}
              note="Prompt dashboard refresh cycle"
            />
            <MetricTile
              label="Latest Indexed Tx"
              value={formatTimestamp(status?.database.latestTransactionAt ?? null)}
              note={`${formatNullableNumber(status?.dapps.monitored ?? null)} monitored dApps`}
            />
          </div>

          {collectorRuntime?.lastError && (
            <div className="mt-6 rounded-2xl border border-[#93000a]/30 bg-[#2a1517] px-4 py-3 text-sm text-[#ffdad6]">
              {collectorRuntime.lastError}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-[#3c494e]/15 bg-[#161d1f] p-6">
          <h2 className="text-lg font-extrabold text-[#dde3e7]">
            Backfill Queue
          </h2>
          <p className="mt-2 text-sm text-[#859399]">
            Live summary of monitored dApp history sync.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <QueueTile label="Active" value={status?.backfills.active ?? 0} accent="cyan" />
            <QueueTile label="Queued" value={status?.backfills.queued ?? 0} accent="slate" />
            <QueueTile label="Scanning" value={status?.backfills.scanning ?? 0} accent="amber" />
            <QueueTile label="Syncing" value={status?.backfills.syncing ?? 0} accent="cyan" />
            <QueueTile label="Completed" value={status?.backfills.completed ?? 0} accent="green" />
            <QueueTile label="Failed" value={status?.backfills.failed ?? 0} accent="red" />
          </div>

          <div className="mt-6 rounded-2xl border border-[#3c494e]/15 bg-[#101618] px-4 py-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[#859399]">Latest backfill update</span>
              <span className="font-semibold text-[#dde3e7]">
                {formatTimestamp(status?.backfills.latestUpdatedAt ?? null)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 text-sm">
              <span className="text-[#859399]">Total tracked backfills</span>
              <span className="font-semibold text-[#dde3e7]">
                {status?.backfills.total ?? 0}
              </span>
            </div>
          </div>
        </div>
      </section>

      {loading && !status && (
        <div className="rounded-3xl border border-[#3c494e]/15 bg-[#161d1f] px-6 py-8 text-sm text-[#859399]">
          Loading system status...
        </div>
      )}
    </div>
  );
}

function StatusCard({
  icon,
  label,
  state,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  state: "healthy" | "ok" | "error" | "stale" | "missing";
  detail: string;
}) {
  const tone =
    state === "healthy" || state === "ok"
      ? "border-[#00d1ff]/20 bg-[#131c20] text-[#00d1ff]"
      : state === "stale"
        ? "border-[#feb127]/20 bg-[#22180a] text-[#ffd59c]"
        : "border-[#93000a]/30 bg-[#2a1517] text-[#ffb4ab]";

  return (
    <div className="rounded-3xl border border-[#3c494e]/15 bg-[#161d1f] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#859399]">
            {label}
          </p>
          <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${tone}`}>
            {state}
          </div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1a2123] text-[#00d1ff]">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#bbc9cf]">{detail}</p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-[#3c494e]/15 bg-[#101618] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#859399]">
        {label}
      </p>
      <p className="mt-3 text-xl font-extrabold tracking-[-0.04em] text-[#dde3e7]">
        {value}
      </p>
      <p className="mt-2 text-sm text-[#859399]">{note}</p>
    </div>
  );
}

function QueueTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "cyan" | "amber" | "green" | "red" | "slate";
}) {
  const tone =
    accent === "cyan"
      ? "border-[#00d1ff]/20 bg-[#131c20] text-[#00d1ff]"
      : accent === "amber"
        ? "border-[#feb127]/20 bg-[#22180a] text-[#ffd59c]"
        : accent === "green"
          ? "border-emerald-500/20 bg-emerald-950/40 text-emerald-300"
          : accent === "red"
            ? "border-[#93000a]/30 bg-[#2a1517] text-[#ffb4ab]"
            : "border-[#3c494e]/15 bg-[#101618] text-[#dde3e7]";

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-80">
        {label}
      </p>
      <p className="mt-3 text-3xl font-extrabold tracking-[-0.05em]">{value}</p>
    </div>
  );
}

function formatNullableNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "Unavailable" : formatNumber(value);
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "0" : value.toLocaleString();
}

function formatTimestamp(value: string | null) {
  if (!value) return "Unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatDuration(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)}m`;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

import {
  INTERNAL_REDIS_KEYS,
  type BackfillStatus,
  type CollectorRuntimeStatus,
} from "@arcana/shared";
import {
  getAllDapps,
  getBlockCount,
  getLatestBlock,
  getLatestTransactionTimestamp,
} from "@arcana/db";
import type { App } from "../types";

const COLLECTOR_STALE_MS = 60_000;

export function registerSystemRoutes(app: App) {
  app.get("/api/system/status", async () => {
    const generatedAt = new Date();

    const [database, redis, collector, dapps, backfills] = await Promise.all([
      getDatabaseStatus(app),
      getRedisStatus(app),
      getCollectorStatus(app, generatedAt),
      getDappStatus(app),
      getBackfillSummary(app),
    ]);

    return {
      success: true,
      data: {
        generatedAt: generatedAt.toISOString(),
        api: {
          status: "ok" as const,
          startedAt: app.startedAt.toISOString(),
          uptimeSeconds: Math.max(
            Math.round((generatedAt.getTime() - app.startedAt.getTime()) / 1000),
            0,
          ),
        },
        database,
        redis,
        collector,
        dapps,
        backfills,
      },
    };
  });
}

async function getDatabaseStatus(app: App) {
  try {
    const [latestBlock, blockCount, latestTransactionAt] = await Promise.all([
      getLatestBlock(app.db),
      getBlockCount(app.db),
      getLatestTransactionTimestamp(app.db),
    ]);
    const normalizedBlockCount = Number(blockCount);

    return {
      status: "ok" as const,
      latestBlockNumber: latestBlock?.blockNumber ?? null,
      latestBlockTimestamp: latestBlock?.timestamp.toISOString() ?? null,
      blockCount: Number.isFinite(normalizedBlockCount)
        ? normalizedBlockCount
        : null,
      latestTransactionAt: latestTransactionAt?.toISOString() ?? null,
      error: null,
    };
  } catch (error) {
    return {
      status: "error" as const,
      latestBlockNumber: null,
      latestBlockTimestamp: null,
      blockCount: null,
      latestTransactionAt: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getRedisStatus(app: App) {
  try {
    const pong = await app.redisPub.ping();
    return {
      status: pong === "PONG" ? ("ok" as const) : ("error" as const),
      error: pong === "PONG" ? null : `Unexpected ping response: ${pong}`,
    };
  } catch (error) {
    return {
      status: "error" as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getCollectorStatus(app: App, generatedAt: Date) {
  try {
    const raw = await app.redisPub.get(INTERNAL_REDIS_KEYS.COLLECTOR_STATUS);
    const runtime = parseCollectorRuntimeStatus(raw);

    if (!runtime) {
      return {
        status: "missing" as const,
        staleThresholdMs: COLLECTOR_STALE_MS,
        secondsSinceUpdate: null,
        runtime: null,
      };
    }

    const secondsSinceUpdate = Math.max(
      Math.round((generatedAt.getTime() - runtime.updatedAt.getTime()) / 1000),
      0,
    );
    const isStale =
      generatedAt.getTime() - runtime.updatedAt.getTime() > COLLECTOR_STALE_MS;
    const status =
      runtime.state === "error"
        ? "error"
        : isStale || runtime.state === "stopped"
          ? "stale"
          : "healthy";

    return {
      status,
      staleThresholdMs: COLLECTOR_STALE_MS,
      secondsSinceUpdate,
      runtime: serializeCollectorRuntimeStatus(runtime),
    };
  } catch (error) {
    return {
      status: "error" as const,
      staleThresholdMs: COLLECTOR_STALE_MS,
      secondsSinceUpdate: null,
      runtime: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getDappStatus(app: App) {
  try {
    const dapps = await getAllDapps(app.db);
    return {
      monitored: dapps.length,
    };
  } catch {
    return {
      monitored: null,
    };
  }
}

async function getBackfillSummary(app: App) {
  try {
    const keys = await app.redisPub.keys(
      `${INTERNAL_REDIS_KEYS.BACKFILL_STATUS_PREFIX}*`,
    );

    if (keys.length === 0) {
      return emptyBackfillSummary();
    }

    const rawStatuses = await app.redisPub.mget(keys);
    const statuses = rawStatuses
      .map((raw) => parseBackfillStatus(raw))
      .filter((status): status is BackfillStatus => status !== null);

    const summary = emptyBackfillSummary();
    let latestUpdatedAt: Date | null = null;

    for (const status of statuses) {
      summary.total += 1;
      summary[status.state] += 1;
      if (status.state === "queued" || status.state === "scanning" || status.state === "syncing") {
        summary.active += 1;
      }
      if (!latestUpdatedAt || status.updatedAt > latestUpdatedAt) {
        latestUpdatedAt = status.updatedAt;
      }
    }

    return {
      ...summary,
      latestUpdatedAt: latestUpdatedAt?.toISOString() ?? null,
    };
  } catch {
    return {
      ...emptyBackfillSummary(),
      latestUpdatedAt: null,
    };
  }
}

function emptyBackfillSummary() {
  return {
    total: 0,
    active: 0,
    queued: 0,
    scanning: 0,
    syncing: 0,
    completed: 0,
    failed: 0,
    latestUpdatedAt: null as string | null,
  };
}

function parseCollectorRuntimeStatus(
  raw: string | null,
): CollectorRuntimeStatus | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SerializedCollectorRuntimeStatus;
    return {
      ...parsed,
      startedAt: new Date(parsed.startedAt),
      updatedAt: new Date(parsed.updatedAt),
      lastCollectionStartedAt: parsed.lastCollectionStartedAt
        ? new Date(parsed.lastCollectionStartedAt)
        : null,
      lastCollectionCompletedAt: parsed.lastCollectionCompletedAt
        ? new Date(parsed.lastCollectionCompletedAt)
        : null,
      lastAggregationAt: parsed.lastAggregationAt
        ? new Date(parsed.lastAggregationAt)
        : null,
      lastHourlyAggregationAt: parsed.lastHourlyAggregationAt
        ? new Date(parsed.lastHourlyAggregationAt)
        : null,
      lastDailyAggregationAt: parsed.lastDailyAggregationAt
        ? new Date(parsed.lastDailyAggregationAt)
        : null,
    };
  } catch {
    return null;
  }
}

function serializeCollectorRuntimeStatus(status: CollectorRuntimeStatus) {
  return {
    ...status,
    startedAt: status.startedAt.toISOString(),
    updatedAt: status.updatedAt.toISOString(),
    lastCollectionStartedAt: status.lastCollectionStartedAt?.toISOString() ?? null,
    lastCollectionCompletedAt:
      status.lastCollectionCompletedAt?.toISOString() ?? null,
    lastAggregationAt: status.lastAggregationAt?.toISOString() ?? null,
    lastHourlyAggregationAt:
      status.lastHourlyAggregationAt?.toISOString() ?? null,
    lastDailyAggregationAt: status.lastDailyAggregationAt?.toISOString() ?? null,
  };
}

function parseBackfillStatus(raw: string | null): BackfillStatus | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SerializedBackfillStatus;
    return {
      ...parsed,
      startedAt: new Date(parsed.startedAt),
      updatedAt: new Date(parsed.updatedAt),
      finishedAt: parsed.finishedAt ? new Date(parsed.finishedAt) : null,
    };
  } catch {
    return null;
  }
}

interface SerializedCollectorRuntimeStatus
  extends Omit<
    CollectorRuntimeStatus,
    | "startedAt"
    | "updatedAt"
    | "lastCollectionStartedAt"
    | "lastCollectionCompletedAt"
    | "lastAggregationAt"
    | "lastHourlyAggregationAt"
    | "lastDailyAggregationAt"
  > {
  startedAt: string;
  updatedAt: string;
  lastCollectionStartedAt: string | null;
  lastCollectionCompletedAt: string | null;
  lastAggregationAt: string | null;
  lastHourlyAggregationAt: string | null;
  lastDailyAggregationAt: string | null;
}

interface SerializedBackfillStatus
  extends Omit<BackfillStatus, "startedAt" | "updatedAt" | "finishedAt"> {
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

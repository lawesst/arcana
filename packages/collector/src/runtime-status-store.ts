import type Redis from "ioredis";
import {
  INTERNAL_REDIS_KEYS,
  type CollectorRuntimeState,
  type CollectorRuntimeStatus,
} from "@arcana/shared";

export async function readCollectorRuntimeStatus(
  redis: Redis,
): Promise<CollectorRuntimeStatus | null> {
  const raw = await redis.get(INTERNAL_REDIS_KEYS.COLLECTOR_STATUS);
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

export async function createCollectorRuntimeStatus(
  redis: Redis,
): Promise<CollectorRuntimeStatus> {
  const existing = await readCollectorRuntimeStatus(redis);
  if (existing) return existing;

  const now = new Date();
  return {
    service: "arcana-collector",
    state: "starting",
    startedAt: now,
    updatedAt: now,
    currentChainBlock: null,
    latestIndexedBlock: null,
    nextBlockToProcess: null,
    blockLag: null,
    collecting: false,
    lastCollectionStartedAt: null,
    lastCollectionCompletedAt: null,
    lastAggregationAt: null,
    lastHourlyAggregationAt: null,
    lastDailyAggregationAt: null,
    lastError: null,
  };
}

export async function updateCollectorRuntimeStatus(
  redis: Redis,
  status: CollectorRuntimeStatus,
  patch: {
    state?: CollectorRuntimeState;
    currentChainBlock?: number | null;
    latestIndexedBlock?: number | null;
    nextBlockToProcess?: number | null;
    blockLag?: number | null;
    collecting?: boolean;
    lastCollectionStartedAt?: Date | null;
    lastCollectionCompletedAt?: Date | null;
    lastAggregationAt?: Date | null;
    lastHourlyAggregationAt?: Date | null;
    lastDailyAggregationAt?: Date | null;
    lastError?: string | null;
  },
) {
  if (patch.state !== undefined) status.state = patch.state;
  if (patch.currentChainBlock !== undefined) {
    status.currentChainBlock = patch.currentChainBlock;
  }
  if (patch.latestIndexedBlock !== undefined) {
    status.latestIndexedBlock = patch.latestIndexedBlock;
  }
  if (patch.nextBlockToProcess !== undefined) {
    status.nextBlockToProcess = patch.nextBlockToProcess;
  }
  if (patch.blockLag !== undefined) {
    status.blockLag = patch.blockLag;
  }
  if (patch.collecting !== undefined) {
    status.collecting = patch.collecting;
  }
  if (patch.lastCollectionStartedAt !== undefined) {
    status.lastCollectionStartedAt = patch.lastCollectionStartedAt;
  }
  if (patch.lastCollectionCompletedAt !== undefined) {
    status.lastCollectionCompletedAt = patch.lastCollectionCompletedAt;
  }
  if (patch.lastAggregationAt !== undefined) {
    status.lastAggregationAt = patch.lastAggregationAt;
  }
  if (patch.lastHourlyAggregationAt !== undefined) {
    status.lastHourlyAggregationAt = patch.lastHourlyAggregationAt;
  }
  if (patch.lastDailyAggregationAt !== undefined) {
    status.lastDailyAggregationAt = patch.lastDailyAggregationAt;
  }
  if (patch.lastError !== undefined) {
    status.lastError = patch.lastError;
  }

  status.updatedAt = new Date();

  await redis.set(
    INTERNAL_REDIS_KEYS.COLLECTOR_STATUS,
    JSON.stringify(serializeCollectorRuntimeStatus(status)),
  );
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

function serializeCollectorRuntimeStatus(
  status: CollectorRuntimeStatus,
): SerializedCollectorRuntimeStatus {
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

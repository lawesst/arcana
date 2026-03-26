import type Redis from "ioredis";
import {
  INTERNAL_REDIS_KEYS,
  type BackfillStatus,
} from "@arcana/shared";

export function getBackfillStatusKey(dappId: string) {
  return `${INTERNAL_REDIS_KEYS.BACKFILL_STATUS_PREFIX}${dappId}`;
}

export async function writeBackfillStatus(
  redis: Redis,
  status: BackfillStatus,
) {
  await redis.set(
    getBackfillStatusKey(status.dappId),
    JSON.stringify({
      ...status,
      startedAt: status.startedAt.toISOString(),
      updatedAt: status.updatedAt.toISOString(),
      finishedAt: status.finishedAt?.toISOString() ?? null,
    }),
  );
}

export async function readBackfillStatus(
  redis: Redis,
  dappId: string,
): Promise<BackfillStatus | null> {
  const raw = await redis.get(getBackfillStatusKey(dappId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Omit<
      BackfillStatus,
      "startedAt" | "updatedAt" | "finishedAt"
    > & {
      startedAt: string;
      updatedAt: string;
      finishedAt: string | null;
    };

    return {
      ...parsed,
      startedAt: new Date(parsed.startedAt),
      updatedAt: new Date(parsed.updatedAt),
      finishedAt: parsed.finishedAt ? new Date(parsed.finishedAt) : null,
      totalTransactions:
        parsed.totalTransactions === null
          ? null
          : Number(parsed.totalTransactions),
      processedTransactions: Number(parsed.processedTransactions),
      indexedTransactions: Number(parsed.indexedTransactions),
      indexedEvents: Number(parsed.indexedEvents),
    };
  } catch {
    return null;
  }
}

export async function clearBackfillStatus(redis: Redis, dappId: string) {
  await redis.del(getBackfillStatusKey(dappId));
}

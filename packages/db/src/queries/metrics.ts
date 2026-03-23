import { desc, eq, gte, and, sql } from "drizzle-orm";
import { metricAggregates } from "../schema/metric-aggregates";
import type { Database } from "../index";

export async function upsertMetricAggregate(
  db: Database,
  data: {
    dappId: string | null;
    window: string;
    windowStart: Date;
    avgGasUsed: string;
    avgGasPrice: string;
    txCount: number;
    errorCount: number;
    errorRate: string;
    avgTxSpeed: string;
    uniqueAddresses: number;
    stylusTxCount: number;
  },
) {
  return db
    .insert(metricAggregates)
    .values(data)
    .onConflictDoUpdate({
      target: [
        metricAggregates.dappId,
        metricAggregates.window,
        metricAggregates.windowStart,
      ],
      set: {
        avgGasUsed: data.avgGasUsed,
        avgGasPrice: data.avgGasPrice,
        txCount: data.txCount,
        errorCount: data.errorCount,
        errorRate: data.errorRate,
        avgTxSpeed: data.avgTxSpeed,
        uniqueAddresses: data.uniqueAddresses,
        stylusTxCount: data.stylusTxCount,
      },
    });
}

export async function getMetrics(
  db: Database,
  opts: {
    dappId?: string | null;
    window: string;
    since: Date;
    limit?: number;
  },
) {
  const conditions = [
    eq(metricAggregates.window, opts.window),
    gte(metricAggregates.windowStart, opts.since),
  ];

  if (opts.dappId !== undefined) {
    if (opts.dappId === null) {
      conditions.push(sql`${metricAggregates.dappId} IS NULL`);
    } else {
      conditions.push(eq(metricAggregates.dappId, opts.dappId));
    }
  }

  return db
    .select()
    .from(metricAggregates)
    .where(and(...conditions))
    .orderBy(desc(metricAggregates.windowStart))
    .limit(opts.limit ?? 200);
}

export async function getLatestAggregate(
  db: Database,
  opts: { dappId?: string | null; window: string },
) {
  const conditions = [eq(metricAggregates.window, opts.window)];

  if (opts.dappId !== undefined) {
    if (opts.dappId === null) {
      conditions.push(sql`${metricAggregates.dappId} IS NULL`);
    } else {
      conditions.push(eq(metricAggregates.dappId, opts.dappId));
    }
  }

  const results = await db
    .select()
    .from(metricAggregates)
    .where(and(...conditions))
    .orderBy(desc(metricAggregates.windowStart))
    .limit(1);
  return results[0] ?? null;
}

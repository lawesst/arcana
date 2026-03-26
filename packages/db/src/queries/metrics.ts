import { desc, eq, gte, and, lte, sql } from "drizzle-orm";
import { metricAggregates } from "../schema/metric-aggregates";
import { transactions } from "../schema/transactions";
import type { Database } from "../index";
import { WINDOW_DURATION_MS } from "@arcana/shared";

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
  const set = {
    avgGasUsed: data.avgGasUsed,
    avgGasPrice: data.avgGasPrice,
    txCount: data.txCount,
    errorCount: data.errorCount,
    errorRate: data.errorRate,
    avgTxSpeed: data.avgTxSpeed,
    uniqueAddresses: data.uniqueAddresses,
    stylusTxCount: data.stylusTxCount,
  };

  if (data.dappId === null) {
    return db
      .insert(metricAggregates)
      .values(data)
      .onConflictDoUpdate({
        target: [metricAggregates.window, metricAggregates.windowStart],
        targetWhere: sql`${metricAggregates.dappId} is null`,
        set,
      });
  }

  return db
    .insert(metricAggregates)
    .values(data)
    .onConflictDoUpdate({
      target: [
        metricAggregates.dappId,
        metricAggregates.window,
        metricAggregates.windowStart,
      ],
      targetWhere: sql`${metricAggregates.dappId} is not null`,
      set,
    });
}

export async function getMetrics(
  db: Database,
  opts: {
    dappId?: string | null;
    window: string;
    since: Date;
    until?: Date;
    excludeEmpty?: boolean;
    limit?: number;
  },
) {
  const conditions = [
    eq(metricAggregates.window, opts.window),
    gte(metricAggregates.windowStart, opts.since),
  ];

  if (opts.until) {
    conditions.push(lte(metricAggregates.windowStart, opts.until));
  }

  if (opts.excludeEmpty) {
    conditions.push(sql`${metricAggregates.txCount} > 0`);
  }

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
  opts: { dappId?: string | null; window: string; nonEmpty?: boolean },
) {
  const conditions = [eq(metricAggregates.window, opts.window)];

  if (opts.nonEmpty) {
    conditions.push(sql`${metricAggregates.txCount} > 0`);
  }

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

export async function getMetricsFromTransactions(
  db: Database,
  opts: {
    dappId?: string | null;
    window: keyof typeof WINDOW_DURATION_MS;
    since: Date;
    until: Date;
  },
) {
  const windowSeconds = Math.floor(WINDOW_DURATION_MS[opts.window] / 1000);
  const bucket = sql<string>`to_timestamp(
    floor(extract(epoch from ${transactions.timestamp}) / ${sql.raw(String(windowSeconds))})
    * ${sql.raw(String(windowSeconds))}
  )`;
  const conditions = [
    gte(transactions.timestamp, opts.since),
    lte(transactions.timestamp, opts.until),
  ];

  if (opts.dappId !== undefined) {
    if (opts.dappId === null) {
      conditions.push(sql`${transactions.dappId} is null`);
    } else {
      conditions.push(eq(transactions.dappId, opts.dappId));
    }
  }

  return db
    .select({
      windowStart: bucket,
      txCount: sql<number>`count(*)::int`,
      errorCount: sql<number>`(count(*) filter (where ${transactions.status} = 0))::int`,
      avgGasUsed: sql<string>`coalesce(avg(${transactions.gasUsed}), 0)`,
      avgGasPrice: sql<string>`coalesce(avg(${transactions.gasPrice}), 0)`,
      errorRate: sql<string>`
        case
          when count(*) > 0
            then (count(*) filter (where ${transactions.status} = 0))::numeric / count(*)
          else 0
        end
      `,
      avgTxSpeed: sql<string>`0`,
      uniqueAddresses: sql<number>`count(distinct ${transactions.fromAddress})::int`,
      stylusTxCount: sql<number>`(count(*) filter (where ${transactions.isStylus} = true))::int`,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(bucket)
    .orderBy(bucket);
}

import { sql, gte, and, eq } from "drizzle-orm";
import { transactions } from "../schema/transactions";
import type { Database } from "../index";

/** Gas comparison: avg gas for Stylus vs EVM transactions */
export async function getGasComparison(
  db: Database,
  since?: Date,
) {
  const conditions = since ? [gte(transactions.timestamp, since)] : [];

  const result = await db
    .select({
      stylusAvgGas: sql<string>`coalesce(avg(${transactions.gasUsed}) filter (where ${transactions.isStylus} = true), 0)`,
      evmAvgGas: sql<string>`coalesce(avg(${transactions.gasUsed}) filter (where ${transactions.isStylus} = false), 0)`,
      stylusTotalGas: sql<string>`coalesce(sum(${transactions.gasUsed}) filter (where ${transactions.isStylus} = true), 0)`,
      evmTotalGas: sql<string>`coalesce(sum(${transactions.gasUsed}) filter (where ${transactions.isStylus} = false), 0)`,
      stylusCount: sql<number>`count(*) filter (where ${transactions.isStylus} = true)`,
      evmCount: sql<number>`count(*) filter (where ${transactions.isStylus} = false)`,
      stylusAvgGasPrice: sql<string>`coalesce(avg(${transactions.gasPrice}) filter (where ${transactions.isStylus} = true), 0)`,
      evmAvgGasPrice: sql<string>`coalesce(avg(${transactions.gasPrice}) filter (where ${transactions.isStylus} = false), 0)`,
    })
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result[0];
}

/** Gas comparison over time windows for charting */
export async function getGasComparisonTimeSeries(
  db: Database,
  opts: { since: Date; bucketMinutes: number },
) {
  const { since, bucketMinutes } = opts;

  // Use Drizzle select with grouping by time buckets
  const results = await db
    .select({
      bucket: sql<string>`date_trunc('hour', ${transactions.timestamp})
        + (floor(extract(minute from ${transactions.timestamp}) / ${sql.raw(String(bucketMinutes))}) * ${sql.raw(String(bucketMinutes))} || ' minutes')::interval`,
      stylusAvgGas: sql<string>`coalesce(avg(${transactions.gasUsed}) filter (where ${transactions.isStylus} = true), 0)`,
      evmAvgGas: sql<string>`coalesce(avg(${transactions.gasUsed}) filter (where ${transactions.isStylus} = false), 0)`,
      stylusCount: sql<number>`count(*) filter (where ${transactions.isStylus} = true)`,
      evmCount: sql<number>`count(*) filter (where ${transactions.isStylus} = false)`,
    })
    .from(transactions)
    .where(gte(transactions.timestamp, since))
    .groupBy(
      sql`date_trunc('hour', ${transactions.timestamp})
        + (floor(extract(minute from ${transactions.timestamp}) / ${sql.raw(String(bucketMinutes))}) * ${sql.raw(String(bucketMinutes))} || ' minutes')::interval`,
    )
    .orderBy(
      sql`date_trunc('hour', ${transactions.timestamp})
        + (floor(extract(minute from ${transactions.timestamp}) / ${sql.raw(String(bucketMinutes))}) * ${sql.raw(String(bucketMinutes))} || ' minutes')::interval asc`,
    );

  return results.map((r) => ({
    bucket: String(r.bucket),
    stylus_avg_gas: String(r.stylusAvgGas),
    evm_avg_gas: String(r.evmAvgGas),
    stylus_count: String(r.stylusCount),
    evm_count: String(r.evmCount),
  }));
}

/** Get top Stylus contracts by transaction count */
export async function getTopStylusContracts(
  db: Database,
  opts: { since?: Date; limit?: number } = {},
) {
  const { since, limit = 20 } = opts;
  const conditions = [eq(transactions.isStylus, true)];
  if (since) conditions.push(gte(transactions.timestamp, since));

  const results = await db
    .select({
      address: transactions.toAddress,
      txCount: sql<number>`count(*)`,
      avgGas: sql<string>`avg(${transactions.gasUsed})`,
      totalGas: sql<string>`sum(${transactions.gasUsed})`,
      errorCount: sql<number>`count(*) filter (where ${transactions.status} = 0)`,
      uniqueCallers: sql<number>`count(distinct ${transactions.fromAddress})`,
      firstSeen: sql<string>`min(${transactions.timestamp})`,
      lastSeen: sql<string>`max(${transactions.timestamp})`,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.toAddress)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return results;
}

/** Overall Stylus adoption stats */
export async function getStylusAdoptionStats(
  db: Database,
  since?: Date,
) {
  const conditions = since ? [gte(transactions.timestamp, since)] : [];

  const result = await db
    .select({
      totalTxs: sql<number>`count(*)`,
      stylusTxs: sql<number>`count(*) filter (where ${transactions.isStylus} = true)`,
      evmTxs: sql<number>`count(*) filter (where ${transactions.isStylus} = false)`,
      stylusContracts: sql<number>`count(distinct ${transactions.toAddress}) filter (where ${transactions.isStylus} = true)`,
      evmContracts: sql<number>`count(distinct ${transactions.toAddress}) filter (where ${transactions.isStylus} = false)`,
      stylusErrorRate: sql<string>`
        case when count(*) filter (where ${transactions.isStylus} = true) > 0
        then (count(*) filter (where ${transactions.isStylus} = true and ${transactions.status} = 0))::numeric
          / count(*) filter (where ${transactions.isStylus} = true)
        else 0 end
      `,
      evmErrorRate: sql<string>`
        case when count(*) filter (where ${transactions.isStylus} = false) > 0
        then (count(*) filter (where ${transactions.isStylus} = false and ${transactions.status} = 0))::numeric
          / count(*) filter (where ${transactions.isStylus} = false)
        else 0 end
      `,
    })
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result[0];
}

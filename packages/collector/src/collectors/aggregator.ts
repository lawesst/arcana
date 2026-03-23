import { sql, gte, and, eq, lte } from "drizzle-orm";
import type { Database } from "@arcana/db";
import { transactions, upsertMetricAggregate } from "@arcana/db";
import { WINDOW_DURATION_MS, safeDivide } from "@arcana/shared";

export class Aggregator {
  constructor(private db: Database) {}

  /** Compute and store aggregates for a given window */
  async computeAggregates(
    window: "5m" | "1h" | "24h",
    dappId: string | null = null,
  ): Promise<AggregateResult | null> {
    const durationMs = WINDOW_DURATION_MS[window];
    const now = new Date();
    const windowStart = new Date(
      Math.floor(now.getTime() / durationMs) * durationMs,
    );
    const windowEnd = new Date(windowStart.getTime() + durationMs);

    const conditions = [
      gte(transactions.timestamp, windowStart),
      lte(transactions.timestamp, windowEnd),
    ];

    if (dappId) {
      conditions.push(eq(transactions.dappId, dappId));
    } else {
      // Global aggregate: all transactions
    }

    const result = await this.db
      .select({
        txCount: sql<number>`count(*)`,
        errorCount: sql<number>`count(*) filter (where ${transactions.status} = 0)`,
        avgGasUsed: sql<string>`coalesce(avg(${transactions.gasUsed}), 0)`,
        avgGasPrice: sql<string>`coalesce(avg(${transactions.gasPrice}), 0)`,
        uniqueAddresses: sql<number>`count(distinct ${transactions.fromAddress})`,
        stylusTxCount: sql<number>`count(*) filter (where ${transactions.isStylus} = true)`,
      })
      .from(transactions)
      .where(and(...conditions));

    const row = result[0];
    if (!row || row.txCount === 0) return null;

    const errorRate = safeDivide(row.errorCount, row.txCount);

    const aggregate: AggregateResult = {
      dappId,
      window,
      windowStart,
      avgGasUsed: row.avgGasUsed,
      avgGasPrice: row.avgGasPrice,
      txCount: row.txCount,
      errorCount: row.errorCount,
      errorRate: errorRate.toFixed(6),
      avgTxSpeed: "0", // Block-time approximation for Arbitrum (~0.25s)
      uniqueAddresses: row.uniqueAddresses,
      stylusTxCount: row.stylusTxCount,
    };

    await upsertMetricAggregate(this.db, aggregate);

    return aggregate;
  }

  /** Compute aggregates for all registered dApps + global */
  async computeAll(
    window: "5m" | "1h" | "24h",
    dappIds: string[],
  ): Promise<AggregateResult[]> {
    const results: AggregateResult[] = [];

    // Global aggregate
    const global = await this.computeAggregates(window, null);
    if (global) results.push(global);

    // Per-dApp aggregates
    for (const dappId of dappIds) {
      const agg = await this.computeAggregates(window, dappId);
      if (agg) results.push(agg);
    }

    return results;
  }
}

export interface AggregateResult {
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
}

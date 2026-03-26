import { desc, eq, gte, and, sql } from "drizzle-orm";
import { transactions } from "../schema/transactions";
import type { Database } from "../index";

export async function insertTransaction(
  db: Database,
  data: {
    txHash: string;
    blockNumber: number;
    dappId: string | null;
    fromAddress: string;
    toAddress: string | null;
    gasUsed: bigint;
    gasPrice: bigint;
    status: number;
    txType: number;
    timestamp: Date;
    inputSize: number;
    isStylus: boolean;
    methodId: string | null;
  },
) {
  return db
    .insert(transactions)
    .values(data)
    .onConflictDoNothing({ target: transactions.txHash });
}

export async function insertTransactionsBatch(
  db: Database,
  data: Array<{
    txHash: string;
    blockNumber: number;
    dappId: string | null;
    fromAddress: string;
    toAddress: string | null;
    gasUsed: bigint;
    gasPrice: bigint;
    status: number;
    txType: number;
    timestamp: Date;
    inputSize: number;
    isStylus: boolean;
    methodId: string | null;
  }>,
) {
  if (data.length === 0) return 0;
  const inserted = await db
    .insert(transactions)
    .values(data)
    .onConflictDoNothing({ target: transactions.txHash })
    .returning({ txHash: transactions.txHash });
  return inserted.length;
}

export async function getRecentTransactions(
  db: Database,
  opts: { dappId?: string; limit?: number; offset?: number } = {},
) {
  const { dappId, limit = 50, offset = 0 } = opts;
  const conditions = dappId
    ? [eq(transactions.dappId, dappId)]
    : [];

  return db
    .select()
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.timestamp))
    .limit(limit)
    .offset(offset);
}

export async function getTransactionByHash(db: Database, txHash: string) {
  const results = await db
    .select()
    .from(transactions)
    .where(eq(transactions.txHash, txHash));
  return results[0] ?? null;
}

export async function getTransactionCountSince(
  db: Database,
  since: Date,
  dappId?: string,
) {
  const conditions = [gte(transactions.timestamp, since)];
  if (dappId) conditions.push(eq(transactions.dappId, dappId));

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(...conditions));
  return result[0].count;
}

export async function getTransactionsByAddress(
  db: Database,
  address: string,
  limit = 20,
) {
  const lower = address.toLowerCase();
  return db
    .select()
    .from(transactions)
    .where(
      sql`lower(${transactions.fromAddress}) = ${lower} or lower(${transactions.toAddress}) = ${lower}`,
    )
    .orderBy(desc(transactions.timestamp))
    .limit(limit);
}

export async function getStylusTransactionCount(db: Database, since?: Date) {
  const conditions = [eq(transactions.isStylus, true)];
  if (since) conditions.push(gte(transactions.timestamp, since));

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(...conditions));
  return result[0].count;
}

export async function getLatestTransactionTimestamp(
  db: Database,
  dappId?: string,
) {
  const conditions = dappId
    ? [eq(transactions.dappId, dappId)]
    : [];

  const result = await db
    .select({
      timestamp: sql<string | null>`max(${transactions.timestamp})`,
    })
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result[0].timestamp ? new Date(result[0].timestamp) : null;
}

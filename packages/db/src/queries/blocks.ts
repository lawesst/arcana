import { desc, eq, gte, sql } from "drizzle-orm";
import { blocks } from "../schema/blocks";
import type { Database } from "../index";

export async function insertBlock(
  db: Database,
  data: {
    blockNumber: number;
    blockHash: string;
    timestamp: Date;
    gasUsed: bigint;
    gasLimit: bigint;
    txCount: number;
    baseFee: bigint | null;
  },
) {
  return db
    .insert(blocks)
    .values(data)
    .onConflictDoNothing({ target: blocks.blockNumber });
}

export async function getLatestBlock(db: Database) {
  const results = await db
    .select()
    .from(blocks)
    .orderBy(desc(blocks.blockNumber))
    .limit(1);
  return results[0] ?? null;
}

export async function getRecentBlocks(db: Database, limit = 20, offset = 0) {
  return db
    .select()
    .from(blocks)
    .orderBy(desc(blocks.blockNumber))
    .limit(limit)
    .offset(offset);
}

export async function getBlockByNumber(db: Database, blockNumber: number) {
  const results = await db
    .select()
    .from(blocks)
    .where(eq(blocks.blockNumber, blockNumber));
  return results[0] ?? null;
}

export async function getBlocksSince(db: Database, since: Date) {
  return db
    .select()
    .from(blocks)
    .where(gte(blocks.timestamp, since))
    .orderBy(blocks.blockNumber);
}

export async function getBlockCount(db: Database) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(blocks);
  return result[0].count;
}

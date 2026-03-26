import { desc, eq, gte, and, sql } from "drizzle-orm";
import { contractEvents } from "../schema/contract-events";
import type { Database } from "../index";

export async function insertEvent(
  db: Database,
  data: {
    dappId: string;
    eventName: string;
    txHash: string;
    blockNumber: number;
    logIndex: number;
    eventData: Record<string, unknown>;
    timestamp: Date;
  },
) {
  return db
    .insert(contractEvents)
    .values(data)
    .onConflictDoNothing();
}

export async function insertEventsBatch(
  db: Database,
  data: Array<{
    dappId: string;
    eventName: string;
    txHash: string;
    blockNumber: number;
    logIndex: number;
    eventData: Record<string, unknown>;
    timestamp: Date;
  }>,
) {
  if (data.length === 0) return;
  return db
    .insert(contractEvents)
    .values(data)
    .onConflictDoNothing();
}

export async function getEvents(
  db: Database,
  opts: {
    dappId?: string;
    eventName?: string;
    txHash?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const { dappId, eventName, txHash, limit = 50, offset = 0 } = opts;
  const conditions = [];

  if (dappId) conditions.push(eq(contractEvents.dappId, dappId));
  if (eventName) conditions.push(eq(contractEvents.eventName, eventName));
  if (txHash) conditions.push(eq(contractEvents.txHash, txHash));

  return db
    .select()
    .from(contractEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contractEvents.timestamp))
    .limit(limit)
    .offset(offset);
}

export async function getEventNames(
  db: Database,
  dappId?: string,
) {
  const conditions = dappId
    ? [eq(contractEvents.dappId, dappId)]
    : [];

  const results = await db
    .select({
      eventName: contractEvents.eventName,
      count: sql<number>`count(*)`,
    })
    .from(contractEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(contractEvents.eventName)
    .orderBy(sql`count(*) desc`);

  return results;
}

export async function getEventCountSince(
  db: Database,
  since: Date,
  dappId?: string,
) {
  const conditions = [gte(contractEvents.timestamp, since)];
  if (dappId) conditions.push(eq(contractEvents.dappId, dappId));

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(contractEvents)
    .where(and(...conditions));
  return result[0].count;
}

export async function getLatestEventTimestamp(
  db: Database,
  dappId?: string,
) {
  const conditions = dappId
    ? [eq(contractEvents.dappId, dappId)]
    : [];

  const result = await db
    .select({
      timestamp: sql<string | null>`max(${contractEvents.timestamp})`,
    })
    .from(contractEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result[0].timestamp ? new Date(result[0].timestamp) : null;
}

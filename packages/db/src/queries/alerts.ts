import { desc, eq, and, sql } from "drizzle-orm";
import { alertRules, alertHistory } from "../schema/alerts";
import type { Database } from "../index";

export async function getAlertRules(db: Database, dappId?: string) {
  const conditions = dappId ? [eq(alertRules.dappId, dappId)] : [];
  return db
    .select()
    .from(alertRules)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(alertRules.createdAt));
}

export async function getEnabledAlertRules(db: Database) {
  return db
    .select()
    .from(alertRules)
    .where(eq(alertRules.enabled, true));
}

export async function createAlertRule(
  db: Database,
  data: {
    dappId?: string | null;
    metric: string;
    condition: string;
    threshold: string;
    window: string;
    cooldownMinutes?: number;
  },
) {
  const results = await db
    .insert(alertRules)
    .values({
      dappId: data.dappId ?? null,
      metric: data.metric,
      condition: data.condition,
      threshold: data.threshold,
      window: data.window,
      cooldownMinutes: data.cooldownMinutes ?? 15,
    })
    .returning();
  return results[0];
}

export async function deleteAlertRule(db: Database, id: string) {
  return db.delete(alertRules).where(eq(alertRules.id, id));
}

export async function toggleAlertRule(
  db: Database,
  id: string,
  enabled: boolean,
) {
  return db
    .update(alertRules)
    .set({ enabled })
    .where(eq(alertRules.id, id));
}

export async function insertAlertEvent(
  db: Database,
  data: {
    ruleId: string;
    metricValue: string;
    thresholdValue: string;
  },
) {
  const results = await db.insert(alertHistory).values(data).returning();
  return results[0];
}

export async function getAlertHistory(
  db: Database,
  opts: { ruleId?: string; limit?: number } = {},
) {
  const { ruleId, limit = 50 } = opts;
  const conditions = ruleId ? [eq(alertHistory.ruleId, ruleId)] : [];

  return db
    .select()
    .from(alertHistory)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(alertHistory.triggeredAt))
    .limit(limit);
}

export async function getLastAlertForRule(db: Database, ruleId: string) {
  const results = await db
    .select()
    .from(alertHistory)
    .where(eq(alertHistory.ruleId, ruleId))
    .orderBy(desc(alertHistory.triggeredAt))
    .limit(1);
  return results[0] ?? null;
}

export async function resolveAlert(db: Database, alertId: number) {
  return db
    .update(alertHistory)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        eq(alertHistory.id, alertId),
        sql`${alertHistory.resolvedAt} IS NULL`,
      ),
    );
}

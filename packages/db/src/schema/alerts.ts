import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  boolean,
  timestamp,
  bigserial,
  index,
} from "drizzle-orm/pg-core";
import { dapps } from "./dapps";

export const alertRules = pgTable("alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  dappId: uuid("dapp_id").references(() => dapps.id),
  metric: varchar("metric", { length: 50 }).notNull(),
  condition: varchar("condition", { length: 10 }).notNull(),
  threshold: numeric("threshold").notNull(),
  window: varchar("window", { length: 4 }).notNull(),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(15),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const alertHistory = pgTable(
  "alert_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    triggeredAt: timestamp("triggered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metricValue: numeric("metric_value").notNull(),
    thresholdValue: numeric("threshold_value").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_alert_history_rule").on(table.ruleId),
    index("idx_alert_history_triggered").on(table.triggeredAt),
  ],
);

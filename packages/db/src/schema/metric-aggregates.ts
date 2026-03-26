import {
  pgTable,
  bigserial,
  varchar,
  integer,
  numeric,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { dapps } from "./dapps";

export const metricAggregates = pgTable(
  "metric_aggregates",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    dappId: uuid("dapp_id").references(() => dapps.id),
    window: varchar("window", { length: 4 }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    avgGasUsed: numeric("avg_gas_used").notNull(),
    avgGasPrice: numeric("avg_gas_price").notNull(),
    txCount: integer("tx_count").notNull(),
    errorCount: integer("error_count").notNull(),
    errorRate: numeric("error_rate").notNull(),
    avgTxSpeed: numeric("avg_tx_speed").notNull(),
    uniqueAddresses: integer("unique_addresses").notNull(),
    stylusTxCount: integer("stylus_tx_count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("idx_agg_dapp_window_start").on(
      table.dappId,
      table.window,
      table.windowStart,
    ).where(sql`${table.dappId} is not null`),
    uniqueIndex("idx_agg_global_window_start")
      .on(table.window, table.windowStart)
      .where(sql`${table.dappId} is null`),
    index("idx_agg_window_start").on(table.window, table.windowStart),
  ],
);

import {
  pgTable,
  bigserial,
  varchar,
  bigint,
  integer,
  jsonb,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { dapps } from "./dapps";

export const contractEvents = pgTable(
  "contract_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    dappId: uuid("dapp_id")
      .notNull()
      .references(() => dapps.id),
    eventName: varchar("event_name", { length: 255 }).notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    logIndex: integer("log_index").notNull(),
    eventData: jsonb("event_data").$type<Record<string, unknown>>().notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_event_tx_log").on(table.txHash, table.logIndex),
    index("idx_event_dapp_timestamp").on(table.dappId, table.timestamp),
  ],
);

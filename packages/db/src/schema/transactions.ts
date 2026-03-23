import {
  pgTable,
  varchar,
  bigint,
  integer,
  smallint,
  boolean,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { dapps } from "./dapps";

export const transactions = pgTable(
  "transactions",
  {
    txHash: varchar("tx_hash", { length: 66 }).primaryKey(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    dappId: uuid("dapp_id").references(() => dapps.id),
    fromAddress: varchar("from_address", { length: 42 }).notNull(),
    toAddress: varchar("to_address", { length: 42 }),
    gasUsed: bigint("gas_used", { mode: "bigint" }).notNull(),
    gasPrice: bigint("gas_price", { mode: "bigint" }).notNull(),
    status: smallint("status").notNull(),
    txType: smallint("tx_type").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    inputSize: integer("input_size").notNull(),
    isStylus: boolean("is_stylus").notNull().default(false),
    methodId: varchar("method_id", { length: 10 }),
  },
  (table) => [
    index("idx_tx_dapp_timestamp").on(table.dappId, table.timestamp),
    index("idx_tx_block_number").on(table.blockNumber),
    index("idx_tx_timestamp").on(table.timestamp),
    index("idx_tx_is_stylus").on(table.isStylus),
  ],
);

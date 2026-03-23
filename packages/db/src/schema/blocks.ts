import { pgTable, bigint, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const blocks = pgTable("blocks", {
  blockNumber: bigint("block_number", { mode: "number" }).primaryKey(),
  blockHash: varchar("block_hash", { length: 66 }).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  gasUsed: bigint("gas_used", { mode: "bigint" }).notNull(),
  gasLimit: bigint("gas_limit", { mode: "bigint" }).notNull(),
  txCount: integer("tx_count").notNull(),
  baseFee: bigint("base_fee", { mode: "bigint" }),
});

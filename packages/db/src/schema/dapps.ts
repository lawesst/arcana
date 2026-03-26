import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const dapps = pgTable("dapps", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  contractAddresses: jsonb("contract_addresses").$type<string[]>().notNull(),
  abi: jsonb("abi").$type<unknown[]>(),
  chainId: integer("chain_id").notNull().default(42161),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

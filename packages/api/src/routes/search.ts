import type { App } from "../types";
import { getTransactionByHash, getBlockByNumber } from "@arcana/db";
import { sql } from "drizzle-orm";
import { transactions } from "@arcana/db";

export function registerSearchRoutes(app: App) {
  app.get<{
    Querystring: { q: string };
  }>("/api/search", async (req, reply) => {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return reply
        .status(400)
        .send({ success: false, error: "Query must be at least 2 characters" });
    }

    const query = q.trim().toLowerCase();

    // Check if it's a tx hash (0x + 64 hex chars)
    if (/^0x[0-9a-f]{64}$/.test(query)) {
      const tx = await getTransactionByHash(app.db, query);
      if (tx) {
        return {
          success: true,
          data: { type: "transaction", result: tx },
        };
      }
    }

    // Check if it's a block number
    const blockNum = parseInt(query, 10);
    if (!isNaN(blockNum) && blockNum > 0) {
      const block = await getBlockByNumber(app.db, blockNum);
      if (block) {
        return {
          success: true,
          data: { type: "block", result: block },
        };
      }
    }

    // Check if it's an address (0x + 40 hex chars) - search for txs from/to
    if (/^0x[0-9a-f]{40}$/.test(query)) {
      const txs = await app.db
        .select()
        .from(transactions)
        .where(
          sql`lower(${transactions.fromAddress}) = ${query} or lower(${transactions.toAddress}) = ${query}`,
        )
        .orderBy(sql`${transactions.timestamp} desc`)
        .limit(20);

      return {
        success: true,
        data: {
          type: "address",
          result: { address: query, transactions: txs },
        },
      };
    }

    // No match
    return {
      success: true,
      data: { type: "none", result: null },
    };
  });
}

import type { App } from "../types";
import {
  getRecentTransactions,
  getTransactionByHash,
  getStylusTransactionCount,
  getLatestTransactionTimestamp,
} from "@arcana/db";

export function registerTransactionRoutes(app: App) {
  // List recent transactions
  app.get<{
    Querystring: { dappId?: string; limit?: number; offset?: number };
  }>("/api/transactions", async (req) => {
    const { dappId, limit = 50, offset = 0 } = req.query;
    const transactions = await getRecentTransactions(app.db, {
      dappId,
      limit: Math.min(limit, 200),
      offset,
    });

    return {
      success: true,
      data: transactions,
      limit,
      offset,
    };
  });

  // Get transaction by hash
  app.get<{ Params: { hash: string } }>(
    "/api/transactions/:hash",
    async (req, reply) => {
      const tx = await getTransactionByHash(app.db, req.params.hash);
      if (!tx) {
        return reply
          .status(404)
          .send({ success: false, error: "Transaction not found" });
      }
      return { success: true, data: tx };
    },
  );

  // Get Stylus transaction stats
  app.get("/api/transactions/stylus/stats", async () => {
    const anchor = await getLatestTransactionTimestamp(app.db);
    if (!anchor) {
      return {
        success: true,
        data: {
          total: 0,
          last24h: 0,
          last1h: 0,
        },
      };
    }

    const last24h = new Date(anchor.getTime() - 24 * 60 * 60 * 1000);
    const last1h = new Date(anchor.getTime() - 60 * 60 * 1000);

    const [total, last24hCount, last1hCount] = await Promise.all([
      getStylusTransactionCount(app.db),
      getStylusTransactionCount(app.db, last24h),
      getStylusTransactionCount(app.db, last1h),
    ]);

    return {
      success: true,
      data: {
        total,
        last24h: last24hCount,
        last1h: last1hCount,
      },
    };
  });
}

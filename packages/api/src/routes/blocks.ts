import type { App } from "../types";
import { getRecentBlocks, getBlockByNumber, getBlockCount } from "@arcana/db";

export function registerBlockRoutes(app: App) {
  // Get recent blocks
  app.get<{
    Querystring: { limit?: number };
  }>("/api/blocks", async (req) => {
    const limit = Math.min(req.query.limit ?? 20, 100);
    const blocks = await getRecentBlocks(app.db, limit);
    return { success: true, data: blocks };
  });

  // Get block by number
  app.get<{ Params: { number: string } }>(
    "/api/blocks/:number",
    async (req, reply) => {
      const blockNumber = parseInt(req.params.number, 10);
      if (isNaN(blockNumber)) {
        return reply
          .status(400)
          .send({ success: false, error: "Invalid block number" });
      }

      const block = await getBlockByNumber(app.db, blockNumber);
      if (!block) {
        return reply
          .status(404)
          .send({ success: false, error: "Block not found" });
      }
      return { success: true, data: block };
    },
  );

  // Get total indexed block count
  app.get("/api/blocks/stats", async () => {
    const count = await getBlockCount(app.db);
    return { success: true, data: { totalBlocks: count } };
  });
}

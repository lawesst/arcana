import type { App } from "../types";
import {
  getEvents,
  getEventNames,
  getEventCountSince,
  getLatestEventTimestamp,
} from "@arcana/db";

export function registerEventRoutes(app: App) {
  // List events with filters
  app.get<{
    Querystring: {
      dappId?: string;
      eventName?: string;
      txHash?: string;
      limit?: number;
      offset?: number;
    };
  }>("/api/events", async (req) => {
    const { dappId, eventName, txHash, limit = 50, offset = 0 } = req.query;
    const events = await getEvents(app.db, {
      dappId,
      eventName,
      txHash,
      limit: Math.min(limit, 200),
      offset,
    });

    return { success: true, data: events };
  });

  // Get distinct event names with counts
  app.get<{
    Querystring: { dappId?: string };
  }>("/api/events/names", async (req) => {
    const names = await getEventNames(app.db, req.query.dappId);
    return { success: true, data: names };
  });

  // Get event count stats
  app.get("/api/events/stats", async () => {
    const anchor = await getLatestEventTimestamp(app.db);
    if (!anchor) {
      return {
        success: true,
        data: { total: 0, last24h: 0, last1h: 0 },
      };
    }

    const last24h = new Date(anchor.getTime() - 24 * 60 * 60 * 1000);
    const last1h = new Date(anchor.getTime() - 60 * 60 * 1000);

    const [total, last24hCount, last1hCount] = await Promise.all([
      getEventCountSince(app.db, new Date(0)),
      getEventCountSince(app.db, last24h),
      getEventCountSince(app.db, last1h),
    ]);

    return {
      success: true,
      data: { total, last24h: last24hCount, last1h: last1hCount },
    };
  });
}

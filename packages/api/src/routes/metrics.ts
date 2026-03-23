import type { App } from "../types";
import { getMetrics, getLatestAggregate } from "@arcana/db";
import type { TimeRange } from "@arcana/shared";

const RANGE_TO_WINDOW: Record<string, string> = {
  "1h": "5m",
  "6h": "5m",
  "24h": "1h",
  "7d": "1h",
  "30d": "24h",
};

const RANGE_TO_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function registerMetricsRoutes(app: App) {
  // Get metrics for a specific dApp
  app.get<{
    Params: { dappId: string };
    Querystring: { range?: TimeRange };
  }>("/api/dapps/:dappId/metrics", async (req) => {
    const range = req.query.range || "24h";
    const window = RANGE_TO_WINDOW[range] || "1h";
    const since = new Date(Date.now() - (RANGE_TO_MS[range] || RANGE_TO_MS["24h"]));

    const metrics = await getMetrics(app.db, {
      dappId: req.params.dappId,
      window,
      since,
    });

    return { success: true, data: metrics };
  });

  // Get global network metrics
  app.get<{
    Querystring: { range?: TimeRange };
  }>("/api/metrics/global", async (req) => {
    const range = req.query.range || "24h";
    const window = RANGE_TO_WINDOW[range] || "1h";
    const since = new Date(Date.now() - (RANGE_TO_MS[range] || RANGE_TO_MS["24h"]));

    const metrics = await getMetrics(app.db, {
      dappId: null,
      window,
      since,
    });

    return { success: true, data: metrics };
  });

  // Get latest snapshot (single most recent aggregate)
  app.get<{
    Querystring: { dappId?: string };
  }>("/api/metrics/latest", async (req) => {
    const dappId = req.query.dappId ?? null;
    const aggregate = await getLatestAggregate(app.db, {
      dappId,
      window: "5m",
    });

    return { success: true, data: aggregate };
  });
}

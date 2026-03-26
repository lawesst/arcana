import type { App } from "../types";
import {
  getLatestTransactionTimestamp,
  getMetricsFromTransactions,
} from "@arcana/db";
import { WINDOW_DURATION_MS, type TimeRange } from "@arcana/shared";
import { getAnchoredSince, resolveRange } from "../range-anchor";

export function registerMetricsRoutes(app: App) {
  // Get metrics for a specific dApp
  app.get<{
    Params: { dappId: string };
    Querystring: { range?: TimeRange };
  }>("/api/dapps/:dappId/metrics", async (req) => {
    const range = req.query.range || "24h";
    const { rangeMs, window } = resolveRange(range);
    const latest = await getLatestTransactionTimestamp(
      app.db,
      req.params.dappId,
    );

    if (!latest) {
      return { success: true, data: [] };
    }

    const anchor = floorToWindow(latest, WINDOW_DURATION_MS[window]);
    const since = getAnchoredSince(
      anchor,
      rangeMs,
      WINDOW_DURATION_MS[window],
    );

    const metrics = await getMetricsFromTransactions(app.db, {
      dappId: req.params.dappId,
      window,
      since,
      until: latest,
    });

    return {
      success: true,
      data: fillMetricBuckets(metrics, {
        dappId: req.params.dappId,
        window,
        since,
        until: anchor,
      }),
    };
  });

  // Get global network metrics
  app.get<{
    Querystring: { range?: TimeRange };
  }>("/api/metrics/global", async (req) => {
    const range = req.query.range || "24h";
    const { rangeMs, window } = resolveRange(range);
    const latest = await getLatestTransactionTimestamp(app.db);

    if (!latest) {
      return { success: true, data: [] };
    }

    const anchor = floorToWindow(latest, WINDOW_DURATION_MS[window]);
    const since = getAnchoredSince(
      anchor,
      rangeMs,
      WINDOW_DURATION_MS[window],
    );

    const metrics = await getMetricsFromTransactions(app.db, {
      window,
      since,
      until: latest,
    });

    return {
      success: true,
      data: fillMetricBuckets(metrics, {
        dappId: null,
        window,
        since,
        until: anchor,
      }),
    };
  });

  // Get latest snapshot (single most recent aggregate)
  app.get<{
    Querystring: { dappId?: string };
  }>("/api/metrics/latest", async (req) => {
    const dappId = req.query.dappId;
    const latest = await getLatestTransactionTimestamp(app.db, dappId);

    if (!latest) {
      return { success: true, data: null };
    }

    const window = "5m";
    const windowStart = floorToWindow(latest, WINDOW_DURATION_MS[window]);
    const aggregates = await getMetricsFromTransactions(app.db, {
      dappId,
      window,
      since: windowStart,
      until: latest,
    });
    const aggregate = aggregates[0]
      ? normalizeMetricRow(aggregates[0], dappId ?? null, window)
      : null;

    return { success: true, data: aggregate };
  });
}

function floorToWindow(date: Date, windowMs: number) {
  return new Date(Math.floor(date.getTime() / windowMs) * windowMs);
}

function fillMetricBuckets(
  rows: Array<{
    windowStart: string;
    avgGasUsed: string;
    avgGasPrice: string;
    txCount: number;
    errorCount: number;
    errorRate: string;
    avgTxSpeed: string;
    uniqueAddresses: number;
    stylusTxCount: number;
  }>,
  opts: {
    dappId: string | null;
    window: keyof typeof WINDOW_DURATION_MS;
    since: Date;
    until: Date;
  },
) {
  const windowMs = WINDOW_DURATION_MS[opts.window];
  const existing = new Map(
    rows.map((row) => [
      new Date(row.windowStart).toISOString(),
      normalizeMetricRow(row, opts.dappId, opts.window),
    ]),
  );
  const filled = [];

  for (
    let cursor = new Date(opts.since);
    cursor.getTime() <= opts.until.getTime();
    cursor = new Date(cursor.getTime() + windowMs)
  ) {
    const key = cursor.toISOString();
    filled.push(
      existing.get(key) ??
        createEmptyMetricRow(opts.dappId, opts.window, cursor),
    );
  }

  return filled;
}

function normalizeMetricRow(
  row: {
    windowStart: string;
    avgGasUsed: string;
    avgGasPrice: string;
    txCount: number;
    errorCount: number;
    errorRate: string;
    avgTxSpeed: string;
    uniqueAddresses: number;
    stylusTxCount: number;
  },
  dappId: string | null,
  window: keyof typeof WINDOW_DURATION_MS,
) {
  return {
    id: 0,
    dappId,
    window,
    windowStart: new Date(row.windowStart),
    avgGasUsed: row.avgGasUsed,
    avgGasPrice: row.avgGasPrice,
    txCount: Number(row.txCount),
    errorCount: Number(row.errorCount),
    errorRate: row.errorRate,
    avgTxSpeed: row.avgTxSpeed,
    uniqueAddresses: Number(row.uniqueAddresses),
    stylusTxCount: Number(row.stylusTxCount),
  };
}

function createEmptyMetricRow(
  dappId: string | null,
  window: keyof typeof WINDOW_DURATION_MS,
  windowStart: Date,
) {
  return {
    id: 0,
    dappId,
    window,
    windowStart,
    avgGasUsed: "0",
    avgGasPrice: "0",
    txCount: 0,
    errorCount: 0,
    errorRate: "0",
    avgTxSpeed: "0",
    uniqueAddresses: 0,
    stylusTxCount: 0,
  };
}

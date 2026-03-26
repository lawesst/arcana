import type { App } from "../types";
import {
  getGasComparison,
  getGasComparisonTimeSeries,
  getTopStylusContracts,
  getStylusAdoptionStats,
  getLatestTransactionTimestamp,
} from "@arcana/db";
import { getAnchoredSince, resolveRange } from "../range-anchor";

export function registerStylusRoutes(app: App) {
  // Gas comparison: Stylus vs EVM
  app.get<{
    Querystring: { range?: string };
  }>("/api/stylus/gas-comparison", async (req) => {
    const range = req.query.range || "24h";
    const anchor = await getLatestTransactionTimestamp(app.db);
    if (!anchor) {
      return {
        success: true,
        data: {
          stylusAvgGas: 0,
          evmAvgGas: 0,
          stylusTotalGas: "0",
          evmTotalGas: "0",
          stylusCount: 0,
          evmCount: 0,
          stylusAvgGasPrice: 0,
          evmAvgGasPrice: 0,
          gasSavingsPercent: "0",
        },
      };
    }

    const { rangeMs } = resolveRange(range);
    const since = getAnchoredSince(anchor, rangeMs);

    const comparison = await getGasComparison(app.db, since);

    return {
      success: true,
      data: {
        stylusAvgGas: parseFloat(comparison.stylusAvgGas),
        evmAvgGas: parseFloat(comparison.evmAvgGas),
        stylusTotalGas: comparison.stylusTotalGas,
        evmTotalGas: comparison.evmTotalGas,
        stylusCount: comparison.stylusCount,
        evmCount: comparison.evmCount,
        stylusAvgGasPrice: parseFloat(comparison.stylusAvgGasPrice),
        evmAvgGasPrice: parseFloat(comparison.evmAvgGasPrice),
        gasSavingsPercent:
          parseFloat(comparison.evmAvgGas) > 0
            ? (
                ((parseFloat(comparison.evmAvgGas) - parseFloat(comparison.stylusAvgGas)) /
                  parseFloat(comparison.evmAvgGas)) *
                100
              ).toFixed(2)
            : "0",
      },
    };
  });

  // Gas comparison time series for charts
  app.get<{
    Querystring: { range?: string };
  }>("/api/stylus/gas-comparison/timeseries", async (req) => {
    const range = req.query.range || "24h";
    const anchor = await getLatestTransactionTimestamp(app.db);
    if (!anchor) {
      return { success: true, data: [] };
    }

    const { rangeMs, bucketMinutes } = resolveRange(range);
    const bucketMs = bucketMinutes * 60 * 1000;
    const bucketStart = floorToBucket(anchor, bucketMs);
    const since = getAnchoredSince(bucketStart, rangeMs, bucketMs);

    const series = await getGasComparisonTimeSeries(app.db, {
      since,
      bucketMinutes,
    });

    return {
      success: true,
      data: fillGasComparisonSeries(
        series.map((row) => ({
          time: row.bucket,
          stylusAvgGas: parseFloat(row.stylus_avg_gas),
          evmAvgGas: parseFloat(row.evm_avg_gas),
          stylusCount: parseInt(row.stylus_count),
          evmCount: parseInt(row.evm_count),
        })),
        {
          since,
          until: bucketStart,
          bucketMs,
        },
      ),
    };
  });

  // Top Stylus contracts
  app.get<{
    Querystring: { range?: string; limit?: number };
  }>("/api/stylus/contracts", async (req) => {
    const range = req.query.range || "24h";
    const anchor = await getLatestTransactionTimestamp(app.db);
    if (!anchor) {
      return { success: true, data: [] };
    }

    const { rangeMs } = resolveRange(range);
    const since = getAnchoredSince(anchor, rangeMs);

    const contracts = await getTopStylusContracts(app.db, {
      since,
      limit: Math.min(req.query.limit ?? 20, 100),
    });

    return { success: true, data: contracts };
  });

  // Stylus adoption overview stats
  app.get<{
    Querystring: { range?: string };
  }>("/api/stylus/adoption", async (req) => {
    const range = req.query.range || "24h";
    const anchor = await getLatestTransactionTimestamp(app.db);
    if (!anchor) {
      return {
        success: true,
        data: {
          totalTxs: 0,
          stylusTxs: 0,
          evmTxs: 0,
          stylusRatio: "0",
          stylusContracts: 0,
          evmContracts: 0,
          stylusErrorRate: "0.00",
          evmErrorRate: "0.00",
        },
      };
    }

    const { rangeMs } = resolveRange(range);
    const since = getAnchoredSince(anchor, rangeMs);

    const stats = await getStylusAdoptionStats(app.db, since);

    return {
      success: true,
      data: {
        totalTxs: stats.totalTxs,
        stylusTxs: stats.stylusTxs,
        evmTxs: stats.evmTxs,
        stylusRatio:
          stats.totalTxs > 0
            ? ((stats.stylusTxs / stats.totalTxs) * 100).toFixed(2)
            : "0",
        stylusContracts: stats.stylusContracts,
        evmContracts: stats.evmContracts,
        stylusErrorRate: (parseFloat(stats.stylusErrorRate) * 100).toFixed(2),
        evmErrorRate: (parseFloat(stats.evmErrorRate) * 100).toFixed(2),
      },
    };
  });
}

function floorToBucket(date: Date, bucketMs: number) {
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);
}

function fillGasComparisonSeries(
  rows: Array<{
    time: string;
    stylusAvgGas: number;
    evmAvgGas: number;
    stylusCount: number;
    evmCount: number;
  }>,
  opts: {
    since: Date;
    until: Date;
    bucketMs: number;
  },
) {
  const existing = new Map(
    rows.map((row) => [new Date(row.time).toISOString(), row]),
  );
  const filled = [];

  for (
    let cursor = new Date(opts.since);
    cursor.getTime() <= opts.until.getTime();
    cursor = new Date(cursor.getTime() + opts.bucketMs)
  ) {
    const key = cursor.toISOString();
    filled.push(
      existing.get(key) ?? {
        time: cursor.toISOString(),
        stylusAvgGas: 0,
        evmAvgGas: 0,
        stylusCount: 0,
        evmCount: 0,
      },
    );
  }

  return filled;
}

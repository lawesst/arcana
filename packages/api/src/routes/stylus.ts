import type { App } from "../types";
import {
  getGasComparison,
  getGasComparisonTimeSeries,
  getTopStylusContracts,
  getStylusAdoptionStats,
} from "@arcana/db";

const RANGE_TO_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const RANGE_TO_BUCKET: Record<string, number> = {
  "1h": 5,
  "6h": 15,
  "24h": 60,
  "7d": 360,
  "30d": 1440,
};

export function registerStylusRoutes(app: App) {
  // Gas comparison: Stylus vs EVM
  app.get<{
    Querystring: { range?: string };
  }>("/api/stylus/gas-comparison", async (req) => {
    const range = req.query.range || "24h";
    const since = new Date(Date.now() - (RANGE_TO_MS[range] || RANGE_TO_MS["24h"]));

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
    const since = new Date(Date.now() - (RANGE_TO_MS[range] || RANGE_TO_MS["24h"]));
    const bucketMinutes = RANGE_TO_BUCKET[range] || 60;

    const series = await getGasComparisonTimeSeries(app.db, {
      since,
      bucketMinutes,
    });

    return {
      success: true,
      data: series.map((row) => ({
        time: row.bucket,
        stylusAvgGas: parseFloat(row.stylus_avg_gas),
        evmAvgGas: parseFloat(row.evm_avg_gas),
        stylusCount: parseInt(row.stylus_count),
        evmCount: parseInt(row.evm_count),
      })),
    };
  });

  // Top Stylus contracts
  app.get<{
    Querystring: { range?: string; limit?: number };
  }>("/api/stylus/contracts", async (req) => {
    const range = req.query.range || "24h";
    const since = new Date(Date.now() - (RANGE_TO_MS[range] || RANGE_TO_MS["24h"]));

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
    const since = new Date(Date.now() - (RANGE_TO_MS[range] || RANGE_TO_MS["24h"]));

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

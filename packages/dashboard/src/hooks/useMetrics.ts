"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchGlobalMetrics, fetchLatestMetrics } from "@/lib/api";

export function useMetrics(range = "24h") {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [latest, setLatest] = useState<LatestMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [metricsRes, latestRes] = await Promise.all([
        fetchGlobalMetrics(range),
        fetchLatestMetrics(),
      ]);

      setMetrics(
        metricsRes.data.map((m) => ({
          time: new Date(m.windowStart).toLocaleTimeString(),
          windowStart: m.windowStart,
          gasUsed: parseFloat(m.avgGasUsed),
          gasPrice: parseFloat(m.avgGasPrice),
          txCount: m.txCount,
          errorRate: parseFloat(m.errorRate) * 100,
          uniqueAddresses: m.uniqueAddresses,
          stylusTxCount: m.stylusTxCount,
        })),
      );

      if (latestRes.data) {
        setLatest({
          txCount: latestRes.data.txCount,
          avgGasUsed: parseFloat(latestRes.data.avgGasUsed),
          avgGasPrice: parseFloat(latestRes.data.avgGasPrice),
          errorRate: parseFloat(latestRes.data.errorRate) * 100,
          uniqueAddresses: latestRes.data.uniqueAddresses,
          stylusTxCount: latestRes.data.stylusTxCount,
        });
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [load]);

  return { metrics, latest, loading, error, refresh: load };
}

interface MetricData {
  time: string;
  windowStart: string;
  gasUsed: number;
  gasPrice: number;
  txCount: number;
  errorRate: number;
  uniqueAddresses: number;
  stylusTxCount: number;
}

interface LatestMetrics {
  txCount: number;
  avgGasUsed: number;
  avgGasPrice: number;
  errorRate: number;
  uniqueAddresses: number;
  stylusTxCount: number;
}

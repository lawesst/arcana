"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchGlobalMetrics, fetchLatestMetrics } from "@/lib/api";

export function useMetrics(range = "24h") {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [latest, setLatest] = useState<LatestMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsRes, latestRes] = await Promise.all([
        fetchGlobalMetrics(range),
        fetchLatestMetrics(),
      ]);

      setMetrics(
        metricsRes.data
          .slice()
          .sort(
            (a, b) =>
              new Date(a.windowStart).getTime() -
              new Date(b.windowStart).getTime(),
          )
          .map((m) => ({
            time: utcTimeFormatter.format(new Date(m.windowStart)),
            windowStart: m.windowStart,
            gasUsed: toFiniteNumber(m.avgGasUsed),
            gasPrice: toFiniteNumber(m.avgGasPrice),
            txCount: m.txCount,
            errorRate: toFiniteNumber(m.errorRate) * 100,
            avgTxSpeed: toFiniteNumber(m.avgTxSpeed),
            uniqueAddresses: m.uniqueAddresses,
            stylusTxCount: m.stylusTxCount,
          })),
      );

      if (latestRes.data) {
        setLatest({
          txCount: latestRes.data.txCount,
          avgGasUsed: toFiniteNumber(latestRes.data.avgGasUsed),
          avgGasPrice: toFiniteNumber(latestRes.data.avgGasPrice),
          errorRate: toFiniteNumber(latestRes.data.errorRate) * 100,
          uniqueAddresses: latestRes.data.uniqueAddresses,
          stylusTxCount: latestRes.data.stylusTxCount,
        });
      } else {
        setLatest(null);
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
  avgTxSpeed: number;
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

const utcTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function toFiniteNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

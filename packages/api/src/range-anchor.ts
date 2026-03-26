import { WINDOW_DURATION_MS } from "@arcana/shared";

export const RANGE_TO_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export const RANGE_TO_WINDOW: Record<string, keyof typeof WINDOW_DURATION_MS> = {
  "1h": "5m",
  "6h": "5m",
  "24h": "1h",
  "7d": "1h",
  "30d": "24h",
};

export const RANGE_TO_BUCKET: Record<string, number> = {
  "1h": 5,
  "6h": 15,
  "24h": 60,
  "7d": 360,
  "30d": 1440,
};

export function resolveRange(range = "24h") {
  return {
    rangeMs: RANGE_TO_MS[range] || RANGE_TO_MS["24h"],
    window: RANGE_TO_WINDOW[range] || RANGE_TO_WINDOW["24h"],
    bucketMinutes: RANGE_TO_BUCKET[range] || RANGE_TO_BUCKET["24h"],
  };
}

export function getAnchoredSince(
  anchor: Date,
  rangeMs: number,
  pointWindowMs = 0,
) {
  return new Date(anchor.getTime() - rangeMs + pointWindowMs);
}

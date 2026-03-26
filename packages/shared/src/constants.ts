import type { ChainId } from "./types";

/** Stylus contract bytecode prefix (EOF-inspired) */
export const STYLUS_BYTECODE_PREFIX = "0xeff00000";

/** Default RPC URLs per chain */
export const DEFAULT_RPC_URLS: Record<ChainId, string> = {
  42161: "https://arb1.arbitrum.io/rpc",
  421614: "https://sepolia-rollup.arbitrum.io/rpc",
};

/** Chain names */
export const CHAIN_NAMES: Record<ChainId, string> = {
  42161: "Arbitrum One",
  421614: "Arbitrum Sepolia",
};

/** Block explorer URLs */
export const EXPLORER_URLS: Record<ChainId, string> = {
  42161: "https://arbiscan.io",
  421614: "https://sepolia.arbiscan.io",
};

/** Aggregate window durations in milliseconds */
export const WINDOW_DURATION_MS: Record<string, number> = {
  "5m": 5 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

/** Redis pub/sub channels */
export const REDIS_CHANNELS = {
  METRICS: "arcana:metrics",
  BLOCKS: "arcana:blocks",
  TRANSACTIONS: "arcana:transactions",
  ALERTS: "arcana:alerts",
} as const;

/** Internal Redis channels for service coordination */
export const INTERNAL_REDIS_CHANNELS = {
  DAPPS: "arcana:internal:dapps",
} as const;

/** Default collector settings */
export const COLLECTOR_DEFAULTS = {
  POLL_INTERVAL_MS: 1000,
  BATCH_SIZE: 100,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
} as const;

/** API defaults */
export const API_DEFAULTS = {
  PORT: 3001,
  HOST: "0.0.0.0",
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200,
} as const;

import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// Load .env from monorepo root (two levels up from packages/shared)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

/** Shared environment schema validated with zod */
export const envSchema = z.object({
  // Arbitrum
  ARBITRUM_RPC_URL: z.string().url().default("https://arb1.arbitrum.io/rpc"),
  ARBITRUM_CHAIN_ID: z.coerce.number().default(42161),

  // Database
  DATABASE_URL: z
    .string()
    .default("postgresql://arcana:arcana_dev@localhost:5432/arcana"),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // API
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default("0.0.0.0"),

  // Collector
  COLLECTOR_POLL_INTERVAL_MS: z.coerce.number().default(1000),
  COLLECTOR_BATCH_SIZE: z.coerce.number().default(100),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnv(): EnvConfig {
  return envSchema.parse(process.env);
}

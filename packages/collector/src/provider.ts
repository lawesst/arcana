import { ethers } from "ethers";
import { sleep } from "@arcana/shared";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export function createProvider(rpcUrl: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpcUrl, undefined, {
    staticNetwork: true,
    batchMaxCount: 10,
  });
}

/**
 * Retry wrapper for RPC calls with exponential backoff.
 * Handles 429 rate limits and transient network errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label = "rpc",
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      const message = err instanceof Error ? err.message : String(err);

      // Rate limited or server error — retry
      if (
        message.includes("429") ||
        message.includes("TIMEOUT") ||
        message.includes("SERVER_ERROR")
      ) {
        console.warn(
          `[${label}] Attempt ${attempt + 1}/${MAX_RETRIES} failed: ${message}. Retrying in ${delay}ms...`,
        );
        await sleep(delay);
        continue;
      }

      // Non-retryable error
      throw err;
    }
  }
  throw lastError;
}

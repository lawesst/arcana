import { STYLUS_BYTECODE_PREFIX, EXPLORER_URLS } from "./constants";
import type { ChainId } from "./types";

/** Check if bytecode belongs to a Stylus (WASM) contract */
export function isStylusBytecode(bytecode: string): boolean {
  return bytecode.toLowerCase().startsWith(STYLUS_BYTECODE_PREFIX);
}

/** Truncate an Ethereum address for display: 0x1234...abcd */
export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/** Format gas value to human-readable string */
export function formatGas(gas: bigint): string {
  const gwei = Number(gas) / 1e9;
  if (gwei >= 1) return `${gwei.toFixed(2)} Gwei`;
  return `${Number(gas)} wei`;
}

/** Build block explorer URL for a tx/address/block */
export function explorerUrl(
  chainId: ChainId,
  type: "tx" | "address" | "block",
  value: string | number,
): string {
  const base = EXPLORER_URLS[chainId];
  return `${base}/${type}/${value}`;
}

/** Convert BigInt to JSON-safe string for serialization */
export function bigintSerializer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

/** Parse a hex string to number */
export function hexToNumber(hex: string): number {
  return parseInt(hex, 16);
}

/** Safe division — returns 0 if divisor is 0 */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/** Get the method selector (first 4 bytes) from calldata */
export function getMethodId(input: string): string | null {
  if (!input || input === "0x" || input.length < 10) return null;
  return input.slice(0, 10);
}

/** Sleep utility */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

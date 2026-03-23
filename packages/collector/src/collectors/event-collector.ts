import { ethers } from "ethers";
import type { Database } from "@arcana/db";
import { insertEventsBatch, getDappByAddress } from "@arcana/db";
import { withRetry } from "../provider";
import type { CollectedBlock } from "./block-collector";

// Common event signatures (topic0) for well-known events
const KNOWN_EVENTS: Record<string, string> = {
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": "Transfer",
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925": "Approval",
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822": "Swap",
  "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1": "Sync",
  "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb": "TransferBatch",
  "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62": "TransferSingle",
  "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31": "ApprovalForAll",
  "0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c": "Deposit",
  "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65": "Withdrawal",
};

// Cache: address -> dappId
const dappCache = new Map<string, string | null>();

export class EventCollector {
  constructor(
    private provider: ethers.JsonRpcProvider,
    private db: Database,
  ) {}

  /** Process events from a block's transactions */
  async processBlock(block: CollectedBlock): Promise<number> {
    if (block.prefetchedTransactions.length === 0) return 0;

    const allEvents: Array<{
      dappId: string;
      eventName: string;
      txHash: string;
      blockNumber: number;
      logIndex: number;
      eventData: Record<string, unknown>;
      timestamp: Date;
    }> = [];

    for (const tx of block.prefetchedTransactions) {
      if (!tx.to) continue; // Skip contract creation

      // Check if this tx is to a monitored dApp
      const dappId = await this.matchDapp(tx.to);
      if (!dappId) continue; // Only decode events for monitored dApps

      const receipt = await withRetry(
        () => this.provider.getTransactionReceipt(tx.hash),
        `getReceipt(${tx.hash})`,
      );

      if (!receipt || receipt.logs.length === 0) continue;

      for (const log of receipt.logs) {
        const eventName = this.decodeEventName(log);
        const eventData = this.decodeLogData(log);

        allEvents.push({
          dappId,
          eventName,
          txHash: tx.hash,
          blockNumber: block.number,
          logIndex: log.index,
          eventData,
          timestamp: new Date(block.timestamp * 1000),
        });
      }
    }

    if (allEvents.length > 0) {
      await insertEventsBatch(this.db, allEvents);
    }

    return allEvents.length;
  }

  /** Decode event name from topic0 */
  private decodeEventName(log: ethers.Log): string {
    if (log.topics.length === 0) return "Unknown";
    const topic0 = log.topics[0];
    return KNOWN_EVENTS[topic0] ?? `Event(${topic0.slice(0, 10)})`;
  }

  /** Decode log data into a structured object */
  private decodeLogData(log: ethers.Log): Record<string, unknown> {
    const data: Record<string, unknown> = {
      address: log.address,
      topics: log.topics,
      data: log.data,
    };

    // For known Transfer events, decode the indexed params
    if (
      log.topics.length >= 3 &&
      log.topics[0] ===
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    ) {
      try {
        data.from = ethers.getAddress("0x" + log.topics[1].slice(26));
        data.to = ethers.getAddress("0x" + log.topics[2].slice(26));
        if (log.data !== "0x" && log.data.length >= 66) {
          data.value = BigInt(log.data).toString();
        }
      } catch {
        // Fallback if decoding fails
      }
    }

    // For Approval events
    if (
      log.topics.length >= 3 &&
      log.topics[0] ===
        "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"
    ) {
      try {
        data.owner = ethers.getAddress("0x" + log.topics[1].slice(26));
        data.spender = ethers.getAddress("0x" + log.topics[2].slice(26));
        if (log.data !== "0x" && log.data.length >= 66) {
          data.value = BigInt(log.data).toString();
        }
      } catch {
        // Fallback
      }
    }

    return data;
  }

  /** Match contract address to a registered dApp */
  private async matchDapp(address: string): Promise<string | null> {
    const lower = address.toLowerCase();
    if (dappCache.has(lower)) return dappCache.get(lower)!;

    const dapp = await getDappByAddress(this.db, address);
    const id = dapp?.id ?? null;
    dappCache.set(lower, id);
    return id;
  }

  /** Clear dApp cache when dApps change */
  clearDappCache() {
    dappCache.clear();
  }
}

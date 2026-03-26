import { ethers } from "ethers";
import type { Database } from "@arcana/db";
import { insertEventsBatch, getDappByAddress } from "@arcana/db";
import { withRetry } from "../provider";
import type { CollectedBlock } from "./block-collector";
import { decodeEventName, decodeLogData } from "./event-utils";

// Cache: address -> matched dApp id for known monitored contracts
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
      const receipt = await withRetry(
        () => this.provider.getTransactionReceipt(tx.hash),
        `getReceipt(${tx.hash})`,
      );

      if (!receipt || receipt.logs.length === 0) continue;

      for (const log of receipt.logs) {
        const dappId = await this.matchDapp(log.address);
        if (!dappId) continue;

        const eventName = decodeEventName(log);
        const eventData = decodeLogData(log);

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

  /** Match contract address to a registered dApp */
  private async matchDapp(address: string): Promise<string | null> {
    const lower = address.toLowerCase();
    if (dappCache.has(lower)) return dappCache.get(lower)!;

    const dapp = await getDappByAddress(this.db, address);
    const dappId = dapp?.id ?? null;
    dappCache.set(lower, dappId);
    return dappId;
  }

  /** Clear dApp cache when dApps change */
  clearDappCache() {
    dappCache.clear();
  }
}

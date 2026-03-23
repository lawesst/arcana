import type { ethers } from "ethers";
import type { Database } from "@arcana/db";
import { insertTransactionsBatch, getDappByAddress } from "@arcana/db";
import { isStylusBytecode, getMethodId } from "@arcana/shared";
import { withRetry } from "../provider";
import type { CollectedBlock } from "./block-collector";

// Cache: address -> isStylus. Avoids repeated eth_getCode calls.
const stylusCache = new Map<string, boolean>();

// Cache: address -> dappId
const dappCache = new Map<string, string | null>();

export class TxCollector {
  constructor(
    private provider: ethers.JsonRpcProvider,
    private db: Database,
  ) {}

  /** Process all transactions in a collected block, returns processed tx summaries */
  async processBlock(block: CollectedBlock): Promise<ProcessedTx[]> {
    if (block.prefetchedTransactions.length === 0) return [];

    const txRows = [];

    for (const tx of block.prefetchedTransactions) {
      // Get receipt for gas used and status
      const receipt = await withRetry(
        () => this.provider.getTransactionReceipt(tx.hash),
        `getReceipt(${tx.hash})`,
      );

      if (!receipt) continue;

      // Check if target contract is a Stylus contract
      const isStylus = tx.to ? await this.checkStylus(tx.to) : false;

      // Match to a monitored dApp
      const dappId = tx.to ? await this.matchDapp(tx.to) : null;

      txRows.push({
        txHash: tx.hash,
        blockNumber: block.number,
        dappId,
        fromAddress: tx.from,
        toAddress: tx.to,
        gasUsed: receipt.gasUsed,
        gasPrice: receipt.gasPrice ?? tx.gasPrice ?? 0n,
        status: receipt.status ?? 0,
        txType: tx.type ?? 0,
        timestamp: new Date(block.timestamp * 1000),
        inputSize: tx.data ? Math.floor((tx.data.length - 2) / 2) : 0,
        isStylus,
        methodId: getMethodId(tx.data),
      });
    }

    if (txRows.length > 0) {
      await insertTransactionsBatch(this.db, txRows);
    }

    return txRows.map((tx) => ({
      txHash: tx.txHash,
      isStylus: tx.isStylus,
      dappId: tx.dappId,
      gasUsed: tx.gasUsed.toString(),
      status: tx.status,
    }));
  }

  /** Check if a contract address is a Stylus (WASM) contract */
  private async checkStylus(address: string): Promise<boolean> {
    const lower = address.toLowerCase();
    if (stylusCache.has(lower)) return stylusCache.get(lower)!;

    try {
      const code = await withRetry(
        () => this.provider.getCode(address),
        `getCode(${address})`,
      );
      const isStylus = isStylusBytecode(code);
      stylusCache.set(lower, isStylus);
      return isStylus;
    } catch {
      return false;
    }
  }

  /** Match a contract address to a registered dApp */
  private async matchDapp(address: string): Promise<string | null> {
    const lower = address.toLowerCase();
    if (dappCache.has(lower)) return dappCache.get(lower)!;

    const dapp = await getDappByAddress(this.db, address);
    const id = dapp?.id ?? null;
    dappCache.set(lower, id);
    return id;
  }

  /** Clear caches (call when dApps are added/removed) */
  clearDappCache() {
    dappCache.clear();
  }
}

export interface ProcessedTx {
  txHash: string;
  isStylus: boolean;
  dappId: string | null;
  gasUsed: string;
  status: number;
}

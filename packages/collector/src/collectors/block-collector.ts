import type { ethers } from "ethers";
import type { Database } from "@arcana/db";
import { insertBlock, getLatestBlock } from "@arcana/db";
import { withRetry } from "../provider";

export class BlockCollector {
  constructor(
    private provider: ethers.JsonRpcProvider,
    private db: Database,
  ) {}

  /** Get the block number to start collecting from */
  async getStartBlock(): Promise<number> {
    const latest = await getLatestBlock(this.db);
    if (latest) return latest.blockNumber + 1;

    // Default: start from the current block
    const currentBlock = await withRetry(
      () => this.provider.getBlockNumber(),
      "getBlockNumber",
    );
    return currentBlock;
  }

  /** Collect a range of blocks and return their data */
  async collectBlockRange(
    fromBlock: number,
    toBlock: number,
  ): Promise<CollectedBlock[]> {
    const blocks: CollectedBlock[] = [];

    // Fetch blocks in parallel (batches of 10)
    const batchSize = 10;
    for (let i = fromBlock; i <= toBlock; i += batchSize) {
      const end = Math.min(i + batchSize - 1, toBlock);
      const promises = [];

      for (let blockNum = i; blockNum <= end; blockNum++) {
        promises.push(this.fetchBlock(blockNum));
      }

      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          blocks.push(result.value);
        }
      }
    }

    return blocks;
  }

  /** Fetch and parse a single block */
  private async fetchBlock(blockNumber: number): Promise<CollectedBlock | null> {
    const block = await withRetry(
      () => this.provider.getBlock(blockNumber, true),
      `getBlock(${blockNumber})`,
    );

    if (!block) return null;

    // Store block in DB
    await insertBlock(this.db, {
      blockNumber: block.number,
      blockHash: block.hash!,
      timestamp: new Date(block.timestamp * 1000),
      gasUsed: block.gasUsed,
      gasLimit: block.gasLimit,
      txCount: block.transactions.length,
      baseFee: block.baseFeePerGas ?? null,
    });

    return {
      number: block.number,
      hash: block.hash!,
      timestamp: block.timestamp,
      gasUsed: block.gasUsed,
      gasLimit: block.gasLimit,
      baseFee: block.baseFeePerGas ?? null,
      transactionHashes: block.transactions as string[],
      prefetchedTransactions: block.prefetchedTransactions,
    };
  }
}

export interface CollectedBlock {
  number: number;
  hash: string;
  timestamp: number;
  gasUsed: bigint;
  gasLimit: bigint;
  baseFee: bigint | null;
  transactionHashes: string[];
  prefetchedTransactions: ethers.TransactionResponse[];
}

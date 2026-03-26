import { ethers } from "ethers";
import type Redis from "ioredis";
import type { Database } from "@arcana/db";
import {
  getDappByAddress,
  insertEventsBatch,
  insertTransactionsBatch,
} from "@arcana/db";
import {
  getMethodId,
  isStylusBytecode,
  type BackfillState,
  type BackfillStatus,
} from "@arcana/shared";
import { withRetry } from "../provider";
import { decodeEventName, decodeLogData } from "./event-utils";
import {
  readBackfillStatus,
  writeBackfillStatus,
} from "../backfill-status-store";

const SPLIT_ERROR_PATTERNS = [
  "block range",
  "exceed",
  "limit",
  "more than",
  "query returned",
  "response size",
  "too many",
];
const BACKFILL_CONCURRENCY = 2;
const BACKFILL_TX_FETCH_CONCURRENCY = 8;
const STYLUS_MAINNET_LAUNCH = new Date("2024-09-03T00:00:00Z");

export interface MonitoredDapp {
  id: string;
  name: string;
  contractAddresses: string[];
}

export class DappBackfiller {
  private stylusCache = new Map<string, boolean>();
  private dappCache = new Map<string, string | null>();
  private blockTimestampCache = new Map<number, Date>();
  private stylusLaunchBlock: number | null = null;

  constructor(
    private provider: ethers.JsonRpcProvider,
    private db: Database,
    private redis: Redis,
  ) {}

  async backfillMissingDapps(dapps: MonitoredDapp[]) {
    const queue = [...dapps];
    const workers = Array.from(
      { length: Math.min(BACKFILL_CONCURRENCY, queue.length) },
      () => this.runBackfillWorker(queue),
    );
    await Promise.all(workers);
  }

  private async runBackfillWorker(queue: MonitoredDapp[]) {
    while (queue.length > 0) {
      const dapp = queue.shift();
      if (!dapp) return;

      try {
        await this.backfillDappIfMissing(dapp);
      } catch (error) {
        await this.markFailed(dapp.id, error);
        console.error(
          `[arcana:collector] Failed to backfill ${dapp.name}:`,
          error,
        );
      }
    }
  }

  async backfillDappIfMissing(dapp: MonitoredDapp) {
    const existingStatus = await readBackfillStatus(this.redis, dapp.id);

    if (existingStatus?.state === "completed") {
      return;
    }

    await this.backfillDapp(dapp);
  }

  async backfillDapp(dapp: MonitoredDapp) {
    const status = await this.createInitialStatus(dapp.id);
    await this.updateStatus(status, {
      state: "scanning",
      message: "Scanning historical logs",
      totalTransactions: null,
      processedTransactions: 0,
      indexedTransactions: 0,
      indexedEvents: 0,
      finishedAt: null,
      error: null,
    });

    const monitoredAddresses = Array.from(
      new Set(dapp.contractAddresses.map((address) => address.toLowerCase())),
    );
    if (monitoredAddresses.length === 0) return;

    const currentBlock = await withRetry(
      () => this.provider.getBlockNumber(),
      "getBlockNumber",
    );
    const startBlock = await this.getStylusLaunchBlock(currentBlock);

    console.log(
      `[arcana:collector] Scanning historical logs for ${dapp.name} (${startBlock} → ${currentBlock})`,
    );

    const txHashes = new Set<string>();
    for (const address of monitoredAddresses) {
      const logs = await this.collectLogs(address, startBlock, currentBlock);
      for (const log of logs) {
        if (log.transactionHash) {
          txHashes.add(log.transactionHash);
        }
      }
    }

    if (txHashes.size === 0) {
      await this.updateStatus(status, {
        state: "completed",
        totalTransactions: 0,
        processedTransactions: 0,
        indexedTransactions: 0,
        indexedEvents: 0,
        finishedAt: new Date(),
        message: "No historical logs found",
        error: null,
      });
      console.log(
        `[arcana:collector] Backfill found no historical logs for ${dapp.name}`,
      );
      return;
    }

    await this.updateStatus(status, {
      state: "syncing",
      totalTransactions: txHashes.size,
      processedTransactions: 0,
      indexedTransactions: 0,
      indexedEvents: 0,
      message: "Importing historical transactions and events",
      error: null,
    });

    console.log(
      `[arcana:collector] Backfilling ${dapp.name} from ${txHashes.size} historical transactions`,
    );

    const txRows: BackfilledTransactionRow[] = [];
    const eventRows: Array<{
      dappId: string;
      eventName: string;
      txHash: string;
      blockNumber: number;
      logIndex: number;
      eventData: Record<string, unknown>;
      timestamp: Date;
    }> = [];
    let indexedTransactions = 0;
    let indexedEvents = 0;

    const txHashList = Array.from(txHashes);
    for (
      let start = 0;
      start < txHashList.length;
      start += BACKFILL_TX_FETCH_CONCURRENCY
    ) {
      const chunk = txHashList.slice(
        start,
        start + BACKFILL_TX_FETCH_CONCURRENCY,
      );
      const records = await Promise.all(
        chunk.map((txHash) => this.buildBackfillRecords(txHash)),
      );

      for (const record of records) {
        if (!record) continue;
        txRows.push(record.txRow);
        eventRows.push(...record.eventRows);
      }

      if (txRows.length >= 50 || start + chunk.length >= txHashList.length) {
        const insertedTxCount = await insertTransactionsBatch(this.db, txRows);
        const insertedEventCount = await insertEventsBatch(this.db, eventRows);
        indexedTransactions += insertedTxCount;
        indexedEvents += insertedEventCount;
        const processedTransactions = Math.min(
          start + chunk.length,
          txHashList.length,
        );
        await this.updateStatus(status, {
          state: "syncing",
          totalTransactions: txHashList.length,
          processedTransactions,
          indexedTransactions,
          indexedEvents,
          message: `Indexed ${processedTransactions} of ${txHashList.length} historical transactions`,
          error: null,
        });
        console.log(
          `[arcana:collector] Backfill progress ${dapp.name}: ${Math.min(
            start + chunk.length,
            txHashList.length,
          )}/${txHashList.length} txs processed`,
        );
        txRows.length = 0;
        eventRows.length = 0;
      }
    }

    console.log(
      `[arcana:collector] Backfilled ${dapp.name}: ${txHashList.length} transactions discovered`,
    );
    await this.updateStatus(status, {
      state: "completed",
      totalTransactions: txHashList.length,
      processedTransactions: txHashList.length,
      indexedTransactions,
      indexedEvents,
      finishedAt: new Date(),
      message: "Historical backfill complete",
      error: null,
    });
  }

  private async buildBackfillRecords(
    txHash: string,
  ): Promise<{
    txRow: BackfilledTransactionRow;
    eventRows: Array<{
      dappId: string;
      eventName: string;
      txHash: string;
      blockNumber: number;
      logIndex: number;
      eventData: Record<string, unknown>;
      timestamp: Date;
    }>;
  } | null> {
    const [receipt, tx] = await Promise.all([
      withRetry(
        () => this.provider.getTransactionReceipt(txHash),
        `getReceipt(${txHash})`,
      ),
      withRetry(
        () => this.provider.getTransaction(txHash),
        `getTransaction(${txHash})`,
      ),
    ]);

    if (!receipt || !tx) return null;

    const timestamp = await this.getBlockTimestamp(receipt.blockNumber);
    if (!timestamp) return null;

    const eventRows = [];
    for (const log of receipt.logs) {
      const matchedDappId = await this.matchDapp(log.address);
      if (!matchedDappId) continue;

      eventRows.push({
        dappId: matchedDappId,
        eventName: decodeEventName(log),
        txHash,
        blockNumber: receipt.blockNumber,
        logIndex: log.index,
        eventData: decodeLogData(log),
        timestamp,
      });
    }

    return {
      txRow: {
        txHash,
        blockNumber: receipt.blockNumber,
        dappId: await this.matchTransactionToDapp(tx.to, receipt.logs),
        fromAddress: tx.from,
        toAddress: tx.to,
        gasUsed: receipt.gasUsed,
        gasPrice: receipt.gasPrice ?? tx.gasPrice ?? 0n,
        status: receipt.status ?? 0,
        txType: tx.type ?? 0,
        timestamp,
        inputSize: tx.data ? Math.floor((tx.data.length - 2) / 2) : 0,
        isStylus: tx.to ? await this.checkStylus(tx.to) : false,
        methodId: getMethodId(tx.data),
      },
      eventRows,
    };
  }

  private async collectLogs(
    address: string,
    fromBlock: number,
    toBlock: number,
  ): Promise<ethers.Log[]> {
    if (fromBlock > toBlock) return [];

    try {
      return await this.provider.getLogs({
        address,
        fromBlock,
        toBlock,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (fromBlock < toBlock && this.shouldSplitLogRange(message)) {
        const mid = Math.floor((fromBlock + toBlock) / 2);
        const left = await this.collectLogs(address, fromBlock, mid);
        const right = await this.collectLogs(address, mid + 1, toBlock);
        return left.concat(right);
      }

      return withRetry(
        () =>
          this.provider.getLogs({
            address,
            fromBlock,
            toBlock,
          }),
        `getLogs(${address},${fromBlock}-${toBlock})`,
      );
    }
  }

  private shouldSplitLogRange(message: string) {
    return SPLIT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
  }

  private async getStylusLaunchBlock(
    latestBlock: number,
  ): Promise<number> {
    if (this.stylusLaunchBlock !== null) {
      return this.stylusLaunchBlock;
    }

    const targetTimestamp = Math.floor(STYLUS_MAINNET_LAUNCH.getTime() / 1000);
    let low = 0;
    let high = latestBlock;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const block = await withRetry(
        () => this.provider.getBlock(mid),
        `getBlock(${mid})`,
      );
      const timestamp = block?.timestamp ?? 0;

      if (timestamp >= targetTimestamp) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    this.stylusLaunchBlock = low;
    return low;
  }

  private async getBlockTimestamp(blockNumber: number): Promise<Date | null> {
    if (this.blockTimestampCache.has(blockNumber)) {
      return this.blockTimestampCache.get(blockNumber)!;
    }

    const block = await withRetry(
      () => this.provider.getBlock(blockNumber),
      `getBlock(${blockNumber})`,
    );
    if (!block) return null;

    const timestamp = new Date(block.timestamp * 1000);
    this.blockTimestampCache.set(blockNumber, timestamp);
    return timestamp;
  }

  private async checkStylus(address: string): Promise<boolean> {
    const lower = address.toLowerCase();
    if (this.stylusCache.has(lower)) {
      return this.stylusCache.get(lower)!;
    }

    const code = await withRetry(
      () => this.provider.getCode(address),
      `getCode(${address})`,
    );
    const isStylus = isStylusBytecode(code);
    this.stylusCache.set(lower, isStylus);
    return isStylus;
  }

  private async matchTransactionToDapp(
    toAddress: string | null,
    logs: readonly ethers.Log[],
  ): Promise<string | null> {
    if (toAddress) {
      const directMatch = await this.matchDapp(toAddress);
      if (directMatch) {
        return directMatch;
      }
    }

    const logMatches = new Set<string>();
    for (const log of logs) {
      const dappId = await this.matchDapp(log.address);
      if (!dappId) continue;
      logMatches.add(dappId);
      if (logMatches.size > 1) {
        return null;
      }
    }

    return Array.from(logMatches)[0] ?? null;
  }

  private async matchDapp(address: string): Promise<string | null> {
    const lower = address.toLowerCase();
    if (this.dappCache.has(lower)) {
      return this.dappCache.get(lower)!;
    }

    const dapp = await getDappByAddress(this.db, address);
    const dappId = dapp?.id ?? null;
    this.dappCache.set(lower, dappId);
    return dappId;
  }

  private async createInitialStatus(dappId: string): Promise<BackfillStatus> {
    const existingStatus = await readBackfillStatus(this.redis, dappId);
    const now = new Date();
    return {
      dappId,
      state: existingStatus?.state ?? "queued",
      startedAt: existingStatus?.startedAt ?? now,
      updatedAt: now,
      finishedAt: null,
      totalTransactions: existingStatus?.totalTransactions ?? null,
      processedTransactions: existingStatus?.processedTransactions ?? 0,
      indexedTransactions: existingStatus?.indexedTransactions ?? 0,
      indexedEvents: existingStatus?.indexedEvents ?? 0,
      message: existingStatus?.message ?? null,
      error: null,
    };
  }

  private async updateStatus(
    status: BackfillStatus,
    patch: {
      state?: BackfillState;
      finishedAt?: Date | null;
      totalTransactions?: number | null;
      processedTransactions?: number;
      indexedTransactions?: number;
      indexedEvents?: number;
      message?: string | null;
      error?: string | null;
    },
  ) {
    if (patch.state !== undefined) status.state = patch.state;
    if (patch.finishedAt !== undefined) status.finishedAt = patch.finishedAt;
    if (patch.totalTransactions !== undefined) {
      status.totalTransactions = patch.totalTransactions;
    }
    if (patch.processedTransactions !== undefined) {
      status.processedTransactions = patch.processedTransactions;
    }
    if (patch.indexedTransactions !== undefined) {
      status.indexedTransactions = patch.indexedTransactions;
    }
    if (patch.indexedEvents !== undefined) {
      status.indexedEvents = patch.indexedEvents;
    }
    if (patch.message !== undefined) status.message = patch.message;
    if (patch.error !== undefined) status.error = patch.error;
    status.updatedAt = new Date();
    await writeBackfillStatus(this.redis, status);
  }

  private async markFailed(dappId: string, error: unknown) {
    const status = await this.createInitialStatus(dappId);
    await this.updateStatus(status, {
      state: "failed",
      finishedAt: new Date(),
      message: "Historical backfill failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

interface BackfilledTransactionRow {
  txHash: string;
  blockNumber: number;
  dappId: string | null;
  fromAddress: string;
  toAddress: string | null;
  gasUsed: bigint;
  gasPrice: bigint;
  status: number;
  txType: number;
  timestamp: Date;
  inputSize: number;
  isStylus: boolean;
  methodId: string | null;
}

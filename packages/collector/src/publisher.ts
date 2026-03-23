import type Redis from "ioredis";
import { REDIS_CHANNELS } from "@arcana/shared";
import type { CollectedBlock } from "./collectors/block-collector";
import type { AggregateResult } from "./collectors/aggregator";

export class Publisher {
  constructor(private redis: Redis) {}

  /** Publish a new block event */
  async publishBlock(block: CollectedBlock): Promise<void> {
    const payload = JSON.stringify({
      type: REDIS_CHANNELS.BLOCKS,
      dappId: null,
      data: {
        number: block.number,
        hash: block.hash,
        timestamp: block.timestamp,
        gasUsed: block.gasUsed.toString(),
        gasLimit: block.gasLimit.toString(),
        txCount: block.transactionHashes.length,
      },
      timestamp: Date.now(),
    });

    await this.redis.publish(REDIS_CHANNELS.BLOCKS, payload);
  }

  /** Publish metric aggregates */
  async publishMetrics(aggregates: AggregateResult[]): Promise<void> {
    for (const agg of aggregates) {
      const payload = JSON.stringify({
        type: REDIS_CHANNELS.METRICS,
        dappId: agg.dappId,
        data: agg,
        timestamp: Date.now(),
      });

      await this.redis.publish(REDIS_CHANNELS.METRICS, payload);
    }
  }

  /** Publish a transaction event (for high-value or Stylus txs) */
  async publishTransaction(tx: {
    txHash: string;
    isStylus: boolean;
    dappId: string | null;
    gasUsed: string;
    status: number;
  }): Promise<void> {
    const payload = JSON.stringify({
      type: REDIS_CHANNELS.TRANSACTIONS,
      dappId: tx.dappId,
      data: tx,
      timestamp: Date.now(),
    });

    await this.redis.publish(REDIS_CHANNELS.TRANSACTIONS, payload);
  }
}

import cron from "node-cron";
import Redis from "ioredis";
import { loadEnv } from "@arcana/shared/src/config";
import { INTERNAL_REDIS_CHANNELS } from "@arcana/shared";
import { createDb, getAllDapps, getDappById } from "@arcana/db";
import { createProvider, withRetry } from "./provider";
import { BlockCollector } from "./collectors/block-collector";
import { TxCollector } from "./collectors/tx-collector";
import { EventCollector } from "./collectors/event-collector";
import { DappBackfiller } from "./collectors/dapp-backfiller";
import { Aggregator } from "./collectors/aggregator";
import { AlertEvaluator } from "./collectors/alert-evaluator";
import { Publisher } from "./publisher";

const env = loadEnv();

async function main() {
  console.log("[arcana:collector] Starting...");
  console.log(`[arcana:collector] RPC: ${env.ARBITRUM_RPC_URL}`);
  console.log(`[arcana:collector] Chain ID: ${env.ARBITRUM_CHAIN_ID}`);

  // Initialize connections
  const { db } = createDb(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL);
  const redisSub = new Redis(env.REDIS_URL);
  const provider = createProvider(env.ARBITRUM_RPC_URL);

  // Initialize components
  const blockCollector = new BlockCollector(provider, db);
  const txCollector = new TxCollector(provider, db);
  const eventCollector = new EventCollector(provider, db);
  const dappBackfiller = new DappBackfiller(provider, db, redis);
  const aggregator = new Aggregator(db);
  const alertEvaluator = new AlertEvaluator(db, redis);
  const publisher = new Publisher(redis);

  await redisSub.subscribe(INTERNAL_REDIS_CHANNELS.DAPPS);
  redisSub.on("message", (channel: string, message: string) => {
    if (channel !== INTERNAL_REDIS_CHANNELS.DAPPS) return;

    txCollector.clearDappCache();
    eventCollector.clearDappCache();
    console.log(
      `[arcana:collector] Cleared dApp caches after invalidation: ${message}`,
    );

    void (async () => {
      try {
        const payload = JSON.parse(message) as {
          action?: "created" | "deleted";
          dappId?: string;
        };
        if (payload.action !== "created" || !payload.dappId) {
          return;
        }

        const dapp = await getDappById(db, payload.dappId);
        if (!dapp) return;

        await dappBackfiller.backfillDappIfMissing({
          id: dapp.id,
          name: dapp.name,
          contractAddresses: dapp.contractAddresses,
        });
      } catch (error) {
        console.error("[arcana:collector] Failed to backfill new dApp:", error);
      }
    })();
  });

  const monitoredDapps = await getAllDapps(db);
  await dappBackfiller.backfillMissingDapps(
    monitoredDapps.map((dapp) => ({
      id: dapp.id,
      name: dapp.name,
      contractAddresses: dapp.contractAddresses,
    })),
  );

  let lastProcessedBlock = await blockCollector.getStartBlock();
  console.log(`[arcana:collector] Starting from block ${lastProcessedBlock}`);

  // ── Main collection loop ──
  let collecting = false;
  async function collectLoop() {
    if (collecting) return; // prevent concurrent runs
    collecting = true;
    try {
      const currentBlock = await withRetry(
        () => provider.getBlockNumber(),
        "getBlockNumber",
      );

      if (currentBlock <= lastProcessedBlock) return;

      const lag = currentBlock - lastProcessedBlock;
      const batchSize =
        lag > env.COLLECTOR_BATCH_SIZE * 5
          ? Math.min(env.COLLECTOR_BATCH_SIZE * 25, 200)
          : env.COLLECTOR_BATCH_SIZE;

      // Increase the batch size while catching up so live indexing can recover.
      const toBlock = Math.min(
        lastProcessedBlock + batchSize - 1,
        currentBlock,
      );

      console.log(
        `[arcana:collector] Processing blocks ${lastProcessedBlock} → ${toBlock} (lag=${lag}, batch=${batchSize})`,
      );

      const blocks = await blockCollector.collectBlockRange(
        lastProcessedBlock,
        toBlock,
      );

      let totalTxs = 0;
      let totalEvents = 0;
      for (const block of blocks) {
        // Process transactions
        const processedTxs = await txCollector.processBlock(block);
        totalTxs += processedTxs.length;

        // Process events for monitored dApps
        const eventCount = await eventCollector.processBlock(block);
        totalEvents += eventCount;

        // Publish block event
        await publisher.publishBlock(block);

        // Publish each transaction for real-time feed
        for (const tx of processedTxs) {
          await publisher.publishTransaction(tx);
        }
      }

      console.log(
        `[arcana:collector] Collected ${blocks.length} blocks (${totalTxs} txs, ${totalEvents} events)`,
      );

      lastProcessedBlock = toBlock + 1;

      // Trigger a quick 5m aggregation after collecting so metrics update promptly
      if (totalTxs > 0) {
        const dapps = await getAllDapps(db);
        const dappIds = dapps.map((d) => d.id);
        const results = await aggregator.computeAll("5m", dappIds);
        if (results.length > 0) {
          await publisher.publishMetrics(results);
        }
      }
    } catch (err) {
      console.log("[arcana:collector] Collection loop error:", err);
    } finally {
      collecting = false;
    }
  }

  // ── Aggregation job (every 5 minutes) ──
  async function aggregateJob() {
    try {
      const dapps = await getAllDapps(db);
      const dappIds = dapps.map((d) => d.id);

      const results = await aggregator.computeAll("5m", dappIds);

      if (results.length > 0) {
        await publisher.publishMetrics(results);
        console.log(
          `[arcana:collector] Computed ${results.length} aggregates (5m)`,
        );
      }

      // Evaluate alerts after new aggregates
      await alertEvaluator.evaluate();
    } catch (err) {
      console.error("[arcana:collector] Aggregation error:", err);
    }
  }

  // ── Hourly aggregation ──
  async function hourlyAggregateJob() {
    try {
      const dapps = await getAllDapps(db);
      const dappIds = dapps.map((d) => d.id);

      const results = await aggregator.computeAll("1h", dappIds);
      if (results.length > 0) {
        await publisher.publishMetrics(results);
        console.log(
          `[arcana:collector] Computed ${results.length} aggregates (1h)`,
        );
      }
    } catch (err) {
      console.error("[arcana:collector] Hourly aggregation error:", err);
    }
  }

  // ── Daily aggregation ──
  async function dailyAggregateJob() {
    try {
      const dapps = await getAllDapps(db);
      const dappIds = dapps.map((d) => d.id);

      const results = await aggregator.computeAll("24h", dappIds);
      if (results.length > 0) {
        await publisher.publishMetrics(results);
        console.log(
          `[arcana:collector] Computed ${results.length} aggregates (24h)`,
        );
      }
    } catch (err) {
      console.error("[arcana:collector] Daily aggregation error:", err);
    }
  }

  // Start collection polling
  const pollInterval = setInterval(collectLoop, env.COLLECTOR_POLL_INTERVAL_MS);

  // Schedule aggregation cron jobs
  cron.schedule("*/5 * * * *", aggregateJob); // Every 5 minutes
  cron.schedule("0 * * * *", hourlyAggregateJob); // Every hour
  cron.schedule("0 0 * * *", dailyAggregateJob); // Every day at midnight

  // Run initial aggregation
  await aggregateJob();

  console.log("[arcana:collector] Running. Press Ctrl+C to stop.");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n[arcana:collector] Shutting down...");
    clearInterval(pollInterval);
    redis.disconnect();
    redisSub.disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n[arcana:collector] Shutting down...");
    clearInterval(pollInterval);
    redis.disconnect();
    redisSub.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[arcana:collector] Fatal error:", err);
  process.exit(1);
});

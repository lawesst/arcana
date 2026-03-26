import { and, eq, gte, lte, or } from "drizzle-orm";
import { createDb } from "../index";
import {
  alertHistory,
  alertRules,
  blocks,
  contractEvents,
  dapps,
  metricAggregates,
  transactions,
} from "../schema";
import { loadEnv } from "@arcana/shared/src/config";

const SEED_DAPP_ID = "11111111-1111-4111-8111-111111111111";
const SEED_DAPP_NAME = "Smoke Seed Stylus";
const SEED_CONTRACT_ADDRESS = "0x1111111111111111111111111111111111111111";

const SEEDED_TXS = [
  {
    txHash:
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1",
    blockNumber: 990000001,
    fromAddress: "0x2222222222222222222222222222222222222222",
    methodId: "0xabcdef01",
    gasUsed: 210000n,
    gasPrice: 25_000_000n,
    logIndex: 0,
  },
  {
    txHash:
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb02",
    blockNumber: 990000002,
    fromAddress: "0x3333333333333333333333333333333333333333",
    methodId: "0xabcdef02",
    gasUsed: 235000n,
    gasPrice: 28_000_000n,
    logIndex: 1,
  },
  {
    txHash:
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc03",
    blockNumber: 990000003,
    fromAddress: "0x4444444444444444444444444444444444444444",
    methodId: "0xabcdef03",
    gasUsed: 198000n,
    gasPrice: 23_000_000n,
    logIndex: 2,
  },
] as const;

const TEST_ALERT_THRESHOLD_MIN = 900_000_000;
const TEST_ALERT_THRESHOLD_MAX = 910_000_000;

async function main() {
  const env = loadEnv();
  const { db, client } = createDb(env.DATABASE_URL);
  const now = Date.now();

  const timestamps = [
    new Date(now - 12 * 60_000),
    new Date(now - 6 * 60_000),
    new Date(now - 2 * 60_000),
  ];

  try {
    // Remove prior smoke-test data so the suite stays idempotent.
    await db
      .delete(alertHistory)
      .where(
        and(
          gte(alertHistory.thresholdValue, String(TEST_ALERT_THRESHOLD_MIN)),
          lte(alertHistory.thresholdValue, String(TEST_ALERT_THRESHOLD_MAX)),
        ),
      );

    await db
      .delete(alertRules)
      .where(
        or(
          and(
            gte(alertRules.threshold, String(TEST_ALERT_THRESHOLD_MIN)),
            lte(alertRules.threshold, String(TEST_ALERT_THRESHOLD_MAX)),
          ),
          eq(alertRules.dappId, SEED_DAPP_ID),
        ),
      );

    await db
      .delete(contractEvents)
      .where(eq(contractEvents.dappId, SEED_DAPP_ID));

    await db
      .delete(transactions)
      .where(
        or(
          eq(transactions.dappId, SEED_DAPP_ID),
          eq(transactions.toAddress, SEED_CONTRACT_ADDRESS),
        ),
      );

    await db
      .delete(metricAggregates)
      .where(eq(metricAggregates.dappId, SEED_DAPP_ID));

    await db
      .delete(blocks)
      .where(
        or(
          eq(blocks.blockNumber, SEEDED_TXS[0].blockNumber),
          eq(blocks.blockNumber, SEEDED_TXS[1].blockNumber),
          eq(blocks.blockNumber, SEEDED_TXS[2].blockNumber),
        ),
      );

    await db.delete(dapps).where(eq(dapps.id, SEED_DAPP_ID));

    await db.insert(dapps).values({
      id: SEED_DAPP_ID,
      name: SEED_DAPP_NAME,
      contractAddresses: [SEED_CONTRACT_ADDRESS],
      abi: null,
      chainId: 42161,
      createdAt: new Date(now - 15 * 60_000),
      deletedAt: null,
    });

    await db.insert(blocks).values(
      SEEDED_TXS.map((tx, index) => ({
        blockNumber: tx.blockNumber,
        blockHash: `0x${String(index + 1).repeat(64)}`,
        timestamp: timestamps[index],
        gasUsed: 15_000_000n + BigInt(index * 100_000),
        gasLimit: 30_000_000n,
        txCount: index + 1,
        baseFee: 1_500_000n + BigInt(index * 100_000),
      })),
    );

    await db.insert(transactions).values(
      SEEDED_TXS.map((tx, index) => ({
        txHash: tx.txHash,
        blockNumber: tx.blockNumber,
        dappId: SEED_DAPP_ID,
        fromAddress: tx.fromAddress,
        toAddress: SEED_CONTRACT_ADDRESS,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        status: 1,
        txType: 2,
        timestamp: timestamps[index],
        inputSize: 68,
        isStylus: true,
        methodId: tx.methodId,
      })),
    );

    await db.insert(contractEvents).values(
      SEEDED_TXS.map((tx, index) => ({
        dappId: SEED_DAPP_ID,
        eventName: index === 2 ? "SmokeTransfer" : "SmokeSync",
        txHash: tx.txHash,
        blockNumber: tx.blockNumber,
        logIndex: tx.logIndex,
        eventData: {
          amount: 1000 + index,
          caller: tx.fromAddress,
        },
        timestamp: timestamps[index],
      })),
    );

    console.log(
      `[arcana:e2e] Seeded ${SEEDED_TXS.length} transactions for ${SEED_DAPP_NAME}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[arcana:e2e] Failed to seed Playwright fixtures:", error);
  process.exit(1);
});

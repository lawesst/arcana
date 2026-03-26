import type { App } from "../types";
import {
  getAllDapps,
  getDappById,
  createDapp,
  deleteDapp,
  getTransactionCountSince,
  getEventCountSince,
} from "@arcana/db";
import {
  INTERNAL_REDIS_CHANNELS,
  INTERNAL_REDIS_KEYS,
  type BackfillStatus,
} from "@arcana/shared";

export function registerDappRoutes(app: App) {
  // List all dApps
  app.get("/api/dapps", async () => {
    const dapps = await getAllDapps(app.db);
    return { success: true, data: dapps };
  });

  // Get dApp by ID
  app.get<{ Params: { id: string } }>("/api/dapps/:id", async (req, reply) => {
    const dapp = await getDappById(app.db, req.params.id);
    if (!dapp) {
      return reply.status(404).send({ success: false, error: "dApp not found" });
    }
    return { success: true, data: dapp };
  });

  app.get<{ Params: { id: string } }>(
    "/api/dapps/:id/backfill-status",
    async (req, reply) => {
      const dapp = await getDappById(app.db, req.params.id);
      if (!dapp) {
        return reply
          .status(404)
          .send({ success: false, error: "dApp not found" });
      }

      const status = await getBackfillStatus(app, dapp.id, dapp.createdAt);
      return { success: true, data: status };
    },
  );

  // Register a new dApp
  app.post<{
    Body: {
      name: string;
      contractAddresses: string[];
      abi?: unknown[];
      chainId?: number;
    };
  }>("/api/dapps", async (req, reply) => {
    const { name, contractAddresses, abi, chainId } = req.body;
    const normalizedName = name?.trim();

    if (!normalizedName || !contractAddresses || contractAddresses.length === 0) {
      return reply
        .status(400)
        .send({ success: false, error: "name and contractAddresses are required" });
    }

    const normalizedAddresses = normalizeContractAddresses(contractAddresses);
    if (normalizedAddresses.length === 0) {
      return reply.status(400).send({
        success: false,
        error: "Provide at least one valid Arbitrum contract address",
      });
    }

    const existingDapps = await getAllDapps(app.db);
    const duplicateAddress = normalizedAddresses.find((address) =>
      existingDapps.some((dapp) =>
        dapp.contractAddresses.some(
          (existingAddress) =>
            existingAddress.toLowerCase() === address.toLowerCase(),
        ),
      ),
    );

    if (duplicateAddress) {
      return reply.status(409).send({
        success: false,
        error: `Contract ${duplicateAddress} is already being monitored`,
      });
    }

    const dapp = await createDapp(app.db, {
      name: normalizedName,
      contractAddresses: normalizedAddresses,
      abi,
      chainId,
    });

    await setBackfillStatus(app, {
      dappId: dapp.id,
      state: "queued",
      startedAt: new Date(),
      updatedAt: new Date(),
      finishedAt: null,
      totalTransactions: null,
      processedTransactions: 0,
      indexedTransactions: 0,
      indexedEvents: 0,
      message: "Waiting for collector to start historical backfill",
      error: null,
    });

    await publishDappInvalidation(app, {
      action: "created",
      dappId: dapp.id,
      contractAddresses: dapp.contractAddresses,
    });

    return reply.status(201).send({ success: true, data: dapp });
  });

  // Delete a dApp
  app.delete<{ Params: { id: string } }>(
    "/api/dapps/:id",
    async (req, reply) => {
      const dapp = await getDappById(app.db, req.params.id);
      if (!dapp) {
        return reply.status(404).send({ success: false, error: "dApp not found" });
      }

      await deleteDapp(app.db, req.params.id);
      await clearBackfillStatus(app, dapp.id);

      await publishDappInvalidation(app, {
        action: "deleted",
        dappId: dapp.id,
        contractAddresses: dapp.contractAddresses,
      });

      return { success: true };
    },
  );
}

function getBackfillStatusKey(dappId: string) {
  return `${INTERNAL_REDIS_KEYS.BACKFILL_STATUS_PREFIX}${dappId}`;
}

async function setBackfillStatus(app: App, status: BackfillStatus) {
  await app.redisPub.set(
    getBackfillStatusKey(status.dappId),
    JSON.stringify({
      ...status,
      startedAt: status.startedAt.toISOString(),
      updatedAt: status.updatedAt.toISOString(),
      finishedAt: status.finishedAt?.toISOString() ?? null,
    }),
  );
}

async function clearBackfillStatus(app: App, dappId: string) {
  await app.redisPub.del(getBackfillStatusKey(dappId));
}

async function getBackfillStatus(
  app: App,
  dappId: string,
  createdAt: Date,
): Promise<BackfillStatus> {
  const raw = await app.redisPub.get(getBackfillStatusKey(dappId));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Omit<
        BackfillStatus,
        "startedAt" | "updatedAt" | "finishedAt"
      > & {
        startedAt: string;
        updatedAt: string;
        finishedAt: string | null;
      };

      return {
        ...parsed,
        startedAt: new Date(parsed.startedAt),
        updatedAt: new Date(parsed.updatedAt),
        finishedAt: parsed.finishedAt ? new Date(parsed.finishedAt) : null,
        totalTransactions:
          parsed.totalTransactions === null
            ? null
            : Number(parsed.totalTransactions),
        processedTransactions: Number(parsed.processedTransactions),
        indexedTransactions: Number(parsed.indexedTransactions),
        indexedEvents: Number(parsed.indexedEvents),
      };
    } catch {
      // Fall through to a derived status if Redis contains malformed data.
    }
  }

  const [txCount, eventCount] = await Promise.all([
    getTransactionCountSince(app.db, new Date(0), dappId),
    getEventCountSince(app.db, new Date(0), dappId),
  ]);
  const now = new Date();

  if (txCount > 0 || eventCount > 0) {
    return {
      dappId,
      state: "completed",
      startedAt: createdAt,
      updatedAt: now,
      finishedAt: now,
      totalTransactions: Number(txCount),
      processedTransactions: Number(txCount),
      indexedTransactions: Number(txCount),
      indexedEvents: Number(eventCount),
      message: "Historical data available",
      error: null,
    };
  }

  return {
    dappId,
    state: "queued",
    startedAt: createdAt,
    updatedAt: now,
    finishedAt: null,
    totalTransactions: null,
    processedTransactions: 0,
    indexedTransactions: 0,
    indexedEvents: 0,
    message: "Waiting for collector to start historical backfill",
    error: null,
  };
}

function normalizeContractAddresses(addresses: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawAddress of addresses) {
    const address = rawAddress.trim().toLowerCase();
    if (!address) continue;
    if (!/^0x[a-f0-9]{40}$/.test(address)) continue;
    if (seen.has(address)) continue;

    seen.add(address);
    normalized.push(address);
  }

  return normalized;
}

async function publishDappInvalidation(
  app: App,
  payload: {
    action: "created" | "deleted";
    dappId: string;
    contractAddresses: string[];
  },
) {
  try {
    await app.redisPub.publish(
      INTERNAL_REDIS_CHANNELS.DAPPS,
      JSON.stringify({
        ...payload,
        timestamp: Date.now(),
      }),
    );
  } catch (error) {
    app.log.error(
      {
        error,
        dappId: payload.dappId,
        action: payload.action,
      },
      "Failed to publish dApp cache invalidation",
    );
  }
}

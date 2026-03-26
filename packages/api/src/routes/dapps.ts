import type { App } from "../types";
import { getAllDapps, getDappById, createDapp, deleteDapp } from "@arcana/db";
import { INTERNAL_REDIS_CHANNELS } from "@arcana/shared";

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

      await publishDappInvalidation(app, {
        action: "deleted",
        dappId: dapp.id,
        contractAddresses: dapp.contractAddresses,
      });

      return { success: true };
    },
  );
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

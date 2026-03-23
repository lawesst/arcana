import type { App } from "../types";
import { getAllDapps, getDappById, createDapp, deleteDapp } from "@arcana/db";

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

    if (!name || !contractAddresses || contractAddresses.length === 0) {
      return reply
        .status(400)
        .send({ success: false, error: "name and contractAddresses are required" });
    }

    const dapp = await createDapp(app.db, {
      name,
      contractAddresses,
      abi,
      chainId,
    });

    return reply.status(201).send({ success: true, data: dapp });
  });

  // Delete a dApp
  app.delete<{ Params: { id: string } }>(
    "/api/dapps/:id",
    async (req, reply) => {
      await deleteDapp(app.db, req.params.id);
      return { success: true };
    },
  );
}

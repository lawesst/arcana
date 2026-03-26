import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Redis from "ioredis";
import { loadEnv } from "@arcana/shared/src/config";
import { createDb } from "@arcana/db";
import { registerHealthRoutes } from "./routes/health";
import { registerDappRoutes } from "./routes/dapps";
import { registerMetricsRoutes } from "./routes/metrics";
import { registerTransactionRoutes } from "./routes/transactions";
import { registerBlockRoutes } from "./routes/blocks";
import { registerAlertRoutes } from "./routes/alerts";
import { registerEventRoutes } from "./routes/events";
import { registerStylusRoutes } from "./routes/stylus";
import { registerSearchRoutes } from "./routes/search";
import { registerWsRoutes } from "./routes/ws";

const env = loadEnv();

async function main() {
  const app = Fastify({
    logger: true,
  });

  // Handle BigInt serialization in JSON responses
  app.addHook("preSerialization", async (_req, _reply, payload) => {
    return JSON.parse(
      JSON.stringify(payload, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );
  });

  // Plugins
  await app.register(cors, {
    origin: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  await app.register(websocket);

  // Database
  const { db } = createDb(env.DATABASE_URL);

  // Redis (publisher for internal notifications, subscriber for WebSocket fan-out)
  const redisPub = new Redis(env.REDIS_URL);
  const redisSub = new Redis(env.REDIS_URL);

  // Decorate Fastify with shared instances
  app.decorate("db", db);
  app.decorate("redisPub", redisPub);
  app.decorate("redisSub", redisSub);

  // Routes
  registerHealthRoutes(app);
  registerDappRoutes(app);
  registerMetricsRoutes(app);
  registerTransactionRoutes(app);
  registerBlockRoutes(app);
  registerAlertRoutes(app);
  registerEventRoutes(app);
  registerStylusRoutes(app);
  registerSearchRoutes(app);
  registerWsRoutes(app);

  // Start server
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  console.log(`[arcana:api] Server running on http://${env.API_HOST}:${env.API_PORT}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[arcana:api] Shutting down...");
    redisPub.disconnect();
    redisSub.disconnect();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[arcana:api] Fatal error:", err);
  process.exit(1);
});

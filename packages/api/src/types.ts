import type { FastifyInstance } from "fastify";
import type { Database } from "@arcana/db";
import type Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    redisSub: Redis;
  }
}

export type App = FastifyInstance;

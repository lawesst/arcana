import type { FastifyInstance } from "fastify";
import type { Database } from "@arcana/db";
import type Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    redisPub: Redis;
    redisSub: Redis;
    startedAt: Date;
  }
}

export type App = FastifyInstance;

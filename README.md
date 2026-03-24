# Arcana

Real-time analytics dashboard for Stylus dApps on Arbitrum.

## What It Does

Arcana indexes Arbitrum blocks and transactions, detects Stylus (WASM) contracts, computes rolling metrics, and streams everything to a live dashboard.

## Architecture

```
Arbitrum RPC ──> Collector ──> PostgreSQL
                    │               │
                    │ pub/sub        │ queries
                    ▼               ▼
                  Redis ──────> API Server (Fastify)
                                    │
                               REST + WebSocket
                                    │
                                    ▼
                              Dashboard (Next.js)
```

## Quick Start

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm db:generate && pnpm db:migrate
pnpm dev
```

- **Dashboard** — http://localhost:3000
- **API** — http://localhost:3001
- **Collector** — runs in background

## Packages

| Package | Description |
|---------|-------------|
| `@arcana/shared` | Types, constants, config, utilities |
| `@arcana/db` | Drizzle ORM schema, migrations, queries (7 tables) |
| `@arcana/collector` | Block/tx ingestion, Stylus detection, aggregation, alerts |
| `@arcana/api` | Fastify REST (30+ endpoints) + WebSocket server |
| `@arcana/dashboard` | Next.js 15 frontend with Recharts + Tailwind |

## Tech Stack

Node.js, TypeScript, pnpm workspaces, ethers.js v6, Fastify, Drizzle ORM, PostgreSQL, Redis, Next.js 15, React 19, Recharts, Tailwind CSS

## License

MIT

# Arcana

Real-time analytics dashboard for Stylus dApps on Arbitrum.

Arcana indexes Arbitrum blocks and transactions, detects Stylus (WASM) contracts, computes rolling aggregates, and streams everything to a live dashboard over WebSocket.

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.7-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)

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

**Collector** polls the Arbitrum RPC for new blocks, processes transactions, matches them to registered dApps, detects Stylus contracts, and publishes events to Redis. Rolling aggregates (5m, 1h, 24h) are computed and stored in PostgreSQL.

**API** serves historical data via REST and streams real-time updates via WebSocket by subscribing to Redis pub/sub channels.

**Dashboard** renders metrics, charts, transaction tables, and an explorer — all updating live.

## Features

- **Stylus detection** — identifies WASM contracts via the `0xEFF00000` bytecode prefix
- **Live metrics** — transaction count, gas usage, error rate, unique addresses, updated every collection cycle
- **Time-series charts** — gas usage, throughput, and error rate over configurable windows
- **Multi-dApp tracking** — register contract addresses and get per-dApp analytics
- **Block & transaction explorer** — paginated tables with filtering (Stylus-only, reverted)
- **Contract event indexing** — monitors registered dApp contracts for emitted events
- **Custom alerts** — threshold-based rules on gas, errors, throughput, Stylus ratio with cooldowns
- **Universal search** — find transactions by hash, blocks by number, addresses by activity
- **WebSocket real-time feed** — blocks, transactions, metrics, and alerts streamed to connected clients

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker

### Setup

```bash
# Install dependencies
pnpm install

# Start PostgreSQL and Redis
docker compose up -d

# Configure environment
cp .env.example .env

# Run database migrations
pnpm db:generate
pnpm db:migrate

# Start all services
pnpm dev
```

This starts:

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | http://localhost:3000 | Next.js frontend |
| API | http://localhost:3001 | REST + WebSocket server |
| Collector | — | Background data ingestion |

### Register a dApp

```bash
curl -X POST http://localhost:3001/api/dapps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Uniswap",
    "description": "Universal Router",
    "chainId": 42161,
    "contractAddresses": ["0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5"]
  }'
```

Transactions to/from registered contract addresses are automatically tagged with the dApp ID. Per-dApp metrics and events appear on the dApp detail page.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@arcana/shared` | `packages/shared` | Types, constants, config, utilities |
| `@arcana/db` | `packages/db` | Drizzle ORM schema, migrations, queries |
| `@arcana/collector` | `packages/collector` | Block/tx ingestion, Stylus detection, aggregation, alerts |
| `@arcana/api` | `packages/api` | Fastify REST API + WebSocket server |
| `@arcana/dashboard` | `packages/dashboard` | Next.js 15 frontend with Recharts + Tailwind |

### Running individually

```bash
pnpm dev:collector   # data ingestion only
pnpm dev:api         # API server only
pnpm dev:dashboard   # frontend only
```

## API Reference

### dApps

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dapps` | List all registered dApps |
| `POST` | `/api/dapps` | Register a new dApp |
| `GET` | `/api/dapps/:id/metrics` | Metrics for a specific dApp |

### Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/metrics/global?range=24h` | Network-wide time-series metrics |
| `GET` | `/api/metrics/latest?dappId=` | Latest 5m aggregate (global or per-dApp) |

### Transactions & Blocks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/transactions?limit=50&offset=0` | Paginated recent transactions |
| `GET` | `/api/transactions/stylus/stats` | Stylus transaction statistics |
| `GET` | `/api/blocks?limit=20&offset=0` | Paginated recent blocks |
| `GET` | `/api/events?limit=50&eventName=` | Indexed contract events |
| `GET` | `/api/events/names` | Distinct event names with counts |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/search?q=` | Search by tx hash, block number, or address |

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/alerts` | List alert rules |
| `POST` | `/api/alerts` | Create an alert rule |
| `GET` | `/api/alerts/history` | Triggered alert events |

### WebSocket

Connect to `ws://localhost:3001/ws` to receive real-time events:

```json
{ "type": "arcana:blocks", "data": { ... }, "timestamp": 1234567890 }
{ "type": "arcana:transactions", "data": { ... }, "timestamp": 1234567890 }
{ "type": "arcana:metrics", "data": [ ... ], "timestamp": 1234567890 }
{ "type": "arcana:alerts", "data": { ... }, "timestamp": 1234567890 }
```

## Dashboard Pages

| Page | Path | Description |
|------|------|-------------|
| Overview | `/` | Metric cards, charts, recent transactions |
| Explorer | `/explorer` | Paginated blocks, transactions, events with filters |
| dApps | `/dapps` | Registered dApps list and per-dApp detail views |
| Stylus | `/stylus` | Stylus-specific analytics and contract stats |
| Alerts | `/alerts` | Alert rule management and trigger history |

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `ARBITRUM_RPC_URL` | `https://arb1.arbitrum.io/rpc` | Arbitrum JSON-RPC endpoint |
| `ARBITRUM_CHAIN_ID` | `42161` | Chain ID (42161 = One, 421614 = Sepolia) |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string |
| `API_PORT` | `3001` | API server port |
| `COLLECTOR_POLL_INTERVAL_MS` | `1000` | How often the collector polls for new blocks |
| `COLLECTOR_BATCH_SIZE` | `10` | Max blocks to fetch per poll cycle |

## Tech Stack

- **Runtime** — Node.js, TypeScript, pnpm workspaces
- **Blockchain** — ethers.js v6 (Arbitrum JSON-RPC)
- **Backend** — Fastify, Drizzle ORM, PostgreSQL 16, Redis 7
- **Frontend** — Next.js 15, React 19, Recharts, Tailwind CSS
- **Infra** — Docker Compose, tsx (dev), node-cron (scheduled jobs)

## How Stylus Detection Works

Arbitrum Stylus contracts compile to WASM and are deployed with a bytecode prefix of `0xEFF00000` (an EOF-inspired marker). Arcana calls `eth_getCode` on contract addresses and checks for this prefix to classify transactions as Stylus or EVM.

At the RPC level, Stylus contracts behave identically to EVM contracts — they use standard Solidity ABIs, and gas is reported in normal units (the internal "ink" conversion is transparent). No special RPC handling is needed.

## License

MIT

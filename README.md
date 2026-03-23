# Arcana

Real-time and historical analytics dashboard for Stylus dApps on Arbitrum.

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────────┐
│  Arbitrum    │───>│  Collector   │───>│  PostgreSQL     │
│  RPC Node   │    │  (ethers.js) │    │  (historical)   │
└─────────────┘    └──────┬───────┘    └────────┬────────┘
                          │                      │
                          │ pub/sub              │ queries
                          ▼                      ▼
                   ┌─────────────┐    ┌─────────────────┐
                   │   Redis     │───>│   API Server    │
                   │  (cache)    │    │   (Fastify)     │
                   └─────────────┘    └────────┬────────┘
                                               │
                                      REST + WebSocket
                                               │
                                               ▼
                                    ┌─────────────────┐
                                    │   Dashboard     │
                                    │   (Next.js)     │
                                    └─────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@arcana/shared` | Types, constants, config, utilities |
| `@arcana/db` | Drizzle ORM schema, migrations, queries |
| `@arcana/collector` | Blockchain data ingestion from Arbitrum RPC |
| `@arcana/api` | Fastify REST + WebSocket server |
| `@arcana/dashboard` | Next.js frontend with Recharts |

## Key Features

- **Stylus Detection** — Identifies Stylus (WASM) contracts via `0xEFF00000` bytecode prefix
- **Real-time Monitoring** — Live transaction feeds via WebSocket + Redis pub/sub
- **Historical Analysis** — Time-series aggregates (5m, 1h, 24h windows)
- **Custom Alerts** — Configurable thresholds for gas, errors, throughput
- **Multi-dApp Tracking** — Register and monitor multiple contract addresses

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for PostgreSQL + Redis)

### Setup

```bash
# Clone and install
pnpm install

# Start databases
docker compose up -d

# Run migrations
pnpm db:generate
pnpm db:migrate

# Copy env file
cp .env.example .env

# Start all services
pnpm dev
```

This starts:
- **Collector** — ingests blocks/transactions from Arbitrum One
- **API** — REST + WebSocket on `http://localhost:3001`
- **Dashboard** — Next.js app on `http://localhost:3000`

### Individual Services

```bash
pnpm dev:collector  # Data ingestion only
pnpm dev:api        # API server only
pnpm dev:dashboard  # Frontend only
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/dapps` | List monitored dApps |
| POST | `/api/dapps` | Register a dApp |
| GET | `/api/dapps/:id/metrics` | dApp metrics |
| GET | `/api/metrics/global` | Network-wide metrics |
| GET | `/api/metrics/latest` | Latest aggregate |
| GET | `/api/transactions` | Recent transactions |
| GET | `/api/transactions/stylus/stats` | Stylus tx stats |
| GET | `/api/blocks` | Recent blocks |
| GET | `/api/alerts` | Alert rules |
| POST | `/api/alerts` | Create alert rule |
| GET | `/api/alerts/history` | Triggered alerts |
| WS | `/ws` | Real-time feed |

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Blockchain**: ethers.js v6 (Arbitrum RPC)
- **Backend**: Fastify, Drizzle ORM, PostgreSQL, Redis
- **Frontend**: Next.js 15, Recharts, Tailwind CSS
- **Monorepo**: pnpm workspaces

## Arbitrum & Stylus

Arcana leverages Arbitrum's standard JSON-RPC API to collect block and transaction data. It detects Stylus (WASM) contracts by checking the `0xEFF00000` bytecode prefix — the EOF-inspired marker that distinguishes Stylus programs from EVM bytecode.

Stylus contracts use standard Solidity ABIs and appear identically to EVM contracts at the RPC level. Gas is reported in standard units (the Stylus "ink" conversion happens under the hood). This means Arcana can monitor Stylus dApps with no special handling beyond the bytecode detection.

## License

MIT

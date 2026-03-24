# Arcana

Real-time analytics dashboard for Stylus dApps on Arbitrum.

Arcana is a full-stack monitoring platform that indexes Arbitrum blocks and transactions in real time, automatically detects Stylus (WASM) smart contracts, computes rolling metric aggregates, fires configurable alerts, and streams everything to a live dashboard over WebSocket. Built as a pnpm monorepo with 5 packages spanning blockchain ingestion, a REST/WebSocket API, a PostgreSQL data layer, and a Next.js frontend.

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.7-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![Arbitrum](https://img.shields.io/badge/chain-Arbitrum%20One-blue)

---

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Quick Start](#quick-start)
- [Packages](#packages)
- [Database Schema](#database-schema)
- [Collector Pipeline](#collector-pipeline)
- [API Reference](#api-reference)
- [Dashboard](#dashboard)
- [Shared Library](#shared-library)
- [Configuration](#configuration)
- [Tech Stack](#tech-stack)
- [How Stylus Detection Works](#how-stylus-detection-works)
- [Development Progress](#development-progress)
- [License](#license)

---

## Architecture

```
┌─────────────────┐     ┌───────────────────────────────────────────────┐
│  Arbitrum One    │     │              Collector Service                │
│  JSON-RPC        │────>│                                               │
│  (ethers.js v6)  │     │  BlockCollector ──> TxCollector ──> EventCollector
└─────────────────┘     │       │                  │               │     │
                         │       │         ABI decode (Transfer,    │     │
                         │       │         Approval, Swap, Sync)   │     │
                         │       ▼                  ▼               ▼     │
                         │  ┌──────────┐    ┌────────────┐  ┌──────────┐ │
                         │  │ insertBlock│   │insertTxBatch│  │insertEvent│ │
                         │  └──────────┘    └────────────┘  └──────────┘ │
                         │       │                                        │
                         │       ▼                                        │
                         │  Aggregator (5m / 1h / 24h windows)           │
                         │       │                                        │
                         │       ▼                                        │
                         │  AlertEvaluator ──> check thresholds          │
                         │       │                                        │
                         │       ▼                                        │
                         │  Publisher ──> Redis pub/sub                   │
                         └───────────────────┬───────────────────────────┘
                                             │
               ┌─────────────────────────────┼─────────────────────────────┐
               │                             │                             │
               ▼                             ▼                             ▼
        ┌─────────────┐             ┌──────────────┐             ┌──────────────┐
        │  PostgreSQL  │             │    Redis     │             │  API Server  │
        │  (7 tables)  │<───queries──│  (pub/sub)   │────────────>│  (Fastify)   │
        │              │             │  4 channels  │             │              │
        └─────────────┘             └──────────────┘             │  30+ REST    │
                                                                  │  endpoints   │
                                                                  │  + WebSocket │
                                                                  └──────┬───────┘
                                                                         │
                                                                    REST + WS
                                                                         │
                                                                         ▼
                                                                  ┌──────────────┐
                                                                  │  Dashboard   │
                                                                  │  (Next.js 15)│
                                                                  │              │
                                                                  │  6 pages     │
                                                                  │  3 charts    │
                                                                  │  Live feed   │
                                                                  └──────────────┘
```

### Data Flow

1. **Collector** polls Arbitrum One RPC every second for new blocks (configurable batch size)
2. Each block's transactions are processed: dApp matching, Stylus detection (`eth_getCode` + bytecode prefix check), method ID extraction
3. Contract events are decoded for monitored dApps (Transfer, Approval, Swap, Sync, and raw events)
4. Processed data is written to PostgreSQL and published to Redis channels
5. After each batch, 5-minute aggregates are computed and published (hourly and daily via cron)
6. Alert rules are evaluated against the latest aggregates; triggers are published to Redis
7. **API** subscribes to all Redis channels once and broadcasts to a `Set<WebSocket>` of connected dashboard clients
8. **Dashboard** receives real-time events and refreshes metrics, charts, and tables

---

## Features

### Blockchain Indexing
- **Block collection** — fetches blocks with full transaction data in parallel batches
- **Transaction processing** — extracts gas, status, type, method ID, from/to addresses
- **Stylus detection** — identifies WASM contracts via the `0xEFF00000` bytecode prefix with an in-memory cache
- **dApp matching** — auto-tags transactions to registered dApps by contract address (cached)
- **Event decoding** — parses Transfer, Approval, Swap, and Sync events with indexed parameter decoding
- **Chain mismatch detection** — automatically resets when DB blocks are ahead of chain (e.g., after RPC switch)

### Analytics
- **Rolling aggregates** — txCount, errorCount, avgGasUsed, avgGasPrice, errorRate, uniqueAddresses, stylusTxCount over 5m / 1h / 24h windows
- **Per-dApp metrics** — each registered dApp gets its own aggregate time series
- **Global network metrics** — aggregate across all transactions
- **Stylus analytics** — gas comparison (Stylus vs EVM), adoption ratio, top contracts, time-series breakdown
- **Gas comparison** — side-by-side Stylus vs EVM gas stats with bucket time series

### Real-Time
- **WebSocket feed** — blocks, transactions, metrics, and alerts streamed to clients
- **Redis pub/sub** — 4 channels (`arcana:blocks`, `arcana:transactions`, `arcana:metrics`, `arcana:alerts`)
- **Auto-reconnect** — dashboard WebSocket reconnects with exponential backoff (max 30s)
- **Live indicators** — connection status badge, auto-refreshing tables and charts

### Alerts
- **Configurable rules** — metric (gas_usage, error_rate, tx_throughput, tx_speed, stylus_ratio), condition (above/below), threshold, window
- **Cooldown periods** — prevent alert spam (configurable per rule, default 15 minutes)
- **Alert history** — full log of triggered alerts with metric values and thresholds
- **Real-time notifications** — triggered alerts published via Redis and pushed to dashboard

### Explorer
- **Transaction browser** — paginated, filterable (all / Stylus-only / reverted), links to Arbiscan
- **Block browser** — paginated with gas usage, tx count, timestamps
- **Event browser** — filterable by event name, shows decoded event data
- **Universal search** — search by transaction hash (0x + 64 hex), block number, or address (0x + 40 hex)

### Dashboard
- **6 pages** — Overview, Explorer, dApps, dApp Detail, Stylus Analytics, Alerts
- **Metric cards** — transactions, avg gas, error rate, Stylus count, unique addresses
- **Charts** — gas usage area chart, tx throughput stacked bar, error rate line chart, Stylus gas comparison, adoption pie chart
- **Responsive design** — mobile sidebar with hamburger toggle, overflow-x scroll on tables
- **Error states** — retry buttons on all data-fetching components

---

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for PostgreSQL and Redis)

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

### Register dApps to Monitor

```bash
# Uniswap Universal Router
curl -X POST http://localhost:3001/api/dapps \
  -H "Content-Type: application/json" \
  -d '{"name":"Uniswap","chainId":42161,"contractAddresses":["0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5"]}'

# GMX V2 Exchange Router
curl -X POST http://localhost:3001/api/dapps \
  -H "Content-Type: application/json" \
  -d '{"name":"GMX V2","chainId":42161,"contractAddresses":["0x7C68C7866A64FA2160F78EeaE12217FFbf871Fa8"]}'

# Aave V3 Pool
curl -X POST http://localhost:3001/api/dapps \
  -H "Content-Type: application/json" \
  -d '{"name":"Aave V3","chainId":42161,"contractAddresses":["0x794a61358D6845594F94dc1DB02A252b5b4814aD"]}'
```

Transactions to/from registered contract addresses are automatically tagged. Per-dApp metrics and events appear on the dApp detail page.

### Running Individual Services

```bash
pnpm dev:collector   # data ingestion only
pnpm dev:api         # API server only
pnpm dev:dashboard   # frontend only
```

---

## Packages

```
arcana/
├── packages/
│   ├── shared/          # @arcana/shared — types, constants, config, utilities
│   ├── db/              # @arcana/db — Drizzle ORM schema, migrations, queries
│   ├── collector/       # @arcana/collector — blockchain ingestion pipeline
│   ├── api/             # @arcana/api — Fastify REST + WebSocket server
│   └── dashboard/       # @arcana/dashboard — Next.js 15 frontend
├── scripts/
│   └── clear-db.ts      # Utility to truncate all tables
├── docker-compose.yml   # PostgreSQL 16 + Redis 7
├── .env.example         # Environment template
├── pnpm-workspace.yaml  # Workspace config
└── tsconfig.json        # Base TypeScript config
```

### @arcana/shared (`packages/shared`)

Shared types, constants, and utilities consumed by all other packages.

| File | Contents |
|------|----------|
| `config.ts` | `loadEnv()` — Zod-validated environment loader |
| `constants.ts` | `STYLUS_BYTECODE_PREFIX`, `REDIS_CHANNELS`, `WINDOW_DURATION_MS`, `EXPLORER_URLS`, `CHAIN_NAMES`, `DEFAULT_RPC_URLS`, collector/API defaults |
| `types.ts` | 15+ TypeScript interfaces — `DApp`, `TransactionData`, `MetricAggregate`, `AlertRule`, `AlertEvent`, `ContractEvent`, `WsMessage<T>`, `ApiResponse<T>`, etc. |
| `utils.ts` | `isStylusBytecode()`, `truncateAddress()`, `formatGas()`, `explorerUrl()`, `bigintSerializer()`, `safeDivide()`, `getMethodId()`, `sleep()` |

### @arcana/db (`packages/db`)

Drizzle ORM layer — schema definitions, migrations, and query functions.

| File | Contents |
|------|----------|
| `schema/blocks.ts` | `blocks` table |
| `schema/transactions.ts` | `transactions` table with 4 indexes |
| `schema/dapps.ts` | `dapps` table |
| `schema/contract-events.ts` | `contract_events` table with unique + dApp indexes |
| `schema/metric-aggregates.ts` | `metric_aggregates` table with composite unique index |
| `schema/alerts.ts` | `alert_rules` + `alert_history` tables |
| `queries/blocks.ts` | `insertBlock`, `getLatestBlock`, `getRecentBlocks`, `getBlockByNumber`, `getBlocksSince`, `getBlockCount` |
| `queries/transactions.ts` | `insertTransaction`, `insertTransactionsBatch`, `getRecentTransactions`, `getTransactionByHash`, `getTransactionCountSince`, `getTransactionsByAddress`, `getStylusTransactionCount` |
| `queries/dapps.ts` | `getAllDapps`, `getDappById`, `createDapp`, `deleteDapp`, `getDappByAddress` |
| `queries/events.ts` | `insertEvent`, `insertEventsBatch`, `getEvents`, `getEventNames`, `getEventCountSince` |
| `queries/metrics.ts` | `upsertMetricAggregate`, `getMetrics`, `getLatestAggregate` |
| `queries/alerts.ts` | `getAlertRules`, `getEnabledAlertRules`, `createAlertRule`, `deleteAlertRule`, `toggleAlertRule`, `insertAlertEvent`, `getAlertHistory`, `getLastAlertForRule`, `resolveAlert` |
| `queries/stylus-analytics.ts` | `getGasComparison`, `getGasComparisonTimeSeries`, `getTopStylusContracts`, `getStylusAdoptionStats` |
| `migrate.ts` | Drizzle migration runner |

### @arcana/collector (`packages/collector`)

The blockchain ingestion pipeline — all server-side data collection logic.

| File | Contents |
|------|----------|
| `index.ts` | Main loop — polling, concurrency guard, cron scheduling, aggregation triggers |
| `provider.ts` | `createProvider()` (ethers.js v6), `withRetry()` (exponential backoff, 5 retries) |
| `publisher.ts` | `publishBlock()`, `publishMetrics()`, `publishTransaction()` — Redis event broadcasting |
| `collectors/block-collector.ts` | `getStartBlock()` (chain mismatch detection), `collectBlockRange()` (parallel batches of 5) |
| `collectors/tx-collector.ts` | `processBlock()` — Stylus detection cache, dApp matching cache, method ID extraction, batch insert |
| `collectors/event-collector.ts` | `processBlock()` — ABI decoding (Transfer, Approval, Swap, Sync), indexed param extraction |
| `collectors/aggregator.ts` | `computeAggregates()`, `computeAll()` — windowed SQL aggregates (5m, 1h, 24h) |
| `collectors/alert-evaluator.ts` | `evaluate()` — cooldown checks, metric extraction, threshold comparison, Redis publish |

### @arcana/api (`packages/api`)

Fastify HTTP server with REST endpoints and WebSocket real-time feed.

| File | Contents |
|------|----------|
| `index.ts` | Server bootstrap — Fastify, CORS, WebSocket plugin, Redis connections, route registration |
| `types.ts` | `App` type definition (FastifyInstance with db + redisSub decorations) |
| `routes/health.ts` | `GET /health` |
| `routes/dapps.ts` | CRUD for dApps (`GET`, `POST`, `DELETE /api/dapps`) |
| `routes/metrics.ts` | `GET /api/dapps/:id/metrics`, `GET /api/metrics/global`, `GET /api/metrics/latest` |
| `routes/transactions.ts` | `GET /api/transactions`, `GET /api/transactions/:hash`, `GET /api/transactions/stylus/stats` |
| `routes/blocks.ts` | `GET /api/blocks`, `GET /api/blocks/:number`, `GET /api/blocks/stats` |
| `routes/alerts.ts` | CRUD + history for alerts (`GET`, `POST`, `PATCH`, `DELETE /api/alerts`) |
| `routes/events.ts` | `GET /api/events`, `GET /api/events/names`, `GET /api/events/stats` |
| `routes/stylus.ts` | `GET /api/stylus/gas-comparison`, `/timeseries`, `/contracts`, `/adoption` |
| `routes/search.ts` | `GET /api/search?q=` — tx hash, block number, or address lookup |
| `routes/ws.ts` | WebSocket route — subscribes Redis once, broadcasts to `Set<WebSocket>` clients |

### @arcana/dashboard (`packages/dashboard`)

Next.js 15 frontend with React 19, Recharts charts, and Tailwind CSS.

| File | Contents |
|------|----------|
| `app/layout.tsx` | Root layout — dark theme, AppShell wrapper |
| `app/page.tsx` | Overview — metric cards, charts, recent tx table, WebSocket live updates |
| `app/explorer/page.tsx` | Explorer — tabs (Transactions/Blocks/Events), filters, pagination |
| `app/dapps/page.tsx` | dApp list — add form, dApp cards with contract badges |
| `app/dapps/[id]/page.tsx` | dApp detail — per-dApp metrics, charts, events table |
| `app/stylus/page.tsx` | Stylus analytics — gas comparison, pie chart, time series, top contracts |
| `app/alerts/page.tsx` | Alerts — create rule form, active rules list, trigger history |
| `components/AppShell.tsx` | Layout shell — responsive sidebar, header with search bar, mobile hamburger |
| `components/ErrorState.tsx` | Reusable error card with retry button |
| `components/cards/MetricCard.tsx` | Metric display card with optional trend indicator |
| `components/charts/GasUsageChart.tsx` | Area chart — avg gas over time |
| `components/charts/TxThroughputChart.tsx` | Stacked bar chart — Stylus + EVM tx counts |
| `components/charts/ErrorRateChart.tsx` | Line chart — error rate percentage |
| `components/tables/RecentTxTable.tsx` | Recent transactions table with WebSocket refresh |
| `hooks/useMetrics.ts` | Fetches global + latest metrics, 30s auto-refresh |
| `hooks/useWebSocket.ts` | WebSocket client — typed handlers, auto-reconnect with exponential backoff |
| `lib/api.ts` | API client — 15+ fetch functions for all endpoints |

---

## Database Schema

### 7 Tables

```sql
-- Core data
blocks           -- indexed Arbitrum blocks
transactions     -- all processed transactions (tagged with dappId, isStylus)
dapps            -- registered dApp definitions with contract addresses

-- Analytics
metric_aggregates -- rolling aggregates (5m, 1h, 24h) per dApp + global
contract_events   -- decoded contract events for monitored dApps

-- Alerts
alert_rules      -- user-defined alert conditions
alert_history    -- triggered alert log
```

### Column Details

#### `blocks`
| Column | Type | Notes |
|--------|------|-------|
| block_number | bigint | PRIMARY KEY |
| block_hash | varchar(66) | |
| timestamp | timestamptz | |
| gas_used | bigint | |
| gas_limit | bigint | |
| tx_count | integer | |
| base_fee | bigint | nullable |

#### `transactions`
| Column | Type | Notes |
|--------|------|-------|
| tx_hash | varchar(66) | PRIMARY KEY |
| block_number | bigint | indexed |
| dapp_id | uuid | FK → dapps, nullable |
| from_address | varchar(42) | |
| to_address | varchar(42) | nullable (contract creation) |
| gas_used | bigint | |
| gas_price | bigint | |
| status | smallint | 1 = success, 0 = reverted |
| tx_type | smallint | EIP-2718 type |
| timestamp | timestamptz | indexed |
| input_size | integer | calldata byte length |
| is_stylus | boolean | indexed, default false |
| method_id | varchar(10) | first 4-byte selector |

#### `dapps`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PRIMARY KEY, auto-generated |
| name | varchar(255) | |
| contract_addresses | jsonb | string array |
| abi | jsonb | nullable, for event decoding |
| chain_id | integer | default 42161 |
| created_at | timestamptz | |

#### `metric_aggregates`
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PRIMARY KEY |
| dapp_id | uuid | nullable (null = global) |
| window | varchar(4) | "5m", "1h", "24h" |
| window_start | timestamptz | |
| avg_gas_used | numeric | |
| avg_gas_price | numeric | |
| tx_count | integer | |
| error_count | integer | |
| error_rate | numeric | 0.0 – 1.0 |
| avg_tx_speed | numeric | |
| unique_addresses | integer | |
| stylus_tx_count | integer | |

UNIQUE constraint on `(dapp_id, window, window_start)` — upserts on conflict.

#### `contract_events`
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PRIMARY KEY |
| dapp_id | uuid | FK → dapps |
| event_name | varchar(255) | e.g., "Transfer", "Swap" |
| tx_hash | varchar(66) | |
| block_number | bigint | |
| log_index | integer | |
| event_data | jsonb | decoded parameters |
| timestamp | timestamptz | |

UNIQUE constraint on `(tx_hash, log_index)`.

#### `alert_rules`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PRIMARY KEY |
| dapp_id | uuid | nullable (null = global) |
| metric | varchar(50) | gas_usage, error_rate, tx_throughput, tx_speed, stylus_ratio |
| condition | varchar(10) | "above" or "below" |
| threshold | numeric | |
| window | varchar(4) | |
| cooldown_minutes | integer | default 15 |
| enabled | boolean | default true |

#### `alert_history`
| Column | Type | Notes |
|--------|------|-------|
| id | bigserial | PRIMARY KEY |
| rule_id | uuid | FK → alert_rules (CASCADE delete) |
| triggered_at | timestamptz | |
| metric_value | numeric | actual value that triggered |
| threshold_value | numeric | rule threshold at trigger time |
| resolved_at | timestamptz | nullable |

---

## Collector Pipeline

The collector runs as a single Node.js process with a polling loop and cron-scheduled jobs.

### Main Loop (every 1 second)

```
1. getBlockNumber() from RPC
2. If no new blocks → skip
3. collectBlockRange(from, to) → fetch blocks in parallel batches of 5
4. For each block:
   a. processBlock() → classify txs, detect Stylus, match dApps, batch insert
   b. processBlock() → decode contract events for monitored dApps
   c. publishBlock() → Redis arcana:blocks channel
   d. publishTransaction() → Redis arcana:transactions channel (per tx)
5. computeAll("5m") → aggregate and publish metrics
```

### Cron Jobs

| Schedule | Job | Description |
|----------|-----|-------------|
| `*/5 * * * *` | 5-minute aggregation | Compute all 5m window aggregates + evaluate alerts |
| `0 * * * *` | Hourly aggregation | Compute 1h window aggregates |
| `0 0 * * *` | Daily aggregation | Compute 24h window aggregates |

### Concurrency Guard

A `collecting` boolean flag prevents overlapping collection cycles. If a batch takes longer than the poll interval (e.g., due to RPC rate limits), subsequent ticks are skipped until the current batch completes.

### Retry Logic

All RPC calls are wrapped in `withRetry()`:
- **Max retries**: 5
- **Backoff**: exponential (1s, 2s, 4s, 8s, 16s)
- **Retryable errors**: 429 (rate limit), TIMEOUT, SERVER_ERROR
- **Non-retryable errors**: thrown immediately

### Stylus Detection Cache

The TxCollector maintains an in-memory `Map<string, boolean>` cache of address → isStylus results to avoid repeated `eth_getCode` calls. Similarly, dApp contract address lookups are cached.

---

## API Reference

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Returns `{ status: "ok", service: "arcana-api", timestamp }` |

### dApps

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dapps` | List all registered dApps |
| `GET` | `/api/dapps/:id` | Get a specific dApp |
| `POST` | `/api/dapps` | Register a new dApp (body: `name`, `contractAddresses[]`, `chainId`) |
| `DELETE` | `/api/dapps/:id` | Delete a dApp |
| `GET` | `/api/dapps/:id/metrics?range=` | Per-dApp metrics time series |

### Metrics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/metrics/global?range=24h` | Global network metric time series (1h, 6h, 24h, 7d, 30d) |
| `GET` | `/api/metrics/latest?dappId=` | Latest 5m aggregate snapshot (omit dappId for global) |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/transactions?dappId=&limit=&offset=` | Paginated recent transactions |
| `GET` | `/api/transactions/:hash` | Single transaction by hash |
| `GET` | `/api/transactions/stylus/stats` | Stylus tx counts (total, 24h, 1h) |

### Blocks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/blocks?limit=&offset=` | Paginated recent blocks |
| `GET` | `/api/blocks/:number` | Single block by number |
| `GET` | `/api/blocks/stats` | Total indexed block count |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/events?dappId=&eventName=&txHash=&limit=&offset=` | Paginated contract events |
| `GET` | `/api/events/names?dappId=` | Distinct event names with counts |
| `GET` | `/api/events/stats` | Total event count |

### Stylus Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stylus/gas-comparison?range=` | Stylus vs EVM gas stats |
| `GET` | `/api/stylus/gas-comparison/timeseries?range=` | Time-bucketed gas comparison |
| `GET` | `/api/stylus/contracts?range=&limit=` | Top Stylus contracts by tx count |
| `GET` | `/api/stylus/adoption?range=` | Stylus adoption overview |

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/alerts?dappId=` | List alert rules |
| `POST` | `/api/alerts` | Create rule (body: `metric`, `condition`, `threshold`, `window`, `dappId?`, `cooldownMinutes?`) |
| `PATCH` | `/api/alerts/:id` | Toggle enabled/disabled |
| `DELETE` | `/api/alerts/:id` | Delete a rule |
| `GET` | `/api/alerts/history?ruleId=&limit=` | Triggered alert events |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/search?q=` | Auto-detects type: tx hash (0x + 64 hex), block number, or address (0x + 40 hex) |

### WebSocket

Connect to `ws://localhost:3001/ws`. Messages are JSON with this shape:

```json
{ "type": "arcana:blocks",       "dappId": null, "data": { ... }, "timestamp": 1711267200000 }
{ "type": "arcana:transactions",  "dappId": null, "data": { ... }, "timestamp": 1711267200000 }
{ "type": "arcana:metrics",       "dappId": null, "data": [ ... ], "timestamp": 1711267200000 }
{ "type": "arcana:alerts",        "dappId": "...", "data": { ... }, "timestamp": 1711267200000 }
```

On connect, clients receive: `{ "type": "connected", "data": { "message": "Connected to Arcana real-time feed" } }`

---

## Dashboard

### Pages

| Page | Route | Description |
|------|-------|-------------|
| **Overview** | `/` | Network-wide metric cards (txs, gas, errors, Stylus count), time-series charts (gas, throughput, error rate), unique address count, recent transactions table. Time range selector: 1h / 6h / 24h / 7d / 30d. Real-time WebSocket updates. |
| **Explorer** | `/explorer` | Three tabs: **Transactions** (filter by all/Stylus/reverted), **Blocks** (gas, tx count), **Events** (filter by event name). All paginated with prev/next controls. |
| **dApps** | `/dapps` | List of monitored dApps with contract address badges. Inline form to add new dApps. Click through to detail view. |
| **dApp Detail** | `/dapps/[id]` | Per-dApp metric cards, gas/throughput/error charts, and recent events table. |
| **Stylus** | `/stylus` | Stylus-specific analytics: gas comparison bar chart, tx distribution pie chart, gas time series, top Stylus contracts table, adoption stats. |
| **Alerts** | `/alerts` | Create alert rules (metric, condition, threshold, window). Active rules list with toggle/delete. Alert trigger history. |

### Components

| Component | Description |
|-----------|-------------|
| `AppShell` | Responsive layout — sidebar nav, header with search bar + live indicator, mobile hamburger |
| `MetricCard` | Stat display card with title, value, subtitle, optional trend and highlight |
| `GasUsageChart` | Recharts area chart — avg gas over time |
| `TxThroughputChart` | Recharts stacked bar — Stylus + EVM transaction counts |
| `ErrorRateChart` | Recharts line chart — error rate percentage |
| `RecentTxTable` | Transaction table with Arbiscan links, status/type badges, WebSocket auto-refresh |
| `ErrorState` | Error display with icon and retry button |

### Hooks

| Hook | Description |
|------|-------------|
| `useMetrics(range)` | Fetches global metrics + latest 5m aggregate. Auto-refreshes every 30s. |
| `useWebSocket(handlers)` | Typed WebSocket client. Handlers: `onTransaction`, `onBlock`, `onMetrics`, `onAlert`, `onMessage`. Auto-reconnect with exponential backoff (max 30s). Returns `{ connected }`. |

---

## Configuration

All configuration via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `ARBITRUM_RPC_URL` | `https://arb1.arbitrum.io/rpc` | Arbitrum JSON-RPC endpoint |
| `ARBITRUM_CHAIN_ID` | `42161` | 42161 = Arbitrum One, 421614 = Sepolia testnet |
| `DATABASE_URL` | `postgresql://arcana:arcana_dev@localhost:5432/arcana` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `API_PORT` | `3001` | API server port |
| `API_HOST` | `0.0.0.0` | API bind address |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Dashboard → API base URL |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3001` | Dashboard → WebSocket URL |
| `COLLECTOR_POLL_INTERVAL_MS` | `1000` | Block polling frequency |
| `COLLECTOR_BATCH_SIZE` | `10` | Max blocks per poll cycle |

### Docker Services

```yaml
# docker-compose.yml
services:
  postgres:  # PostgreSQL 16 Alpine — port 5432, volume: pgdata
  redis:     # Redis 7 Alpine — port 6379, volume: redisdata
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js >= 20, TypeScript 5.7, pnpm 9 workspaces |
| **Blockchain** | ethers.js v6 (Arbitrum JSON-RPC, static network, batch requests) |
| **Database** | PostgreSQL 16, Drizzle ORM (schema + queries + migrations) |
| **Cache/Pub-Sub** | Redis 7, ioredis |
| **API** | Fastify, @fastify/cors, @fastify/websocket |
| **Frontend** | Next.js 15, React 19, Recharts, Tailwind CSS, lucide-react icons |
| **Scheduling** | node-cron (5m, 1h, 24h aggregation jobs) |
| **Validation** | Zod (environment config) |
| **Dev Tooling** | tsx (TypeScript execution), concurrently (parallel dev servers), Docker Compose |

---

## How Stylus Detection Works

Arbitrum Stylus allows developers to write smart contracts in Rust, C, and C++ that compile to WASM. These contracts are deployed on-chain with a distinctive bytecode prefix:

```
0xEFF00000...
```

This is an EOF (Ethereum Object Format)-inspired marker that distinguishes Stylus WASM programs from standard EVM bytecode. Arcana's `TxCollector` calls `eth_getCode(address)` for each contract address encountered in transactions and checks for this prefix:

```typescript
export function isStylusBytecode(bytecode: string): boolean {
  return bytecode.toLowerCase().startsWith(STYLUS_BYTECODE_PREFIX);
}
```

Results are cached in memory (`Map<string, boolean>`) so each contract is only checked once per collector session.

At the RPC level, Stylus contracts are indistinguishable from EVM contracts — they use standard Solidity ABIs, appear in standard transaction receipts, and gas is reported in normal units. The internal "ink" to gas conversion is handled transparently by the Arbitrum runtime.

---

## Development Progress

### What's Been Built

**Phase 1 — Core Infrastructure** (`e499310`)
- pnpm monorepo with 5 packages (shared, db, collector, api, dashboard)
- PostgreSQL schema with 7 tables and Drizzle ORM migrations
- Full collector pipeline: block collection, transaction processing, Stylus detection, event decoding
- Aggregator with 5m / 1h / 24h windowed metrics
- Alert system with configurable rules and cooldowns
- Fastify API with 30+ REST endpoints
- WebSocket real-time feed via Redis pub/sub
- Next.js dashboard with overview, explorer, dApps, Stylus analytics, alerts pages
- Docker Compose for PostgreSQL and Redis

**Phase 2 — Dashboard Polish & WebSocket Integration** (`3c0d620`)
- Pagination controls on all explorer tables (transactions, blocks, events)
- Error states with retry buttons on every data-fetching component
- dApp events table on detail page
- WebSocket hooks with typed handlers and auto-reconnect
- Responsive sidebar with mobile hamburger toggle
- Search bar with real-time dropdown results

**Phase 3 — Critical Bug Fixes** (`4282688`)
- Fixed WebSocket message type mismatch (publisher used hardcoded strings, dashboard expected `REDIS_CHANNELS` constants)
- Fixed collector not publishing transactions to Redis (refactored `processBlock` to return `ProcessedTx[]`)
- Fixed WebSocket subscribing per-client instead of once (rewrote to subscribe at registration, broadcast to `Set<WebSocket>`)
- Fixed alert evaluator type mismatch

**Phase 4 — E2E Smoke Test & Stability** (`16db4cd`, `02cb471`)
- Fixed API search crash: `drizzle-orm` direct import violated pnpm strict isolation — moved to `@arcana/db` as `getTransactionsByAddress()`
- Fixed collector hanging: added concurrency guard to prevent overlapping `collectLoop` invocations overwhelming public RPCs
- Fixed collector chain mismatch: detect when DB blocks are ahead of chain (e.g., switched from mainnet to testnet) and reset
- Reduced parallel batch size from 10 → 5 to avoid public RPC rate limits
- Added always-on collection logging regardless of transaction count
- Trigger 5m aggregation immediately after each collection batch for instant metric updates
- End-to-end verification: collector → DB → API → WebSocket → dashboard all confirmed working

**Phase 5 — Live Data** (`edb152b`)
- Switched to Arbitrum One mainnet (public RPC) for real data
- Registered 6 major dApps: Uniswap, GMX V2, Aave V3, Camelot, SushiSwap, 1inch
- Verified live metrics flowing through dashboard (122+ txs/5m, 0.13M avg gas, 1.64% error rate, 100+ unique addresses)

### Commit History

```
edb152b Rewrite README with complete API reference and setup guide
02cb471 Trigger aggregation after each collection batch for live metrics
16db4cd Fix collector stability and API search crash from E2E smoke test
4282688 Fix critical WebSocket and real-time data pipeline issues
3c0d620 Add pagination, error states, dApp events, and WebSocket integration
e499310 Initial commit: Arcana - Stylus dApp Analytics Dashboard
```

---

## License

MIT

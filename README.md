# Arcana

Arcana is an analytics dashboard for Stylus contracts on Arbitrum One. It indexes chain activity, computes performance metrics, stores historical trends, and exposes everything through a Fastify API and a Next.js dashboard.

## Features

Arcana includes:

- live Arbitrum block, transaction, and event ingestion
- Stylus contract detection
- per-dApp and global metrics from indexed chain data
- historical backfill for newly monitored Stylus contracts
- dApp registry management
- alert rules and alert history
- explorer search for blocks, addresses, and transactions
- WebSocket publishing for live updates

## Architecture

```text
Arbitrum RPC
    |
    v
Collector ----> PostgreSQL
    |              |
    |              v
    +----> Redis -> API Server
                     |
                     +--> REST + WebSocket
                     |
                     v
                 Next.js Dashboard
```

## Monorepo Layout

| Package | Purpose |
| --- | --- |
| `@arcana/shared` | Shared config, constants, helpers, and types |
| `@arcana/db` | Drizzle schema, migrations, and query layer |
| `@arcana/collector` | Block ingestion, Stylus detection, backfill, aggregation, alerts |
| `@arcana/api` | Fastify REST and WebSocket server |
| `@arcana/dashboard` | Next.js dashboard UI |

## Stack

- TypeScript
- pnpm workspaces
- Fastify
- Next.js 15
- React 19
- Ethers v6
- Drizzle ORM
- PostgreSQL
- Redis
- Recharts
- Tailwind CSS

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local infrastructure

```bash
docker compose up -d
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

### 3. Configure environment

```bash
cp .env.example .env
```

The default `.env.example` values are already set up for the local Docker services and the public Arbitrum RPC.

### 4. Run migrations

```bash
pnpm db:migrate
```

### 5. Start the app

```bash
pnpm dev
```

## Staging Deployment

Arcana can be deployed as a multi-container staging stack with Docker Compose.

### 1. Create a staging env file

```bash
cp .env.staging.example .env.staging
```

Update `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` to the public API origin your staging users will reach in the browser. If you are testing on a single host first, the default `localhost` values are fine.
If you want to publish the API on a different host port without changing the container's internal bind port, change `API_PUBLIC_PORT`.

### 2. Build and start the staging stack

```bash
pnpm staging:up
```

This starts:

- PostgreSQL
- Redis
- the migration job
- the Fastify API
- the collector
- the Next.js dashboard

### 3. Inspect the stack

```bash
pnpm staging:ps
pnpm staging:logs
```

### 4. Shut it down

```bash
pnpm staging:down
```

## Useful Scripts

```bash
pnpm dev              # collector + api + dashboard
pnpm dev:collector    # collector only
pnpm dev:api          # api only
pnpm dev:dashboard    # dashboard only
pnpm build            # build all packages
pnpm lint             # typecheck all packages
pnpm staging:up       # build and start the staging docker-compose stack
pnpm staging:down     # stop the staging docker-compose stack
pnpm staging:logs     # tail staging service logs
pnpm staging:ps       # show staging service status
pnpm test:e2e         # seed data, build, and run Playwright smoke tests
pnpm db:migrate       # apply database migrations
```

## How Data Flows

1. The collector polls Arbitrum blocks and receipts.
2. Transactions are classified, including Stylus bytecode detection.
3. Monitored dApp contracts are matched from transaction targets and log addresses.
4. Raw transactions and decoded contract events are stored in Postgres.
5. The API derives dashboard metrics from indexed transactions and serves explorer, alert, and registry endpoints.
6. The dashboard renders global and per-dApp analytics, recent activity, and alerting state.

## Notes

- Arcana is currently optimized for Arbitrum One.
- Historical data appears gradually when a new monitored dApp is added because the collector performs a background backfill.
- A Playwright smoke suite covers the core browser flows and runs automatically on pushes and pull requests through GitHub Actions.
- The Docker staging stack builds all app services from the monorepo and runs migrations automatically before the API and collector start.

## License

MIT

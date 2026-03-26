# Arcana

Arcana is an analytics dashboard for Stylus contracts on Arbitrum One. It indexes chain activity, computes performance metrics, stores historical trends, and exposes everything through a Fastify API and a Next.js dashboard.

## MVP Scope

The current MVP includes:

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

Local endpoints:

- Dashboard: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001](http://localhost:3001)
- Health: [http://localhost:3001/health](http://localhost:3001/health)

## Useful Scripts

```bash
pnpm dev              # collector + api + dashboard
pnpm dev:collector    # collector only
pnpm dev:api          # api only
pnpm dev:dashboard    # dashboard only
pnpm build            # build all packages
pnpm lint             # typecheck all packages
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
- The project is functional as an MVP, but automated coverage is still light.

## License

MIT

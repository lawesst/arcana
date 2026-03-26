FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/collector/package.json packages/collector/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

COPY . .

RUN pnpm build

FROM build AS api
EXPOSE 3001
CMD ["pnpm", "--filter", "@arcana/api", "start"]

FROM build AS collector
CMD ["pnpm", "--filter", "@arcana/collector", "start"]

FROM build AS dashboard
EXPOSE 3000
CMD ["pnpm", "--filter", "@arcana/dashboard", "start", "--hostname", "0.0.0.0", "--port", "3000"]

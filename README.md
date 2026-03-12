# Beacon

Beacon turns valuable LLM explorations into structured inquiry objects that can be saved, matched, and routed to the right people.

## What Beacon Is

Beacon is a social layer for live inquiry in the LLM era.

Instead of losing high-value thoughts inside private chat threads, Beacon lets users:
- capture an exploration from an LLM session (`@Beacon this`)
- save it as a structured Beacon
- optionally open it to matching
- discover adjacent or complementary Beacons
- request intros

## MVP Scope

Current MVP focus:
- capture from LLM context through MCP
- draft review/edit before publish
- private-by-default Beacon storage
- per-Beacon matching toggle
- embedding + pgvector candidate retrieval
- simple intro request data flow

Out of scope for now:
- social feed
- full messaging UX
- complex privacy matrix

## Monorepo Structure

- `apps/web`: Next.js app (product UI + API routes)
- `apps/mcp`: MCP-compatible service for `@Beacon this`
- `packages/core`: shared domain types and API schemas
- `packages/db`: Drizzle schema and SQL migrations
- `packages/ai`: draft extraction + matching helpers
- `docs/`: architecture and foundation docs

## Tech Stack

- Next.js 15 + TypeScript
- Neon Auth (`@neondatabase/auth`) with Google + email OTP UI
- Postgres + pgvector
- Drizzle ORM
- OpenAI embeddings (configurable model)
- Docker Compose for local DB

## Local Development

### 1. Install

```bash
npm install
```

### 2. Configure env

Copy `.env.example` to `.env` and fill required values.

Minimum practical local set:
- `DATABASE_URL`
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_COOKIE_SECRET` (>= 32 chars)
- `BEACON_API_TOKEN`
- `OPENAI_API_KEY`

### 3. Start Postgres

```bash
npm run db:up
```

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Start apps

```bash
npm run dev:web
npm run dev:mcp
```

## `@Beacon this` Flow (Implemented)

1. MCP client calls `POST /tools/create_beacon_from_context` on `apps/mcp`.
2. MCP forwards context to web `POST /api/mcp/drafts` with `BEACON_API_TOKEN`.
3. Web persists a Beacon draft (`status='draft'`, `sourceType='mcp'`).
4. Response includes a `reviewUrl` (`/beacons/:id/review`).
5. User reviews, edits, and either:
   - saves draft
   - publishes Beacon (`status='saved'`, optional matching)
   - discards draft (`status='archived'`)

## Production Env Validation

Run this before production deploy:

```bash
npm run env:check:prod
```

This checks required production env vars for:
- Neon Auth base URL + cookie secret
- MCP token wiring
- OpenAI embedding config
- DB/app URLs

## Quality Gates

```bash
npm run typecheck
npm run build
```

## Deploy MCP to AWS (ECS/Fargate)

This repo includes a bootstrap script at `scripts/aws/setup-mcp-fargate.sh` that:
- builds and pushes `apps/mcp` Docker image to ECR
- creates/updates IAM task roles
- creates/updates `BEACON_API_TOKEN` in Secrets Manager
- creates/updates CloudWatch logs + ECS cluster/service/task definition
- uses default VPC/default subnets if `VPC_ID`/`SUBNET_IDS` are not set

Required environment variables:
- `AWS_REGION`
- `BEACON_API_URL` (your Vercel web URL, e.g. `https://your-app.vercel.app`)
- `BEACON_API_TOKEN` (must match web app env var)

Example:

```bash
AWS_REGION=us-east-1 \
BEACON_API_URL=https://your-app.vercel.app \
BEACON_API_TOKEN=replace-with-strong-token \
./scripts/aws/setup-mcp-fargate.sh
```

Optional overrides:
- `APP_NAME` (default `beacon`)
- `ENV_NAME` (default `prod`)
- `DESIRED_COUNT` (default `1`)
- `ASSIGN_PUBLIC_IP` (`ENABLED` by default)
- `ALLOWED_CIDR` (default `0.0.0.0/0` when public IP is enabled)
- `VPC_ID`, `SUBNET_IDS` (comma-separated), `SECURITY_GROUP_ID`

## Product Docs

- Manifesto: [`manifesto.md`](./manifesto.md)
- MVP spec: [`mvp_spec.md`](./mvp_spec.md)
- Architecture: [`architecture.md`](./architecture.md)
- Foundation notes: [`docs/foundation.md`](./docs/foundation.md)

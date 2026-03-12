# Beacon Foundations (MVP)

This repository now includes a practical scaffold for the architecture in `architecture.md`.

## Implemented baseline

- Monorepo structure with `apps/web`, `apps/mcp`, `packages/core`, `packages/db`, and `packages/ai`
- Shared domain model + validation in `@beacon/core`
- Matching and draft extraction helpers in `@beacon/ai`
- Drizzle schema + SQL migration scaffolding with pgvector in `@beacon/db`
- Next.js app shell with MVP routes and API handlers in `apps/web`
- Standalone MCP-compatible service scaffold in `apps/mcp`
- Matching pipeline now supports canonicalized text embeddings, pgvector candidate retrieval, weighted scoring, and persisted suggested matches
- MCP capture now persists real draft Beacons and routes users to a dedicated `/beacons/:id/review` screen

## Current assumptions

- Web auth uses Auth.js (NextAuth v5) with Google OAuth + email magic links
- Session persistence is handled through Drizzle adapter tables (`accounts`, `sessions`, `verification_tokens`)
- Match generation degrades gracefully when `OPENAI_API_KEY` is missing in non-production environments
- MCP service uses HTTP endpoint contract and is ready for full MCP transport integration
- Production env validation is available via `npm run env:check:prod`

## Suggested next implementation sequence

1. Move match refresh to background jobs (Inngest) for better write-path latency
2. Add intro notifications (Resend)
3. Add protected admin route with match regeneration controls
4. Add MCP transport auth hardening + per-user token management UI

# GigFinder

A Western European job-source comparison and follow-up website.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- Frontend managed workflow: `artifacts/gigfinder: web`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Job discovery uses public APIs; no database or provider secret is needed for the current feature.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend: `artifacts/gigfinder`
- Source directory and direct-search URL builders: `artifacts/api-server/src/lib/job-sources.ts`
- Public feed adapters, cache and filtering: `artifacts/api-server/src/lib/job-feeds.ts`
- API routes: `artifacts/api-server/src/routes/jobs.ts`
- API contract: `lib/api-spec/openapi.yaml`

## Architecture decisions

- Never fabricate job counts. Unknown or restricted source counts must remain null and be visibly separated from real zero matches.
- Feed counts are observed samples, never site-wide inventory; show scope and publisher delays.
- Full-time describes hours, not duration; do not infer permanent from full-time.
- Remotive permits only a few refreshes per day. Keep at least six hours between upstream refreshes and retain attribution/source links. Before horizontal scaling, make cache and request coordination shared and durable.
- Follow-up saves are browser-only in this version; no local authentication or account syncing is implied.

## Product

- Search available feeds by job title, city, industry and offer type.
- Compare source counts and browse the 25-board directory.
- Save job cards and source searches for follow-up.
- See README for coverage limitations and provider documentation.

## User preferences

- GigFinder focuses on Western Europe.

## Gotchas

- Regenerate clients after OpenAPI changes. Orval must target React Query v5.
- Shared browser client needs DOM iterable types for generated header handling.
- Use managed workflows for service environment and routing, never duplicate dev servers.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

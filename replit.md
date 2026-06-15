# LeptonPad

A premium multi-format content publishing platform where creators publish articles, audio, and video; readers pay per piece in USDC via Arc/x402; creators keep 95%.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/leptonpad run dev` — run the frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed categories and demo content
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + `@clerk/express` (auth middleware)
- Frontend: React 19 + Vite + TailwindCSS v4 + `@clerk/react@6.x`
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/` — Drizzle schema (`users`, `categories`, `content`, `payments`, `ai_suggestions`)
- `lib/api-spec/` — OpenAPI YAML + Orval codegen → `lib/api-zod/` (Zod schemas) + `lib/api-client-react/` (React Query hooks)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, users, categories, content, payments, earnings, AI pricing, stats)
- `artifacts/leptonpad/src/` — React frontend (App.tsx, pages/, components/)
- `scripts/src/seed.ts` — Database seed script

## Architecture decisions

- **Three visual worlds**: classical editorial homepage (paper bg, Playfair Display serif), dark platform (#0D0F14, gold+teal accents), cream reading mode (Lora serif). Each is a distinct CSS variable set.
- **Contract-first API**: OpenAPI YAML is the single source of truth. Orval generates Zod schemas for server validation and React Query hooks for the client.
- **x402 / Arc payments**: USDC micropayments per piece. 95%/5% split at smart contract level. Sub-500ms finality. Minimum price $0.000001.
- **Clerk auth via proxy**: `@clerk/express` middleware + proxy so the API server handles Clerk endpoints without frontend CDN dependency.
- **AI pricing agent**: Rule-based logic (no external API) calibrated against platform median metrics. Surfaces suggestions to creators on the earnings dashboard.

## Product

- **Homepage**: Classical editorial newspaper layout introducing the platform
- **Feed**: Dark platform view with content cards filtered by category and type
- **Content Detail**: Preview + unlock flow with USDC payment
- **Reading Mode**: Cream background, distraction-free long-form reading
- **Create**: Multi-step form to publish articles, audio, or video
- **Earnings Dashboard**: Revenue stats + per-piece breakdown + AI pricing suggestions
- **Settings**: Wallet address, category preferences, profile
- **Onboarding**: Category selection for new users

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `@clerk/react` must be `^6.x` to be compatible with `@clerk/shared@4.17.1` (which `@clerk/express` depends on). `5.x` uses different export names (`loadClerkUiScript` vs `loadClerkUIScript`) causing build failures.
- `clerkClient` from `@clerk/express` is a **pre-instantiated singleton**, not a factory. Use `clerkClient.users.getUser(id)` directly — do NOT call `await clerkClient()`.
- Seed content uses `creatorId: "system"` which won't resolve in Clerk. The enrichment function has a safe `catch` fallback that returns `"Creator"` for unknown IDs.
- Always run `pnpm --filter @workspace/db run push` after schema changes before restarting the API server.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

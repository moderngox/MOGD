# MOGᴰ

Male-only physique optimization system: training, nutrition, strength, progress and
adaptation. See [CLAUDE.md](CLAUDE.md) and [docs/](docs) for product, architecture and
safety decisions.

This is an independent repository with its own history, database, authentication,
credentials and deployment. It has no runtime dependency on SPIDRA — see
[docs/SPIDRA_MIGRATION.md](docs/SPIDRA_MIGRATION.md) for what was inspected and
selectively reused from it.

## Status

M0 Foundation only. No assessment, training, nutrition or adaptation features exist
yet — see [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for what lands in
each later milestone.

## Structure

```text
apps/
  web/      customer-facing Next.js app
  admin/    admin Next.js app (Dashboard, Users, Exercises, Media, Programs, AI Runs)
packages/
  db/       drizzle schema, migrations, database client
  domain/   domain module boundaries (business logic lands starting M1)
  ai/       provider-neutral structured-generation contract + run logging
  media/    R2 storage: private photos vs. public exercise media, kept separate
  ui/       minimal shared UI primitives (placeholder pending full design.md spec)
  shared/   auth config, env validation helpers
```

## Setup

Requires Node >= 20.9 and pnpm.

```bash
pnpm install
```

Copy each `.env.example` to `.env.local` in the same directory and fill in real values:

- `packages/db/.env.example` — `DATABASE_URL` (a local SQLite file by default; a Turso
  database for production, independent of any SPIDRA database).
- `packages/media/.env.example` — Cloudflare R2 credentials and two bucket names, one
  public (exercise media) and one private (user photos). Create a MOGᴰ-owned R2 account
  and buckets; never reuse SPIDRA's.
- `packages/ai/.env.example` — an independent Anthropic API key.
- `apps/web/.env.example`, `apps/admin/.env.example` — `AUTH_SECRET` (generate with
  `npx auth secret`) and `DATABASE_URL`. **Both apps must use the same `AUTH_SECRET`
  and point at the same database** — they share sessions via the database session
  strategy, not via a shared process. In production behind two different subdomains,
  also configure a shared cookie `Domain` (e.g. `.mogd.example.com`) in both apps' Auth.js
  cookie options — same-`localhost` dev doesn't need this since cookies ignore port.

Generate and apply the database schema:

```bash
pnpm --filter @mogd/db db:generate
pnpm --filter @mogd/db db:migrate
```

Run both apps:

```bash
pnpm dev:web     # http://localhost:3000
pnpm dev:admin   # http://localhost:3001
```

To reach the admin app, sign up via `apps/web`, then promote that account:

```bash
pnpm --filter @mogd/db db:promote-admin -- you@example.com
```

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Known gaps (tracked, not blocking M0)

- No sign-in rate limiting yet (SPIDRA's in-memory limiter was not ported — see
  docs/SPIDRA_MIGRATION.md). Add before any public exposure.
- `packages/ui` is intentionally minimal: design.md has no finalized token/typography
  spec yet, so no visual system has been invented ahead of it.

# MOGᴰ — SPIDRA Selective Reuse

## Independence

Create a fresh MOGᴰ repository with independent Git history, package metadata, database, migrations, authentication configuration, environment variables, API credentials, Cloudflare configuration, R2 storage, branding and deployments.

SPIDRA is read-only reference material. No runtime imports, submodule, package dependency, shared database or required SPIDRA service. MOGᴰ must build and run when the SPIDRA checkout is absent.

## Candidate reuse

Inspect before deciding. Potential candidates are generic assessment-step UX, form components, validation utilities, authentication scaffolding, admin shells/tables, responsive navigation, Cloudflare/R2 helpers, database helpers, canonical-ID patterns and exercise CRUD concepts.

Copy only small useful implementations into MOGᴰ, then rename, refactor and test them as independently owned code. A candidate list is not an assertion that those components exist or have been audited.

## Reject by default

Do not migrate SPIDRA branding, Swiss Medicine Ball specificity, rehabilitation/physiotherapy logic, session-role hierarchy, goal taxonomy, unnecessary mobility/performance abstractions, collaboration business logic, system prompts, old AI schemas, database migrations, user data or generated plans. Do not migrate SPIDRA media without explicit authorization.

Redesign AI contracts for MOGᴰ. Prefer rewriting a small helper over copying a large coupled module.

## Procedure

1. Identify the exact source component and the problem it solves.
2. Confirm MOGᴰ has the same requirement.
3. Inspect dependencies and domain assumptions.
4. Classify as reuse/refactor, rewrite, reject or create new.
5. Copy only when it reduces complexity.
6. Remove SPIDRA terminology, configuration and dependencies.
7. Add appropriate tests and record the result.
8. Verify independent build/run behavior.

## Migration map

Audit performed 2026-09-07 against `C:\Users\moder\Desktop\SPIDRA` (read-only). SPIDRA is a Next.js 16 app (drizzle-orm, next-auth v5 beta, @libsql/client, aws4fetch, Zod, Tailwind 4) built for a rehab/physiotherapy product ("trainees", session-role/review-discipline taxonomy). No code was imported live; every REUSE row below means a small file was copied out, renamed and rewritten as independently owned MOGᴰ code, then covered by new tests.

| SPIDRA source | MOGᴰ destination | Action | Reason / verification |
|---|---|---|---|
| `src/video/providers/r2-upload.ts` (AwsV4Signer-direct PUT/DELETE/presigned-URL helpers, incl. documented undici Content-Length workaround) | `packages/media/src/r2Client.ts` | **Reused** | Generic, domain-free R2 helper; copied logic and its documented AwsClient.fetch() bug workaround, stripped video/exercise-specific naming, generalized to accept any bucket, added a presigned-GET function (needed for private photos, absent in source). Covered by `packages/media/src/keys.test.ts`. |
| `src/video/providers/video-provider.ts` (provider-neutral interface + DI) | Not migrated in M0 | **Rejected (deferred)** | Pattern is sound but exercise-asset serving is M2 scope; re-evaluate then rather than build unused abstraction now. |
| `src/lib/auth/*`, `src/features/auth/*` (next-auth v5 Credentials provider, bcrypt, email-allowlist admin, in-memory rate limiter) | `packages/shared/src/auth/*` | **Rewritten** | Confirmed generic and domain-free by audit, but MOGᴰ uses a `role` column + database session strategy (via `@auth/drizzle-adapter`) instead of SPIDRA's JWT strategy + `ADMIN_EMAILS` allowlist, since two separate Next.js apps (web/admin) need to share one authorization source of truth. Independently written, not copied line-for-line. Covered by `requireAdmin.test.ts`, `registerUser.test.ts`. Rate limiting was not ported — flagged as a gap, see below. |
| `src/database/client.ts` (lazy-Proxy libsql singleton), `drizzle.config.ts`, `src/database/schema/_helpers.ts` (id/timestamp column conventions) | `packages/db/src/client.ts`, `packages/db/drizzle.config.ts` | **Rewritten (pattern reused)** | Singleton-on-first-use idea reused (avoids build-time DB connection); MOGᴰ uses a plain lazy accessor function rather than a Proxy, and integer epoch timestamps rather than ISO-string columns — a deliberate divergence, not an oversight. |
| `src/domain/exercise/*`, `src/domain/exercise-version/*` (identity table + versions table + partial-unique-active-index + pure lifecycle state machine + content-hash-for-review-integrity) | Not yet implemented (M2 scope) | **Rewrite planned** | Architecture pattern (stable identity separate from versioned/reviewable content) directly matches docs/ARCHITECTURE.md §7-8's requirement. None of the ~60 rehab-specific fields (`fatigueSensitivity`, `contraindications`, `sessionRoles`, review-discipline statuses) transfer. Revisit this row when M2 begins. |
| `src/features/exercise-admin/*` (draft/review/publish CRUD, ~23 files) | Not migrated | **Rejected** | Tightly coupled to SPIDRA's governed exercise taxonomy and multi-discipline review workflow; no generic CRUD scaffold to extract independent of the exercise-versioning pattern above. |
| `src/features/media-inbox/*` (transactional clip → identity → draft → video-row association workflow) | Not migrated | **Rejected (pattern noted for M2)** | Workflow shape (single-transaction association, never orphan a media row) is reasonable and will inform M2's manual-upload/approve/publish flow, but filename-guessing and camera-angle-pairing details are rehab-specific; nothing copied. |
| Any Seedance/AI-video-generation adapter | N/A | **N/A — does not exist in SPIDRA** | Audit grepped exhaustively; SPIDRA's only AI provider is a text-only Anthropic wrapper for coach copy. Confirms there is nothing to explicitly avoid reusing here, consistent with CLAUDE.md rule 7 (Seedance stays external to both codebases regardless). |
| `src/components/admin/*` (32 rehab-authoring widgets: `SafetyRulesEditor`, `EvidenceEditor`, `ExerciseDraftForm`, `PainReportRowActions`, etc.) | Not migrated | **Rejected** | 100% content-coupled to rehab exercise authoring; no generic table/widget primitive to lift. |
| `src/app/admin/layout.tsx` + `AdminSidebar.tsx`/`AdminMobileTabs.tsx` + `admin-nav-items.ts` config-array pattern | `apps/admin/src/lib/adminNav.ts`, `apps/admin/src/components/AdminSidebar.tsx`, `apps/admin/src/app/(dashboard)/layout.tsx` | **Rewritten (pattern reused)** | Config-array-driven nav + sidebar architecture reused; nav items rewritten from scratch to MOGᴰ's six admin areas (CLAUDE.md rule 10). No SPIDRA nav content, badge-counting logic, or component code copied. |
| `src/components/app-shell/*`, `src/components/navigation/*` (responsive shell, back-stack) | Not migrated in M0 | **Deferred** | Relevant to `apps/web`'s mobile-first customer shell, but that shell is M1+ scope (assessment/dashboard UI). Revisit then. |
| `src/components/assessment/fields/*` (`SegField`, `SliderField`, `BottomSheet`) | Not migrated in M0 | **Deferred, reuse candidate for M1** | Generic controlled-input primitives with no rehab coupling in the component code itself; relevant once M1 builds the assessment flow, not before. |
| `src/lib/validation/*`, `src/lib/api/*` | N/A | **N/A — confirmed empty in source** | Audit confirmed both directories exist but contain no files in SPIDRA; nothing to reuse. |
| `src/design-system/tokens/*`, `src/design-system/primitives/*` | N/A | **N/A — confirmed empty in source** | Same as above. The real token architecture lives in `src/app/globals.css` (CSS custom properties + Tailwind 4 `@theme inline` + `data-theme` toggle) — that *architecture pattern* is worth reusing once design.md's full spec exists, but its actual palette/typography values are SPIDRA-branded and were not copied. |
| `src/components/brand/Logo.tsx`, SPIDRA palette/typography values, "SPIDRA" name in code comments | N/A | **Explicitly rejected — branding** | Never migrate per docs/SPIDRA_MIGRATION.md "Reject by default" and CLAUDE.md rule 2. |
| SPIDRA `.env.local`, real credentials, `local.db`/`test.db` | N/A | **Explicitly rejected — not read** | Audit did not open `.env.local`; no credentials of any kind were copied. MOGᴰ has its own independent `.env.example` files per package (see below) and its own local SQLite file. |

### Known gap carried forward (not blocking M0)

SPIDRA's `rate-limit.ts` (in-memory per-process brute-force limiter on credentials sign-in, documented there as alpha-only/needs Redis at multi-instance scale) was not ported. MOGᴰ's M0 auth has no sign-in rate limiting yet. Add one before exposing sign-in publicly — track under M1 or M6 (operational readiness) rather than blocking foundation work on it.

The map above distinguishes reused, rewritten, rejected and newly created components, and will be extended as later milestones revisit the "Deferred"/"planned" rows.

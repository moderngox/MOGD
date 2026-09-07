# MOGᴰ — Claude Code Instructions

## Read first

Read this file and the relevant specifications before major implementation:
- [Product](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [AI and safety](docs/AI_AND_SAFETY.md)
- [SPIDRA migration](docs/SPIDRA_MIGRATION.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Design reference](design.md) for UI work.

These files consolidate decisions from Audit SPIDRA Variation and the workspace request. The design file is explicitly a placeholder. Example schemas and numerical values are illustrative; they do not establish approved physiological constants.

## Product and scope

MOGᴰ V1 is a male-only physique/recomposition application covering fat loss, muscle gain, strength, training, nutrition, progress and adaptation. Its core is the persistent user model:

ASSESS → MODEL → PLAN → EXECUTE → TRACK → ADAPT.

Do not implement grooming, style, wardrobe or other future appearance modules now. Preserve clean domain boundaries for later extension. This is not a medical or rehabilitation product.

## Mandatory architecture rules

1. Create an independent repository, history, database, migrations, authentication, environment, credentials, Cloudflare/R2 configuration and deployment. No SPIDRA runtime imports, submodule, shared database or dependency.
2. Inspect SPIDRA read-only and selectively reuse generic primitives only after documenting the decision. Refactor copies into MOGᴰ. Do not migrate SPIDRA domain logic, data, branding or media without specific authorization.
3. Prefer a modular monolith, typed contracts, thin handlers and domain logic outside UI components. Persist validated state rather than AI prose.
4. Nutrition calculations and safety bounds must be deterministic, documented and tested. AI may explain them but cannot override them.
5. Training follows profile → strategy → weekly targets → split → candidates → session allocation → progression → validation → program.
6. Use stable canonical exercise IDs. Generated plans must resolve active catalog records. Separate exercise identity from versioned media.
7. Seedance generation stays external: specification → external Claude/Seedance workflow → human review → approved MP4 → manual admin upload → R2 → exercise asset. No runtime Seedance API, adapter, polling, webhook, generation queue or automatic publication.
8. AI outputs require structured schemas, canonical-ID resolution and deterministic/safety validation before persistence. Isolate provider adapters, version prompts/schemas and log AI runs. Reject invalid output explicitly.
9. Keep private user photos separate from exercise demonstrations; enforce authorization, consent, deletion and retention. Do not expose private photos through public URLs or unnecessarily sensitive logs.
10. Keep admin limited to Dashboard, Users, Exercises, Media, Programs and AI Runs. Prompts live in Git; no prompt-editor CMS.
11. Persist current validated results. Dashboard loads must not regenerate plans. Preserve history and reasons for adaptations.

## Working procedure

Inspect existing code, schemas and tests before a major change. Explain material architectural deviations before implementing them. Add meaningful tests for business rules and update relevant docs. Do not silently coerce invalid state.

Follow design.md for the confirmed visual direction; it does not replace the missing full design specification.

## Initial execution boundary

For repository initialization, inspect SPIDRA, complete the migration map in docs/SPIDRA_MIGRATION.md, create the independent repository and implement M0 Foundation only. Then stop and report what was reused, rewritten, rejected and created. Later milestones require a subsequent implementation instruction.

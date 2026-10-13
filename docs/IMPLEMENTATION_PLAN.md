# MOGᴰ — Implementation Plan

## Execution boundary

This workspace contains instructions only. It does not implement or deploy the application.

For initial repository creation: inspect SPIDRA read-only, complete the migration map, create the independent MOGᴰ repository, implement M0 Foundation only, then stop and report reused, rewritten, rejected and new components. Do not automatically proceed to later milestones.

The sequence below operationalizes the validated architecture. Detailed milestone grouping is a delivery plan, not a claim that every label was recovered verbatim from the discussion.

## M0 — Foundation

- Audit candidate SPIDRA reuse and document decisions.
- Initialize fresh repository, package metadata and independent configuration.
- Establish web/admin shells and domain, db, ai, media, ui and shared boundaries.
- Set up independent authentication and server-side admin authorization.
- Establish schema/migration tooling and test/build checks.
- Define separate private-photo and exercise-media storage configuration.
- Add provider-neutral AI contract and run-record foundation without feature generation.
- Keep secrets out of source control and provide configuration documentation.

Exit: independent build and checks pass; no SPIDRA runtime dependency; migration map and setup instructions are reviewable. Stop and report.

## M1 — Assessment and persistent user state

Implement registration, compact structured assessment, goals, up to three physique priorities, physical/training/nutrition profiles, availability/equipment and bounded optional notes. Support optional front/side photos with consent and private storage.

The wizard autosaves a per-user draft (`assessment_draft`: step index + non-photo form state) on each step transition, so a user who leaves mid-assessment resumes silently at their last step on return instead of restarting. Photos aren't part of the draft — `File` objects can't survive a session — so a resumed session at the photos step re-prompts for upload. The draft is deleted once an eligible submission is durably persisted; it's kept on an ineligible rejection so the user can correct and resubmit. This mirrors SPIDRA's draft/resume pattern functionally (docs/SPIDRA_MIGRATION.md) but is freshly implemented per CLAUDE.md's SPIDRA-reuse rule — a single draft row per user rather than SPIDRA's per-answer table and resumable per-step routes, since MOGᴰ's wizard is one component rather than routed steps.

Exit: validated assessment persists, unauthorized access is rejected, users can complete onboarding without photos, eligibility rules prevent unsupported plan generation, and a user who leaves mid-assessment can resume from their last completed step.

## M2 — Exercise catalog and reviewed media

Create stable canonical exercise records and useful programming metadata. Implement admin exercise CRUD and separate versioned assets. Implement manual MP4 upload, preview, approval/publication, replacement and archival.

Exit: only approved assets are published; media replacement preserves exercise identity and historical references. No Seedance runtime integration.

## M3 — Strategy and deterministic nutrition

Implement goal compilation and documented/tested nutrition functions, target validation, persistence, basic guidance and adherence inputs. Review actual formulas and bounds before enabling automatic recommendations.

Exit: repeatable calculations, explicit assumptions and invalid-input/boundary tests pass. AI cannot override targets.

## M4 — Constrained training and execution

Implement restrained templates, weekly targets, candidate filtering, session allocation, progression and final program validation. Add workout views, approved videos, set logging, prior performance and progression targets.

Exit: plans fit schedule/equipment/restrictions and resolve active canonical exercises; logging persists and progression obeys the configured rep/load rules.

## M5 — Progress, check-ins and adaptation

Implement weight/waist trends, adherence, recovery/performance signals, optional progress photos, weekly check-ins and bounded plan adjustments. Preserve adjustment history and reasons.

Exit: adaptation distinguishes adherence from intervention failure, remains within safety limits and preserves previous valid state on failure.

## M6 — AI assistance and operational readiness

Integrate structured AI where useful, provider adapters, versioned prompts/schemas, validation and run inspection. Complete six admin areas. Verify privacy, deletion, retention, access controls and failure behavior across the end-to-end loop.

Exit: malformed outputs, unavailable providers and unsafe suggestions fail safely; operational errors are inspectable without exposing unnecessary sensitive data.

## Alpha acceptance

A user can register, complete assessment, optionally supply two photos, receive a strategy, nutrition targets and weekly workouts, watch approved demonstrations, log workouts, see previous performance/progression, complete a check-in and receive justified adaptation.

Admin can inspect users/programs, manage exercises, upload and approve externally reviewed media, and inspect AI runs/errors.

## Deferred scope

Do not implement grooming, hair/beard/skin modules, style, wardrobe or presentation now. Preserve domain boundaries for later expansion.

Also defer full food databases, barcode scanning, meal-photo recognition, social networks, wearables, realtime pose/form coaching, precise photo body-fat measurement, attractiveness ratings, cosmetic procedures, supplement marketplaces and automated Seedance generation.

## Validation practice

Test deterministic nutrition, goal compilation, exercise filtering, program constraints, progression, adaptation and AI validation. Cover private-media/admin authorization and deletion. Perform an end-to-end assessment → plan → workout → check-in → adjustment check. Update relevant docs with significant logic changes.

## Programming engine — accepted deviations and open decisions

Recorded after the Oct 2026 audit and recheck, so each is a decision on the record rather than a silent omission. Closed since: actual-RIR capture, the workout-session occurrence record, equipment-aware history, role constraints on every branch, superset pairing, configurable role rules, independent validation of final prescriptions and recommendations, convergent concurrent set logging, explicit role eligibility, structured restriction matching (mechanism), recalibration on changed sets/rest/role, assisted loads and a review view for unreviewed default profiles.

**Accepted deviation — individualized targets are computed when the workout starts, not at program generation.** The original spec's generator step applies history and persists an individualized prescription with the program. Here, generation persists the contextual (profile + role) prescription, and the load recommendation is computed when the athlete's first set starts an occurrence and snapshotted then. Reason: history can change between generating a program and performing the workout, so a recommendation fixed at generation goes stale. Reverting means moving that computation into `generateProgram` and accepting stale targets.

**Decided, content pending — structured restriction matching.** The mechanism exists: an admin-managed `restriction_category` taxonomy, athlete-selected keys on the assessment, a candidate filter and an independent validator check. The taxonomy ships empty because `docs/AI_AND_SAFETY.md` says clinical categories must not be invented, so **no athlete is filtered until reviewed categories are added** (admin: Exercises → Restrictions, then tick them on exercises). Still open is only the content: a reviewed list of categories, and tagging the catalog against it. Free-text limitation notes remain stored-only. A program already generated is not re-filtered when restrictions change; regeneration (which assessment resubmission triggers) applies them.

**Decided — a changed prescription holds the load, it does not reset it.** A changed rep or RIR range still returns `CONTEXT_CHANGED` with no kg. A changed set count, rest or role (same rep/RIR range) returns `PRESCRIPTION_CHANGED`: repeat the last working load, no increase or reduction that session. Resetting the load instead was rejected because a single role-rules edit would then wipe every athlete's loads. Cost: each affected athlete gets one no-increase session of that exercise after such an edit. An unknown role (older slots) is never counted as a change.

**Decided — assisted exercises are a load type.** `exercise.loadType` is `external` (default) or `assisted`. For assisted work the logged kg is the assistance, so `INCREASE_LOAD` lowers it and `REDUCE_LOAD` raises it; the validator checks the direction independently and ties for the working load go to the harder setting. Still deferred: per-machine identity (needs its own entity inside a location).

**Decided — role eligibility is explicit.** Every exercise lists at least one allowed role; an empty list is invalid state, rejected at the write boundary and re-checked by the candidate pool and validator, never coerced to accessory. Migration 0020 moved previously empty lists to `["accessory"]` (which is exactly how they already behaved, so no program changed), and the engine no longer emits `NO_CONFIG_DEFAULT_ACCESSORY` (kept in the database enums only for already-generated rows). New exercises default to accessory-eligible. No database CHECK constraint, because SQLite can't add one without rebuilding the heavily-referenced `exercise` table.

**Closed, unrecoverable — legacy rep bounds.** The profile migration dropped the old `defaultRepMin/Max` before the backfill ran, and no copy exists (not in git, seeds or any database), so existing exercises hold generic inherited defaults (marked `isInheritedDefault`). They are now visible instead of silent: the admin Dashboard counts exercises with an unreviewed level, and the exercise list has a Profiles badge and a "Default profiles" filter. Saving a level clears its flag. The lesson, for future migrations: backfill before dropping a column.

**Still deferred — edge cases that need a product rule first:** left/right side tracking for unilateral work, long-gap detraining, deload weeks, skipped/substituted exercises, manual override of a recommendation, and per-machine (rather than per-location) equipment identity.

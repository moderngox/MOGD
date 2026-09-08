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

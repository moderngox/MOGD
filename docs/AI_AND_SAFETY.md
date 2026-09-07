# MOGᴰ — AI and Safety

## AI authority and boundaries

AI assists assessment interpretation, goal strategy, constrained planning, explanations, meal examples and check-in interpretation. Persisted validated domain state is authoritative. Free-form Markdown is never a canonical program, nutrition target or user profile.

Organize packages/ai into providers, prompts, schemas, tools, validators and logging. Domain code depends on a provider-neutral structured-generation interface; vendor SDKs and model-specific behavior stay in adapters. Provider selection is replaceable. This abstraction does not include Seedance, which remains outside runtime.

## Structured contracts

Use Zod, JSON Schema or equivalent for PhysiqueAssessment, GoalStrategy, ProgramStrategy, ProgramGeneration, CheckInAnalysis and CoachResponse. Version prompts and schemas in code.

Before persistence or execution:
1. Validate output structure and types.
2. Resolve exercise references to existing active canonical records.
3. Validate equipment, restrictions, duration, volume, progression and nutrition bounds using domain code.
4. Apply safety validation.
5. Persist only the accepted result and its provenance.

Reject invalid output explicitly. Do not silently coerce broken output or accept invented IDs. Failures must be visible in run records and must leave the last valid plan intact.

Expose deterministic tools where useful: getUserProfile, getExerciseCandidates, calculateNutritionTargets, getCurrentProgram, getProgressHistory, calculateWeeklyVolume and validateProgram. The model can orchestrate these tools but cannot override their hard constraints.

## Nutrition and adaptation

BMR, TDEE, energy targets, protein targets, fat minima, carbohydrate targets and adjustment bounds belong to deterministic, documented, tested functions. AI may explain their results and personalize examples. It must not silently change the numbers.

Adaptation combines trends, adherence, current strategy and plan, deterministic adjustment rules, optional AI interpretation and final validation. Distinguish poor adherence from an ineffective intervention. Persist the reason for each change.

The conversation establishes architecture, not final clinical thresholds or formulas. Define and review numerical safety policies before enabling automatic target generation; do not mistake illustrative values for approved constants.

## AI run logging

Record from the first AI integration:
- Run ID, optional user ID and purpose.
- Provider/model, prompt version and schema version.
- Input hash/reference.
- Validated structured output where appropriate.
- Validation status and error classification.
- Latency, estimated cost when available and timestamp.

Keep enough metadata to debug behavior without retaining unnecessary sensitive raw inputs. Redact secrets and avoid raw photos, unrestricted photo URLs or full sensitive prompts in ordinary logs. Define access, deletion and retention rules explicitly.

Prompts remain in version-controlled code. Admin may inspect versions and runs; no Alpha prompt-editing CMS. Generate on meaningful assessment/check-in/coaching actions, not on every dashboard view.

## Safety layers

Safety must combine UI notices and consent, deterministic eligibility rules, model constraints, schema validation and output validation. Keep rules in a dedicated safety domain module.

Handle requests outside scope, including dangerous weight-loss timelines, extremely low body weight, severe injury, recent major surgery, serious medical limitations, eating-disorder-related requests and minors. Explain the limitation and direct the user to appropriate professional guidance instead of improvising treatment.

V1 is a male-only physique product, not rehabilitation, physiotherapy or medical care. User goals and optional text cannot bypass eligibility or safety limits. Do not introduce future-scope pathways as V1 features.

## Photos and body image

Front and side photos are optional secondary inputs. Use broad observations, explicit uncertainty and longitudinal comparisons. Do not present exact photo-derived body-fat percentages, diagnoses, attractiveness scores or universal ideal-body judgments. Weight, waist, performance and adherence trends drive adaptation.

## Privacy and access

Physique photos, measurements and assessments are private. Separate private user media from approved exercise demonstration assets. Store binaries in object storage and metadata in SQL.

Authorize private media access server-side; do not expose unrestricted public URLs. Restrict admin access to legitimate operational needs. Define consent for processing/photos and provider transmission, retention periods, account/media deletion and access controls before production. Remove private objects and associated records according to that policy.

Treat optional user text and model output as untrusted input, with bounded inputs and server-side validation. Keep credentials server-side and out of logs.

## Verification

Test schema rejection, invented/inactive exercise IDs, constraint violations, unsafe target changes, provider errors, private-media authorization, deletion and admin access. Verify that failed AI runs cannot publish invalid programs or overwrite valid current state.

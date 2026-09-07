# MOGᴰ — Technical Architecture

## 1. Repository structure

Recommended:

```text
mogd/
│
├── apps/
│   ├── web/
│   └── admin/
│
├── packages/
│   ├── db/
│   ├── domain/
│   ├── ai/
│   ├── media/
│   ├── ui/
│   └── shared/
│
├── docs/
├── CLAUDE.md
├── design.md
└── README.md
```

Avoid premature microservices.

Prefer a modular monolith for Alpha.

---

# 2. Domain modules

Recommended:

```text
packages/domain/
├── users/
├── assessment/
├── physique/
├── training/
├── nutrition/
├── exercises/
├── programs/
├── progress/
├── checkins/
├── adaptation/
└── safety/
```

Future modules may eventually include:

```text
grooming/
style/
wardrobe/
presentation/
```

Do not implement them yet.

---

# 3. User state

Conceptual model:

```text
User
├── Profile
├── Assessment
├── PhysiqueGoals
├── TrainingProfile
├── NutritionProfile
├── Measurements
├── Photos
├── Programs
├── WorkoutLogs
├── CheckIns
└── PlanAdjustments
```

Avoid one giant untyped JSON profile.

Persist canonical state.

---

# 4. Application-layer flow

UI components should not contain business logic.

Prefer:

```text
UI
↓
Application Service
↓
Domain
↓
Repository / Provider
```

Possible services:

```text
submitAssessment()
generateInitialStrategy()
generateProgram()
logWorkoutSet()
completeWorkout()
submitCheckIn()
adaptPlan()
uploadExerciseAsset()
```

HTTP handlers should remain thin.

---

# 5. Goal compilation

User labels must be normalized into strategy.

Example:

```json
{
  "primaryGoal": "recomposition",
  "priorityMuscles": [
    "lateral_deltoids",
    "lats",
    "upper_chest"
  ],
  "energyDirection": "slight_deficit",
  "trainingBias": {
    "hypertrophy": 0.75,
    "strength": 0.25
  }
}
```

The user-facing goal is not sufficient to build the complete program.

---

# 6. Muscle model

Initial canonical groups:

```text
upper_chest
mid_chest

lats
upper_back
traps

anterior_deltoids
lateral_deltoids
posterior_deltoids

biceps
triceps
forearms

quadriceps
hamstrings
glutes
calves

rectus_abdominis
obliques
```

Keep the model restrained.

---

# 7. Exercise ontology

Every exercise uses a stable canonical ID.

Examples:

```text
incline_dumbbell_press
cable_lateral_raise
neutral_grip_lat_pulldown
romanian_deadlift
bulgarian_split_squat
```

Possible model:

```ts
interface Exercise {
  id: string;
  canonicalId: string;
  name: string;

  movementPattern: string;

  difficulty: string;

  primaryMuscles: string[];
  secondaryMuscles: string[];

  equipment: string[];

  hypertrophyScore?: number;
  strengthScore?: number;
  fatigueScore?: number;
  stabilityDemand?: number;

  defaultRepMin?: number;
  defaultRepMax?: number;

  contraindicationTags: string[];

  instructions?: string;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

Only add programming metadata that the engine genuinely uses.

---

# 8. Exercise assets

Exercise identity and exercise media are different entities.

```ts
interface ExerciseAsset {
  id: string;
  exerciseId: string;

  type: "video" | "thumbnail";

  provider?: string;
  generationModel?: string;

  objectKey: string;

  version: number;

  status:
    | "draft"
    | "approved"
    | "archived";

  validationNotes?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

A video may be replaced without changing the exercise identity.

---

# 9. Media storage

Use R2/object storage for binary media.

SQL stores metadata.

Separate:

PUBLIC/DELIVERABLE:
- exercise demonstration videos

PRIVATE:
- assessment photos
- progress photos

Private user images must not use unrestricted public URLs.

---

# 10. Training engine

Preferred pipeline:

```text
UserProfile
↓
GoalStrategy
↓
WeeklyVolumeTargets
↓
TrainingSplit
↓
ExerciseCandidatePool
↓
SessionAllocation
↓
ProgressionStrategy
↓
ProgramValidator
↓
Program
```

Training generation must respect:

- frequency
- duration
- available equipment
- experience
- constraints
- muscle priorities
- recovery
- volume
- progression

---

# 11. Training templates

Start with a restrained template library.

Examples:

```text
Full Body
Upper / Lower
Push / Pull / Legs
Upper / Lower / Upper
Push / Pull / Legs / Upper
```

Do not allow arbitrary novelty to replace programming coherence.

---

# 12. Core training variables

At minimum:

- weekly frequency
- muscle weekly volume
- muscle frequency
- exercise selection
- sets
- rep ranges
- RIR
- rest
- strength exposure
- hypertrophy exposure
- fatigue cost
- equipment
- progression

Avoid advanced periodization complexity until justified.

---

# 13. Program hierarchy

Conceptually:

```text
Program
└── Phase
    └── Week
        └── Workout
            └── WorkoutExercise
```

Not every hierarchy level must become a table immediately if unnecessary.

Model according to actual query and persistence requirements.

---

# 14. Workout logs

Persist:

- user
- workout
- exercise
- set number
- load
- reps
- RIR when collected
- completion
- timestamp

Previous exercise performance should be available to future sessions.

---

# 15. Progression

Prefer deterministic progression where possible.

Example:

```text
Previous:
30 kg × 10

Target:
30 kg × 11–12

Once rep ceiling is consistently reached:
increase load
```

Exact progression systems may vary by exercise/program.

Do not ask the LLM to rediscover progression rules during every workout.

---

# 16. Nutrition engine

Create deterministic domain functions such as:

```ts
estimateBMR()
estimateTDEE()
deriveEnergyTarget()
deriveProteinTarget()
deriveFatMinimum()
deriveCarbohydrateTarget()
validateNutritionTarget()
```

Formula assumptions must be documented.

All functions require unit tests.

---

# 17. Check-ins

Check-in state can include:

```text
averageWeight
waist
trainingAdherence
nutritionAdherence
hunger
energy
recovery
performanceSignal
notes
photos
```

Normalize where practical.

---

# 18. Adaptation engine

Pipeline:

```text
Progress History
+
Current Check-In
+
Goal Strategy
+
Current Plan
↓
Trend Calculations
↓
Deterministic Adaptation Rules
↓
Optional AI Interpretation
↓
Safety Validation
↓
Plan Adjustment
```

Persist plan adjustments and reasons.

---

# 19. Recommended database tables

Initial candidates:

```text
users
profiles

assessments
assessment_photos

physique_goals
training_profiles
nutrition_profiles

body_measurements
progress_photos

exercises
exercise_muscles
exercise_equipment
exercise_assets

programs
program_phases
program_weeks

workouts
workout_exercises
exercise_logs

nutrition_targets

checkins
plan_adjustments

ai_runs
```

Do not create every candidate table before real schema design.

Normalize deliberately.

---

## 20. Admin application

Keep six operational areas:
- Dashboard: users, active programs, exercise count, missing media, recent uploads and AI failures.
- Users: primarily read-only inspection of profiles, assessments, strategy, programs, measurements and check-ins.
- Exercises: manage canonical records, muscles, equipment, difficulty, rep defaults, useful programming metadata, instructions and active status.
- Media: select exercise → upload MP4 → preview → approve → publish; support replace, unpublish and archive.
- Programs: inspect goal strategy, nutrition targets, workouts, validation results and adjustments.
- AI Runs: inspect purpose, provider/model, prompt/schema version, validation status, latency, estimated cost and errors.

Human visual review is mandatory before video publication. Seedance production remains external. Do not implement generation API calls, adapters, queues, polling, webhooks or automatic publication.

Prompts remain version-controlled code; do not build an admin prompt editor or generic CMS. Enforce server-side admin authorization and protect sensitive user views.

## 21. AI and persistence

Use provider adapters and structured schemas described in [AI_AND_SAFETY.md](AI_AND_SAFETY.md). Persist validated outputs and current plans; dashboard loads and workout execution must not trigger unnecessary generation. Keep prompts, schemas and run metadata versioned.

Recommendation reasons must reflect actual inputs and rules. Preserve prior plans, workout history and adjustment reasons when replacing current targets. A failed generation must not replace a valid current plan.

## 22. Future extensibility

Keep identity, assessment, media and AI infrastructure separate from physique-specific logic. Grooming, style, wardrobe and presentation can become separate domain modules later. Do not create their tables, routes, questionnaires, prompts or services in V1. Avoid speculative generic optimization frameworks.

## 23. Interpretation of examples

Structures and numerical examples above are illustrative, not fixed medical prescriptions or a final database schema. Progression targets must respect the active exercise's configured rep range; when its ceiling is reached, apply the configured load progression instead of prescribing repetitions beyond that range.

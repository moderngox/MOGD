# MOGD — Exercise Relationship Data Model & Admin Instructions

## Objective

Implement explicit exercise-to-exercise relationships without disrupting the existing exercise catalogue.

---

## 1. Suggested data model

Adapt naming/types to the current codebase and database conventions.

Conceptual model:

```text
ExerciseRelationship
--------------------
id
source_exercise_id
target_exercise_id
relationship_type
created_at
updated_at
```

Relationship enum:

```text
PROGRESSION
REGRESSION
VARIATION
ALTERNATIVE
```

Optional future fields — **do not add unless needed now**:

```text
priority
confidence
notes
conditions
```

Avoid premature complexity.

### Constraints

At minimum:

```text
source_exercise_id != target_exercise_id

UNIQUE(
  source_exercise_id,
  target_exercise_id,
  relationship_type
)
```

Both exercise IDs must reference valid exercises.

Prevent duplicate logical inverse relationships where automatic inversion is enabled.

---

## 2. Inverse relationship behavior

Define:

```text
inverse(PROGRESSION) = REGRESSION
inverse(REGRESSION)  = PROGRESSION
inverse(VARIATION)   = VARIATION
inverse(ALTERNATIVE) = ALTERNATIVE
```

If the persistence model stores only canonical edges, derive inverse edges at query/service level.

If the existing architecture makes physical bidirectional rows preferable, create/delete/update them transactionally so they cannot diverge.

**Prefer a single source of truth.**

Example admin action:

```text
Pull-up
Progression: Weighted Pull-up
```

Expected engine-visible result:

```text
Pull-up         --PROGRESSION--> Weighted Pull-up
Weighted Pull-up --REGRESSION--> Pull-up
```

---

## 3. Admin UI

Extend the existing exercise editor with a `Relationships` section.

Suggested UI:

```text
RELATIONSHIPS

Progressions
[ + Add exercise ]
Weighted Pull-up                         [×]

Regressions
[ + Add exercise ]
Assisted Pull-up                         [×]
Australian Pull-up                       [×]

Variations
[ + Add exercise ]
Wide-grip Pull-up                        [×]
Neutral-grip Pull-up                     [×]

Alternatives
[ + Add exercise ]
Lat Pulldown                             [×]
```

Requirements:

- searchable/autocomplete exercise selector;
- exclude the current exercise;
- prevent duplicate relationships;
- display existing relationships;
- allow removal;
- inverse relationships appear automatically;
- do not require manual creation of both progression/regression edges;
- preserve the current exercise creation/edit workflow;
- avoid adding numeric muscle weights to this UI.

---

## 4. Muscle weighting

Existing muscle roles remain catalogue metadata.

Example relational structure if not already equivalent:

```text
ExerciseMuscle
--------------
exercise_id
muscle_id
role: PRIMARY | SECONDARY
```

Recommendation configuration may initially map:

```text
PRIMARY   -> 1.0
SECONDARY -> 0.5
```

Do not persist `1.0` or `0.5` repeatedly against each exercise/muscle relation.

This allows coefficients or a future `STABILIZER` role to change without migrating the catalogue.

---

## 5. Session role belongs to prescriptions

If session roles are introduced, attach them to the generated workout item rather than the canonical exercise.

Conceptual example:

```text
WorkoutExercise
---------------
workout_id
exercise_id
session_role
sets
rep_min
rep_max
load
order
...
```

Possible initial enum:

```text
PRIMARY
ACCESSORY
SUPERSET
FINISHER
WARMUP
```

Do not assume an exercise has one intrinsic role.

---

## 6. Recommendation-engine behavior

Pseudo-logic:

```text
function selectExercise(context):
    candidates = filterCatalogue(
        contraindications,
        equipment,
        requiredMovementPatterns,
        userCapability
    )

    for candidate in candidates:
        score = 0

        score += muscleRelevance(candidate, context.targets)
        score += goalSuitability(candidate, context.goal)
        score += movementPatternFit(candidate, context)
        score += equipmentFit(candidate, context)
        score += sessionRoleFit(candidate, context.sessionRole)
        score += fatigueFit(candidate, context.accumulatedFatigue)
        score += relationshipRelevance(candidate, context.referenceExercise)
        score += programContinuity(candidate, context.history)

        candidate.score = score

    return rank(candidates)
```

Exact coefficients are outside the scope of this feature unless the current engine already has a scoring configuration.

### Level rule

Do NOT implement:

```text
if user.level == ADVANCED:
    candidates = exercises.where(difficulty == ADVANCED)
```

Prefer capability logic that permits lower-difficulty movements:

```text
ADVANCED user
    -> beginner + intermediate + advanced exercises may be eligible

INTERMEDIATE user
    -> beginner + intermediate generally eligible
    -> advanced only if explicitly justified by capability data

BEGINNER user
    -> beginner by default
```

Other safety/capability constraints remain authoritative.

---

## 7. Progressive overload integration

Before changing exercises, the progression engine should normally test whether progression can occur within the current exercise.

Conceptual flow:

```text
current exercise
      |
      v
Can overload safely within same exercise?
      |
   yes|--------------------> adjust reps / sets / load / ROM / tempo
      |
     no
      v
Is an exercise transition appropriate?
      |
     yes
      v
query PROGRESSION relationships
      |
      v
filter against user capability + equipment + contraindications
      |
      v
select suitable next exercise
```

Regression follows the same principle when performance, recovery, technique or other program state requires reducing demand.

---

## 8. Seed/example data

```text
Australian Pull-up --PROGRESSION--> Pull-up
Pull-up            --PROGRESSION--> Weighted Pull-up

Pull-up --VARIATION--> Wide-grip Pull-up
Pull-up --VARIATION--> Neutral-grip Pull-up

Pull-up --ALTERNATIVE--> Lat Pulldown
```

Do not automatically classify `Wide-grip Pull-up` as a progression solely because it may feel more difficult.

---

## 9. Acceptance criteria

Implementation is complete when:

1. Admin can add/remove progression, regression, variation and alternative relationships.
2. Self-relations and duplicates are rejected.
3. Progression/regression inverse behavior is automatic and consistent.
4. Symmetric variation/alternative relationships are consistently queryable from either exercise.
5. Existing exercise CRUD continues to work.
6. Existing PRIMARY/SECONDARY muscle data remains unchanged.
7. No manual per-muscle numeric scoring is required.
8. An advanced athlete is not restricted to advanced-labelled exercises.
9. Session role, if implemented, is stored on the prescription/workout item rather than the canonical exercise.
10. Recommendation services can query relationships programmatically.
11. Progressive overload can remain on the same exercise before moving through a progression edge.
12. Tests cover relationship creation, deletion, inverse behavior, duplicate prevention and candidate eligibility.

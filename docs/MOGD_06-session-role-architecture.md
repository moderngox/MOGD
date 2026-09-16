# MOGᴰ — Session Role Architecture

## Purpose

Implement **Session Role** as a contextual programming dimension used by the autonomous MOGᴰ session/program generator.

This specification extends the existing MOGᴰ programming-profile architecture.

## Core rule

**Admin defines what roles an exercise CAN / SHOULD normally fulfill.  
The engine assigns what role the exercise IS fulfilling in a specific generated session.**

Do **not** store one immutable `session_role` on an exercise.

---

# 1. Keep these dimensions separate

The implementation must preserve the distinction between:

1. **Exercise difficulty** — intrinsic technical/difficulty characteristics of the exercise.
2. **Trainee level** — selects the Beginner / Intermediate / Advanced baseline programming profile.
3. **Session role** — contextual purpose of this exercise in this particular session.
4. **Athlete history** — individual performance data used for load/progression decisions.

Conceptually:

```text
EXERCISE
   ↓
Resolve trainee-level programming profile
   ↓
Engine assigns SESSION ROLE
   ↓
Apply role modifier
   ↓
Use athlete history
   ↓
Final individualized prescription
```

An advanced athlete may therefore receive an easy/basic exercise as an accessory, superset or finisher.

---

# 2. Global Session Role definitions

Session roles should be centrally defined/configurable rather than independently recreated for every exercise.

Initial roles:

```ts
type SessionRole =
  | "main"
  | "accessory"
  | "superset"
  | "finisher";
```

Conceptual configuration:

```yaml
session_roles:

  main:
    typical_order: early
    priority: high
    fatigue_budget: high
    volume_bias: moderate
    load_bias: high
    rest_modifier: 1.2

  accessory:
    typical_order: middle
    priority: medium
    fatigue_budget: medium
    volume_bias: moderate
    load_bias: moderate
    rest_modifier: 1.0

  superset:
    typical_order: middle_or_late
    priority: supplementary
    fatigue_budget: controlled
    volume_bias: moderate
    load_bias: moderate_to_low
    rest_modifier: 0.7

  finisher:
    typical_order: late
    priority: supplementary
    fatigue_budget: local
    volume_bias: high
    load_bias: low
    rest_modifier: 0.6
```

These values are conceptual starting points, not hard-coded scientific constants. Keep them configurable.

---

# 3. Exercise-level Admin configuration

Each exercise defines **role eligibility**, not its final role.

Example:

```ts
ExerciseSessionRoleConfig {
  exerciseId: string;
  allowedSessionRoles: SessionRole[];
  preferredSessionRole?: SessionRole;
}
```

### Cable Lateral Raise

```yaml
allowed_session_roles:
  - accessory
  - superset
  - finisher

preferred_session_role: accessory
```

### Barbell Bench Press

```yaml
allowed_session_roles:
  - main
  - accessory

preferred_session_role: main
```

`preferred_session_role` is a recommendation/default bias. It is **not** an immutable assignment.

The engine may choose another allowed role when session context justifies it.

---

# 4. Admin UI

Add a Session Roles section to exercise administration.

Example:

```text
SESSION ROLES

Allowed roles

[ ] Main
[x] Accessory
[x] Superset
[x] Finisher

Preferred role
[ Accessory ▼ ]
```

Validation:

- Preferred role must belong to `allowedSessionRoles`.
- At least one allowed role should normally be selected for active exercises.
- Do not automatically infer that `minimumLevel = beginner` means `role = accessory`.
- Do not couple role eligibility to trainee level unless a future explicit rule requires it.

---

# 5. Engine responsibility

The autonomous engine determines the actual session role **at session-generation time**.

Inputs should include, where relevant:

```text
session goal
training goal
trainee level
target muscles / movement patterns
session structure
exercise ordering
fatigue budget
systemic/local fatigue
exercise relationships
previously selected exercises
superset compatibility
athlete performance/history
available equipment
program phase/context
```

Example:

```text
Goal: Push hypertrophy
Level: Intermediate

MAIN
Barbell Bench Press
4 × 6–10

ACCESSORY
Incline Dumbbell Press
3 × 8–12

ACCESSORY
Cable Lateral Raise
3 × 12–15

SUPERSET
Cable Lateral Raise / Triceps Pushdown

FINISHER
Lateral Raise variation
2 × 15–25
```

The role is attached to the **generated session exercise**, not permanently to the exercise definition.

Suggested session-instance field:

```ts
GeneratedSessionExercise {
  exerciseId: string;
  assignedSessionRole: SessionRole;
  programmingProfileSnapshot: ...;
  finalPrescription: ...;
}
```

Persist the assigned role so historical sessions remain reproducible/explainable.

---

# 6. Role modifies the programming profile

First resolve the trainee-level baseline.

Example:

```yaml
Cable Lateral Raise:
  intermediate:
    sets: [3, 4]
    reps: [10, 20]
    rir: [1, 3]
    rest_seconds: [45, 90]
    prescription: rir
    progression: double_progression
```

Then apply the assigned role.

### Accessory example

```text
Intermediate baseline
        +
ACCESSORY
        ↓
3 × 12–15
RIR 2
Rest 60–90 s
```

### Finisher example

```text
Intermediate baseline
        +
FINISHER
        ↓
2 × 15–20
RIR 0–2
Rest 30–45 s
```

The exact modifier logic belongs in a centralized programming engine/configuration layer.

Do not manually store every possible resolved combination in Admin.

Avoid:

```text
Beginner Accessory Profile
Beginner Finisher Profile
Beginner Superset Profile
Intermediate Accessory Profile
Intermediate Finisher Profile
...
```

This causes combinatorial profile explosion.

Instead:

```text
BASE PROGRAMMING PROFILE
        +
SESSION ROLE MODIFIER
        =
CONTEXTUAL PRESCRIPTION
```

---

# 7. Recommended resolution pipeline

```text
1. Determine session/program objective
             ↓
2. Determine structural needs
   (main movement, accessories, remaining muscle volume, etc.)
             ↓
3. Find exercises matching muscles/pattern/equipment
             ↓
4. Filter by exercise eligibility and constraints
             ↓
5. Assign an allowed session role
             ↓
6. Resolve trainee-level programming profile
             ↓
7. Apply session-role modifier
             ↓
8. Consult athlete history
             ↓
9. Determine individualized load/progression
             ↓
10. Persist final prescription + assigned role
```

Conceptual pseudocode:

```ts
function resolveSessionExercise(context, exercise, user) {
  const role = assignSessionRole({
    context,
    exercise,
    allowedRoles: exercise.allowedSessionRoles,
    preferredRole: exercise.preferredSessionRole
  });

  const baseline = resolveProgrammingProfile({
    exercise,
    traineeLevel: user.traineeLevel
  });

  const contextualPrescription = applySessionRoleModifier({
    baseline,
    role,
    context
  });

  const history = getRelevantExerciseHistory({
    userId: user.id,
    exerciseId: exercise.id,
    equipmentContext: context.equipmentContext
  });

  const individualizedPrescription = applyPerformanceHistory({
    prescription: contextualPrescription,
    history
  });

  return {
    exerciseId: exercise.id,
    assignedSessionRole: role,
    baselineProfile: baseline,
    finalPrescription: individualizedPrescription
  };
}
```

Adapt names/types to the existing MOGᴰ codebase.

---

# 8. Interaction with RIR and Double Progression

Session role does **not** replace the programming/progression system.

Example:

```text
Intermediate Cable Lateral Raise profile
10–20 reps
RIR 1–3
Double progression
```

The role may narrow/modify today's prescription:

```text
role = finisher

→ 2 × 15–20
→ RIR 0–2
→ shorter rest
```

Athlete history then determines the appropriate resistance.

Therefore:

```text
RIR
= How hard should today's sets be?

Double progression
= How reps/load progress over repeated exposures?

Session role
= What purpose does the exercise serve today?

Athlete history
= What has this specific user demonstrated previously?
```

These are complementary dimensions.

---

# 9. Exercise relationships vs Session Roles

Do not confuse exercise relationships with session roles.

Relationships such as:

```text
progression
regression
variation
alternative
```

describe relationships **between exercises**.

Session roles such as:

```text
main
accessory
superset
finisher
```

describe the purpose of an exercise **inside a generated session**.

The engine may use relationships when selecting exercises, but they remain separate data concepts.

---

# 10. Constraints and safeguards

The engine must:

- never assign a role not present in `allowedSessionRoles`;
- use `preferredSessionRole` as a bias, not an absolute requirement;
- avoid making every advanced exercise a `main`;
- allow advanced athletes to receive simple exercises as accessories/finishers;
- respect fatigue and exercise-order constraints;
- avoid placing high-systemic-fatigue movements as finishers merely because the role exists globally;
- account for surrounding exercises when building supersets;
- preserve role assignment in generated-session history;
- allow deterministic explanation/debugging of why a role was selected.

Where possible, return a machine-readable assignment reason:

```ts
{
  assignedSessionRole: "accessory",
  roleReason: "TARGET_MUSCLE_VOLUME_AFTER_MAIN_COMPOUND"
}
```

---

# 11. Acceptance criteria

## Admin

- [ ] Global session roles exist independently of exercises.
- [ ] Exercise Admin can define multiple allowed roles.
- [ ] Exercise Admin can define an optional preferred role.
- [ ] Preferred role must be an allowed role.
- [ ] Exercise does not store one immutable session role.

## Engine

- [ ] Engine assigns role at session-generation time.
- [ ] Assigned role respects exercise eligibility.
- [ ] Preferred role acts as a bias rather than a forced assignment.
- [ ] Engine considers session context before assigning role.
- [ ] Role modifies the resolved trainee-level programming profile.
- [ ] Role modifiers do not require duplicated level × role profiles.
- [ ] Athlete history is applied after contextual programming resolution.
- [ ] Assigned role is persisted with the generated session exercise.

## Behavioral tests

Given:

```text
Cable Lateral Raise
allowed = accessory, superset, finisher
preferred = accessory
```

Then:

- it must never be assigned `main`;
- it may normally resolve to `accessory`;
- it may resolve to `finisher` when late-session local delt volume is required;
- it may resolve to `superset` when compatible with the paired exercise and fatigue constraints.

Given:

```text
Barbell Bench Press
allowed = main, accessory
preferred = main
```

Then:

- it may be the main press in a push/chest session;
- it may be accessory in a context where another movement is already the primary/main exercise;
- it must not become a finisher unless Admin explicitly allows that role.

---

# 12. Architectural principle

The final model is:

```text
ADMIN
│
├── Exercise intrinsic properties
│
├── Exercise relationships
│
├── Trainee-level programming profiles
│     ├── Beginner
│     ├── Intermediate
│     └── Advanced
│
├── Global session-role definitions
│
└── Exercise role eligibility
      ├── allowed roles
      └── preferred role
              │
              ▼
        AUTONOMOUS ENGINE
              │
        assigns today's role
              │
              ▼
     applies role modifier
              │
              ▼
       ATHLETE HISTORY
              │
       load/progression
              │
              ▼
      FINAL PRESCRIPTION
```

**Admin defines the coaching grammar.  
The engine composes the session from that grammar.  
Athlete history personalizes the resulting prescription.**

This separation is required to keep MOGᴰ autonomous programming flexible, explainable and scalable.

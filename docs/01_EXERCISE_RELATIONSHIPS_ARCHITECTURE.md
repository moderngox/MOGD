# MOGD — Exercise Relationships & Progression Architecture

## Purpose

Extend the existing exercise catalogue with an explicit **exercise relationship graph**.

Existing metadata such as difficulty, movement pattern, PRIMARY/SECONDARY muscles, equipment and exercise scores remains responsible for general candidate selection.

Relationships add deterministic domain knowledge about how specific exercises relate to one another.

**Do not rewrite the existing exercise model or recommendation engine. Extend it.**

---

## 1. Core separation of concepts

### Exercise difficulty

`beginner | intermediate | advanced`

Difficulty represents the approximate technical/physical requirement of an exercise.

It is an **eligibility/capability signal**, not a rule that an advanced athlete should only receive advanced exercises.

Example:

- An advanced athlete can perform `weighted_pull_up`.
- The same athlete may still receive `pull_up` or `australian_pull_up` as an accessory, superset or finisher.

Therefore:

> Athlete level defines the upper capability range, not the minimum difficulty of every prescribed exercise.

### Muscle role

Keep the existing exercise-level classification:

- `PRIMARY`
- `SECONDARY`

Do not add manual per-muscle numeric scores to the admin UI for v0.1.

The engine may derive configurable internal weights, initially:

```text
PRIMARY   = 1.0
SECONDARY = 0.5
```

These values belong to recommendation configuration, not to individual exercise records.

Example:

```json
{
  "exercise": "pull_up",
  "muscles": {
    "lats": "PRIMARY",
    "upper_back": "PRIMARY",
    "biceps": "PRIMARY",
    "traps": "SECONDARY",
    "posterior_deltoids": "SECONDARY",
    "forearms": "SECONDARY",
    "rectus_abdominis": "SECONDARY"
  }
}
```

### Session role

Difficulty must be independent from the role an exercise plays in a generated workout.

Suggested prescription/session roles:

```text
PRIMARY
ACCESSORY
SUPERSET
FINISHER
WARMUP
```

**Do not store one permanent session role on an exercise.**

The same exercise can have different roles depending on user and session context:

```text
Beginner:
Australian Pull-up = PRIMARY

Intermediate:
Australian Pull-up = ACCESSORY

Advanced:
Australian Pull-up = FINISHER
```

Store the selected role on the generated workout/prescription item.

---

## 2. Exercise relationship graph

Add explicit relationships between exercises.

Minimum v0.1 relationship types:

```text
PROGRESSION
REGRESSION
VARIATION
ALTERNATIVE
```

Semantics:

- `PROGRESSION`: a logical next exercise when moving toward a more demanding version/capability.
- `REGRESSION`: a logical easier or more accessible version.
- `VARIATION`: related movement with meaningfully changed mechanics, grip, stance, ROM or emphasis; not necessarily harder/easier.
- `ALTERNATIVE`: substitute capable of satisfying a similar programming requirement.

### Example graph

```text
                         ┌── Wide-grip Pull-up
                         │      VARIATION
                         │
Australian Pull-up ──→ Pull-up ──→ Weighted Pull-up
      REGRESSION         │             PROGRESSION
                         │
                         ├── Neutral-grip Pull-up
                         │      VARIATION
                         │
                         └── Lat Pulldown
                                ALTERNATIVE
```

Canonical examples:

```text
Australian Pull-up --PROGRESSION--> Pull-up
Pull-up            --PROGRESSION--> Weighted Pull-up
Pull-up            --VARIATION----> Wide-grip Pull-up
Pull-up            --VARIATION----> Neutral-grip Pull-up
Pull-up            --ALTERNATIVE--> Lat Pulldown
```

A progression automatically implies the inverse regression:

```text
A --PROGRESSION--> B
B --REGRESSION----> A
```

Do not require admins to enter both edges manually.

`VARIATION` and `ALTERNATIVE` should normally behave as symmetric relationships unless the existing data architecture gives a reason to store both directions explicitly.

---

## 3. Important: do not reduce relationships to difficulty

Do not infer that every harder exercise is automatically a progression of every easier exercise.

For example:

```text
Pull-up <-> Wide-grip Pull-up
```

should generally be represented as `VARIATION`, not as a universal progression.

Likewise, Australian pull-ups and pull-ups have different movement patterns:

```text
Australian Pull-up = horizontal_pull
Pull-up             = vertical_pull
```

Yet an Australian pull-up can still be explicitly connected as a useful regression/preparation exercise.

Relationships are curated domain knowledge. Difficulty and metadata are general inference signals.

---

## 4. Contextual sequencing example

The relationship graph is **not itself the workout order**.

For an advanced athlete, a generated pulling sequence might be:

```text
1. Weighted Pull-ups
   role: PRIMARY
   prescription: 4 x 5

2. Wide-grip Pull-ups
   role: ACCESSORY
   prescription: 3 x 8

3. Standard Pull-ups
   role: SUPERSET or ACCESSORY

4. Australian Pull-ups
   role: FINISHER
   prescription: 3 x 12-15
```

Conceptually:

```text
Weighted Pull-ups
       ↓ fatigue increases
Wide-grip Pull-ups
       ↓
Pull-ups
       ↓
Australian Pull-ups
```

This is a **contextual session sequence**, not a declaration that:

```text
weighted > wide-grip > standard > Australian
```

is a universal progression hierarchy.

The engine chooses easier/less demanding exercises later in a session when appropriate based on fatigue, target muscles, session role, equipment, user capability and overall program objectives.

---

## 5. Progressive overload has two layers

### A. Intra-exercise progression

Prefer progression within the same exercise while appropriate.

Example:

```text
Pull-up
6 / 6 / 5
   ↓
7 / 6 / 6
   ↓
8 / 8 / 8
   ↓
10 / 10 / 10
   ↓
increase external load/difficulty
```

Potential progression variables include:

- repetitions
- sets
- external load
- ROM
- tempo
- execution quality / control
- rest interval where programming logic supports it

Do not constantly replace exercises merely to create progression.

### B. Inter-exercise progression

When performance criteria or program logic justify changing the movement:

```text
Pull-up
   ↓ PROGRESSION
Weighted Pull-up
```

The relationship graph handles this layer.

The progressive-overload engine and exercise-relationship graph must remain separate but interoperable.

---

## 6. Recommendation architecture

Exercise metadata answers:

> Which exercises could satisfy this programming requirement?

Relationship graph answers:

> Given a known exercise, which specific exercises are logical progressions, regressions, variations or alternatives?

Conceptual pipeline:

```text
                         EXERCISE SELECTION

User state ─────────────────────────────────┐
Goal ───────────────────────────────────────┤
Target muscles / PRIMARY-SECONDARY ─────────┤
Movement pattern ───────────────────────────┤
Exercise difficulty vs capability ──────────┤
Equipment availability ─────────────────────┤
Hypertrophy / strength scores ──────────────┤──> Candidate scoring
Fatigue / stability demand ─────────────────┤
Contraindications ──────────────────────────┤
Session composition / accumulated fatigue ──┤
Requested/derived session role ─────────────┤
Exercise relationship graph ────────────────┘
                                              ↓
                                    Generated prescription
```

Relationships should modify/enrich candidate selection, not blindly override all other constraints.

---

## 7. Implementation principle

Prefer:

```text
deterministic catalogue knowledge
        +
contextual recommendation/scoring
        +
progressive-overload state
```

over asking an LLM to rediscover known exercise relationships at generation time.

LLMs may assist reasoning/explanation, but canonical exercise relationships stored by MOGD should be authoritative inputs to the program engine.

# MOGᴰ — Product Definition

## 1. Product

MOGᴰ V1 is a male-only physique optimization system.

Its purpose is to help a user change his physique through coordinated:

- training
- nutrition
- strength development
- body-composition strategy
- progression
- adherence
- weekly adaptation

It begins with physique.

Later versions may expand the same persistent personal model toward:

- grooming
- fashion
- wardrobe
- personal styling
- presentation

Those modules are outside V1.

---

# 2. Positioning

MOGᴰ should not behave like:

- a generic workout generator
- a static PDF program
- a chatbot-only product
- a medical application
- an attractiveness-ranking system

The core value is adaptation.

The system learns from:

- current body state
- objectives
- training capacity
- workout performance
- nutrition adherence
- weight trend
- waist trend
- recovery
- weekly check-ins

and changes the plan when justified.

---

# 3. Core loop

ASSESS
→ UNDERSTAND
→ PLAN
→ EXECUTE
→ MEASURE
→ ADAPT

The initial plan is only the beginning of this loop.

---

# 4. V1 goals

User-facing primary goals:

- Lose fat
- Recomposition
- Build muscle
- Get stronger

Internally:

- `fat_loss`
- `recomposition`
- `muscle_gain`
- `strength`

A goal is not itself a complete program specification.

It must be compiled into an internal strategy.

Example:

```json
{
  "primaryGoal": "recomposition",
  "energyDirection": "slight_deficit",
  "trainingBias": {
    "hypertrophy": 0.75,
    "strength": 0.25
  }
}
```

Values shown here are illustrative and not fixed physiological constants.

---

# 5. Physique priorities

Allow the user to select up to approximately three.

Initial UI options:

- Shoulders
- Chest
- Back / V-taper
- Arms
- Abs / waist
- Legs
- Balanced

The backend translates these into canonical muscle priorities.

---

# 6. Assessment

Recommended onboarding sequence:

## Step 1 — Goal

Primary objective.

## Step 2 — Physique priorities

Maximum approximately three.

## Step 3 — Body

Collect:

- age
- height
- weight
- waist
- physiologically relevant sex information

Optional:

- target weight

## Step 4 — Photos

Optional:

- front
- side

Do not require photos.

## Step 5 — Training history

Structured values for:

- experience
- consistency
- training history
- current activity
- limitations
- relevant injury restrictions

## Step 6 — Availability

Collect:

- sessions/week
- session duration
- equipment
- gym/home/bodyweight context

## Step 7 — Nutrition

Collect:

- dietary preference
- allergies/intolerances
- meals/day
- cooking preference
- disliked foods
- willingness to track calories/macros

## Step 8 — Optional prompt

A bounded free-text field.

Example:

"Anything else your coach should know?"

Structured inputs remain authoritative.

---

# 7. Photos

Photo analysis is secondary input.

Potential uses:

- broad physique observations
- visual muscularity distribution
- physique priorities
- proportion observations
- longitudinal visual comparison

Do not treat photographs as precise medical body-composition measurement.

Avoid outputs such as:

"14.3% body fat."

If an estimate is used, prefer:

- range/band
- uncertainty
- confidence
- qualitative interpretation

Weight, waist and progression trends are more valuable for adaptation.

---

# 8. Initial output

After onboarding, the user should receive a structured overview such as:

Primary objective:
Recomposition

Training:
4 sessions/week

Nutrition:
2,350 kcal/day

Protein:
170 g/day

Physique priorities:
1. Lateral delts
2. Lats
3. Upper chest

Current phase:
Recomposition / Foundation

The exact presentation follows `design.md`.

---

# 9. Dashboard philosophy

The dashboard should prioritize next action.

Typical information:

- current phase
- current week
- today's workout
- nutrition target
- weight trend
- waist trend
- priority muscle groups
- coach/adaptation insight

The dashboard must not invoke an LLM simply because it was opened.

Persist the latest validated state.

---

# 10. Workout experience

A workout should expose:

- exercise
- approved demonstration video
- sets
- rep range
- RIR
- rest
- previous performance
- current progression target

Example:

Incline Dumbbell Press

3 × 6–10
RIR 2

Previous:
30 kg × 10

Current target:
Increase load according to the configured progression rule after consistently reaching the 10-rep ceiling.

The active workout UI should prioritize execution rather than chatbot interaction.

---

# 11. Nutrition UX

Alpha requires:

- calorie target
- protein target
- fat target
- carbohydrate target
- basic meal guidance
- adherence tracking

Possible modes:

- Flexible targets
- Structured meal plan

Do not build a complete food logging ecosystem in Alpha.

---

# 12. Check-ins

Weekly check-in may collect:

- average body weight
- waist
- workouts completed
- nutrition adherence
- hunger
- energy
- recovery/sleep
- meaningful performance changes
- optional progress photos
- optional note

This is one of the product's core recurring interactions.

---

# 13. Adaptation

The system must distinguish between:

- intervention failure
- execution/adherence failure

Example:

Expected:
-0.4 kg/week

Actual:
-0.05 kg/week

Adherence:
92%

Potential response:
small calorie adjustment.

But if adherence is:

54%

the system should usually address adherence rather than immediately lower calories.

---

# 14. Recommendation transparency

Important recommendations may carry structured reasons.

Example:

```json
{
  "exerciseId": "cable_lateral_raise",
  "reason": {
    "priority": "lateral_deltoids",
    "goal": "hypertrophy",
    "fatigueCost": "low"
  }
}
```

This may power UI explanations such as:

"Why this exercise?"

or:

"Why did my calorie target change?"

---

# 15. Alpha definition of done

A user can:

1. register
2. complete assessment
3. optionally add two photos
4. select goal
5. select physique priorities
6. enter training history
7. enter availability/equipment
8. enter nutrition preferences
9. receive strategy
10. receive calorie/macronutrient targets
11. receive weekly workouts
12. watch approved exercise videos
13. log sets/workouts
14. view previous performance
15. receive progression targets
16. complete weekly check-in
17. receive justified plan adaptation

Admin can:

1. inspect users
2. manage exercises
3. upload validated exercise videos
4. inspect programs
5. inspect AI runs/errors

---

# 16. Explicit Alpha exclusions

Do not build unless separately approved:

- complete food database
- barcode scanning
- meal-photo recognition
- social network
- wearables
- realtime pose correction
- realtime form coaching
- exact photo-derived body-fat measurement
- user-triggered Seedance generation
- grooming
- fashion
- wardrobe
- attractiveness ratings
- cosmetic-procedure recommendation system
- supplement marketplace

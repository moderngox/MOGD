# MOGᴰ — Design specification

This replaces the earlier placeholder. It is derived from a reviewed Claude Design mockup (a clickable prototype covering most of the product) whose compiled markup and CSS were decoded directly — the values below are read from that source, not estimated from a screenshot.

The mockup covers far more than what is built today. Section 1 (**Foundations**) and Section 2 (**Implemented screens**) are authoritative for code. Section 3 (**Reference screens**) documents everything else the mockup defines — Training, Nutrition food-logging, Progress, Settings, workout execution, and the coach chat panel — as forward-looking reference for future milestones. Nothing in Section 3 exists in code yet, and two of its features (per-meal food logging, AI coach chat) currently exceed `docs/PRODUCT.md`'s Alpha scope; they're recorded here so a future milestone doesn't have to re-derive tokens, not as authorization to build them now.

## Confirmed direction

- Use the MOGᴰ name/wordmark, with a superscript D where supported.
- Dark, masculine, premium, serious and restrained.
- Metric-oriented, combining performance-focused interfaces with an editorial feel.
- Do not add a permanent V icon or invent another brand identity.
- Mobile-first customer experience, usable on web and mobile; web/PWA is an initial delivery option. The mockup confirms real mobile behavior (a bottom tab bar replacing the sidebar, a condensed header), not just a responsive afterthought.
- Prioritize the next action, workout execution, clear nutrition targets and progress.

## 1. Foundations

### Color

| Token | Hex | Usage |
|---|---|---|
| `--color-bg` | `#0C0C0C` | Page background |
| `--color-surface` | `#161616` | Card/section background |
| `--color-surface-alt` | `#131313` | Dashed empty-state / disclosure boxes |
| `--color-surface-elevated` | `#1F2021` | Hover/active surface, skeleton-loading blocks, segmented-control track |
| `--color-border` | `#35383B` | Borders, dividers, table rules (the most-used color in the source) |
| `--color-border-strong` | `#777D83` | Input borders, dashed placeholder frames, stronger dividers |
| `--color-fg` | `#F0EFEA` | Primary text (warm off-white, not pure white) |
| `--color-fg-secondary` | `#8C9095` | Body/label/eyebrow text — the heaviest-used text color |
| `--color-fg-secondary-alt` | `#B1B4B8` | Brighter secondary: active nav text, card sub-copy |
| `--color-fg-muted` | `#5A5E62` | Tertiary/disabled text |
| `--color-accent` | `#D2F34A` | The single accent: primary CTAs, active/"today" state, progress-bar fills, focus rings |
| `--color-accent-hover` | `#E4FA85` | Accent hover/active state |
| `--color-status-positive` | `#91D5AC` | Logged/complete state, positive deltas |
| `--color-status-caution` | `#E7C47B` | Warnings: unfinished-session banners, skipped-exercise notes, "behind schedule" flags |
| `--color-status-warning` | `#F19A9A` | Destructive actions (discard, delete, remove), error text, negative deltas |
| `--color-status-info` | `#A9C7E8` | Reserved informational accent — no confirmed use in the reviewed mockup yet |

**Excluded, do not reuse:** `#D97757` and the font name "Anthropic Sans" appear once each in the decoded source, at the "Made with Claude Design" attribution badge the artifact platform stamps on its own canvases. That badge is not part of this app — do not re-extract this color or font as if it were a MOGᴰ token.

### Typography

Two families, both loaded via `next/font/google` (no new dependency):

- **Inter** — all UI and body text, weights 400/500/600.
- **Barlow Condensed** — display headings and hero numbers only (weight 600, `letter-spacing: .01em`). This is what gives the "editorial" feel: every screen title and every large stat number uses it, nothing else does.

Type scale (all confirmed sizes seen in the source, named by role):

| Step | Size/line-height | Weight/family | Used for |
|---|---|---|---|
| `display-hero` | 44px/44px | 600 Barlow Condensed | Session-summary and plan-ready hero headings |
| `display-lg` | 34px/38px | 600 Inter | Large stat numbers (e.g. "85.0 kg") |
| `display-md` | 30px/34px | 600 Barlow Condensed | Standard screen `<h1>` |
| `display-sm` | 24px/30px | 600 Inter | Dialog / wizard-step `<h2>` |
| `heading` | 20px/26px | 600 Inter | Card `<h2>` |
| `body-lg` | 16px/24px | 400 Inter | Body text, form inputs |
| `body` | 15px/22px | 400/500 Inter | List-item primary text |
| `body-sm` | 14px/20px | 400 Inter | Secondary body copy |
| `caption` | 13px/18px | 400 Inter | Captions, meta text |
| `label` | 12px/16px | 600 Inter, uppercase, `letter-spacing: .06–.08em` | Eyebrows, section labels |
| `micro` | 11px/16px | 400, `ui-monospace, Menlo, monospace` | Sample-data disclaimers, placeholder-slot notes |

Numeric values that update (weights, reps, kcal, percentages) use `font-variant-numeric: tabular-nums` so they don't shift width as digits change.

### Spacing

The mockup's observed padding/gap values (2, 4, 6, 8, 10, 12, 14, 16, 20, 24px) map directly onto Tailwind v4's default spacing scale (0.5 through 6) — there is no separate spacing scale to define. Conventions:

- Card padding: 16–20px (`p-4`/`p-5`)
- Section/list gaps: 12–16px (`gap-3`/`gap-4`)
- Inline gaps (icon+label, chip rows): 4–10px (`gap-1` to `gap-2.5`)

### Radii

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 4–6px | Nested chips |
| `--radius-md` | 8px | Buttons, inputs, most controls |
| `--radius-lg` | 12px | Cards and sections |
| `--radius-full` | 50% | Circular elements (avatars) |
| Bottom-sheet | `20px 20px 0 0` | Mobile dialogs (skip-exercise, exit-session) — reference-only until a mobile dialog pattern is built |

## 2. Implemented screens

### App shell

- **Desktop (`md` and up):** fixed 224px sidebar — MOGᴰ wordmark (Barlow Condensed, `letter-spacing: .18em`, superscript D) with a 28×2px accent underline beneath it, then a vertical nav list (Today/Training/Nutrition/Progress), each item paired with a dependency-free inline-SVG icon (home/dumbbell/apple/bar-chart — `@mogd/ui`'s `icons.tsx`). The active item shows an accent icon + brighter (`--color-fg-secondary-alt`) text; inactive items use `--color-fg-secondary` text with a muted (`--color-fg-muted`) icon. "Ask coach" and "Profile and settings" are pinned to the bottom of the sidebar — in this pass they render as plain nav links to real routes, not the chat/settings features themselves (those are reference-only, §3).
- **Mobile/tablet (below `md`):** the sidebar is hidden and a fixed bottom tab bar (`BottomNav`) takes its place, per the mobile-first confirmed direction above — same four items and icons, icon above label, the active tab fully accent-colored.
- **Header:** breadcrumb-style eyebrow (`label` scale) on the left, computed as `"{{ energyDirection label }} · WEEK {{ elapsed weeks since program.createdAt }}"` — with no fixed denominator (no "OF 12": there's no fixed-length phase concept in the data model, see `packages/db/src/schema/programs.ts`).
- **Main content:** max-width 1280px, responsive gutter padding.

### Today (dashboard)

Two-column grid (stacks to one column on narrow viewports):

- **Next session card** — eyebrow "NEXT SESSION" in accent color, session name in `display-md`, a muted meta line (exercise count · estimated duration), "Start session" (filled accent) + "View exercises" (outline) buttons side by side. Sourced from `programs.getCurrentProgram`.
- **Nutrition card** — title + eyebrow. Two primary stats (Energy, Protein) as label + big value/target + a thin progress bar; two secondary stats (Carbohydrate, Fat) as label + value/target pairs below a divider. Sourced from `nutrition.getNutritionTarget`. There is no daily food-logging feature (§3), so the "progress" shown is the target itself alongside the most recent check-in's self-reported `nutritionAdherencePercent` — not a fabricated "remaining today" figure.
- **This week card** — "N of M sessions logged" plus a list of the program's workouts, each with a status pill (`positive` = logged, `current` = today, `neutral` = scheduled). Status is derived by `programs.getWeeklySessionStatus` (new) from real `exercise_log` rows — documented there as a rotation heuristic (first not-yet-logged workout in `dayIndex` order = "today"), not true calendar scheduling, since the data model has no phase/week/calendar concept yet.
- **Bodyweight card** — current weight as a big stat, an inline-SVG sparkline of recent check-ins (no chart library — one static trend line doesn't justify the dependency), and a caption computed from `adaptation.computeActualWeeklyRateKg`.
- **Proposed change card** — shown only when `adaptation.getLatestPlanAdjustment` returns a row; amber-bordered, "PROPOSED CHANGE · AI GENERATED" eyebrow in accent color, matching the mockup's `adapt.showTeaser` treatment.

### Check-in

Same sidebar/header shell as the dashboard, for a consistent app chrome. The form (weight, waist, adherence %, hunger/energy/recovery Likert selects, two optional notes, optional photo consent + uploads) is unchanged in fields and behavior — this is a visual pass only. Each logical group renders inside a `Card`; the post-submit result view also becomes a `Card`.

### Components (`@mogd/ui`)

- `Button` — `variant`: `"primary"` (filled accent), `"secondary"` (filled `--color-surface-elevated`), `"outline"` (transparent, bordered) — the mockup consistently pairs a filled accent CTA with an outline CTA, which two variants alone couldn't express.
- `Input` / `Select` / `Textarea` — `--color-surface` background, `--color-border-strong` border, `--color-accent` focus ring.
- `Checkbox` — `accent-color: var(--color-accent)`.
- `Card` — `--color-surface` background, `--color-border` border, `radius-lg`, optional header slot (title + right-aligned eyebrow/meta).
- `Badge` — pill, variants `current` (filled accent) / `positive` (soft green) / `neutral` (outline gray) / `warning` (coral) / `info` (blue).
- `BigStat` — Barlow Condensed value + Inter label underneath, optional unit and trailing note.
- `ProgressBar` — track (`--color-surface-elevated`) + fill (accent or a status color).
- `Sparkline` — dependency-free inline SVG polyline, accent-colored, no axes/gridlines/tooltips.
- `SidebarNav` — wordmark + accent underline + icon nav list as described above; hidden below `md`.
- `BottomNav` — fixed bottom icon tab bar, same item list; shown only below `md`.

## 3. Reference screens (not built — documented for future milestones)

Everything below is real detail extracted from the mockup's source, kept here so a later pass can build from it directly instead of re-deriving tokens. None of it exists in code today, and food-logging and coach chat specifically exceed current Alpha scope (`docs/PRODUCT.md` §11 and §16) until a product decision says otherwise.

- **Onboarding** — a multi-step wizard (objective → baseline → training context → constraints/food → optional reference photos → review → generating → plan-ready), using the same card/chip/button language as the rest of the app. Photo step includes explicit consent copy and framing guidance.
- **Workout execution** — a focused, distraction-light session runner: header with exit/finish, per-set load+reps inputs with a "done" toggle, a rest timer with +30s/skip controls, substitute/skip-with-reason actions (skip requires a reason and is recorded as "not performed" rather than zero), an exit dialog offering resume/save-and-exit/discard, and a session-summary screen (exercises performed, working sets, elapsed time, top-set-vs-last-time comparison).
- **Training tab** — overview (program name, this-week list, recent-session history) → day view (exercise list with prescription and previous performance) → exercise detail (approved demonstration video slot with a paused/muted/captioned default, or an explicit "demonstration unavailable" state; prescription, setup, cues; equipment substitutions; "ask coach: why this exercise?").
- **Nutrition tab** — full per-meal food logging: an overview with primary macro progress bars and meal-grouped entries ("nothing logged" is explicitly distinguished from "zero consumed"), a food search against a small sample list, a portion-entry screen with live macro calculation, and a manual-entry fallback labeled as an estimate. **This is the food-logging ecosystem `docs/PRODUCT.md` says not to build in Alpha — reference only.**
- **Progress tab** — a `role="tablist"` of four sections: Trends (bodyweight chart with range picker + an entries table), Measurements (self-reported deltas), Strength (top-set-then-vs-now), and Photo comparison (side-by-side or slider overlay, explicitly privacy-noted). A fifth section covers check-in history and the full 4-step weekly check-in wizard. A sixth covers adaptation review: an observation, an explicit "what is uncertain" disclosure, and a current-vs-proposed table — always framed as "a suggestion, not an applied change."
- **Settings** — account fields, units toggle (converts values, not just labels), privacy/photo consent with per-photo deletion, and (dev-only) toggles to force failure states for review.
- **Coach chat** — a right-anchored panel with idle (suggested prompts) / streaming (skeleton loading) / error (retry) / done (observation/interpretation/next-action, explicitly labeled "a suggestion, not an applied change") states. **No coach-chat feature exists in the domain — reference only.**
- **Additional component patterns**: segmented/pill toggle groups, data tables (13–14px Inter, `--color-border` rules), dashed-border placeholder cards (photo slots, empty states, "no results"), toggle switches, range sliders, bottom-sheet and side-panel modals, skeleton-loading bars, and a dashed "integration assumptions" disclosure box style.

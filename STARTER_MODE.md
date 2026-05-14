# Starter mode — demo-driven UI design

When ndemo-kit is cloned **at the start of a project**, the demo video
is the centerpiece. The whole app is built around what makes a clear,
compelling 60–120-second story. This document is the playbook for that
mode — meant for Claude (or any engineer) building the app.

If you're retrofitting an existing app, see RECIPE.md instead.

---

## The core inversion

In normal product development, you build the app then maybe record a
demo at the end. In starter mode you flip that:

1. Write the **demo narration first** — what story should the video
   tell?
2. Break the story into **3–8 segments**, each covering one moment.
3. For each segment, decide **one clear on-screen action** the viewer
   should see.
4. Build only enough UI to make that action exist and be visible.
5. Skip every screen, feature, and option that the demo doesn't show.

The demo is the spec.

---

## Principles for demo-friendly UI

### Visible state changes

Every action in the demo needs an obvious visual response. If clicking
a button just sends a request and silently updates a row 200 px away,
the viewer misses it. Make state changes:

- **Loud** — the affected region animates, highlights, or visibly
  re-renders.
- **Local** — the response happens at or near the click target.
- **Sequential** — never two things changing at once.

### Wide, generous typography

Demos run at 1080p–4K. Body text smaller than 14 px disappears on
mobile playback. UI text smaller than 12 px is unreadable.

- Body: ≥ 15 px (16 px ideal)
- Buttons / labels: ≥ 14 px, semibold
- Headings: ≥ 22 px
- Inputs: ≥ 16 px (also prevents iOS auto-zoom)

### High-contrast CTAs

The action the viewer should track must be the most visually distinct
thing on screen. One primary CTA per view. Secondary actions get muted
styling.

### Stable selectors before features

Before you write the playbook actions, add `data-testid` attributes to
every element the demo will interact with. Naming convention:

```
data-testid="<feature>-<element>"

  search-input
  search-submit
  results-list
  result-card-0
  filter-category-dropdown
  cta-checkout
  payment-method-fpx
  confirmation-email
```

Stable testIds survive style refactors. Role+name selectors break when
copy changes. Always prefer testIds in the playbook.

### Predictable async timing

Demos hate variance. If your app has:

- **Live LLM / streaming** — add a scripted mock (see
  `examples/demo-script.example.ts`)
- **Database calls** — seed with deterministic fixture data and bypass
  network during demo mode
- **Time-based behaviour** (debounce, throttle, polling) — make
  thresholds short and stable, not "feels good in production"

A demo run that takes 47 s on Monday and 53 s on Tuesday is broken.

### One control surface per view

In a demo, the viewer's eye should know exactly where to look. Avoid:

- Side panels that animate in alongside the main change
- Toast notifications that pop while the user is mid-action
- Auto-save indicators, "saving…" spinners that compete for attention
- Live activity feeds, presence indicators, real-time anything

Strip these for demo mode (or hide them via the env flag entirely).

### Demo-mode env flag

Wire a `NEXT_PUBLIC_DEMO_MODE=1` (or framework equivalent) flag from
day one. When set, the app should:

- Bypass any live AI / streaming backend (replay fixtures instead)
- Suppress toasts, presence indicators, polling
- Use deterministic seed data
- Disable analytics (so the demo doesn't pollute funnels)
- Skip auth gates (or auto-login as a known fixture user)

The flag stays in production code permanently. Cost: ~50 lines and a
handful of `if (DEMO_MODE)` branches. Benefit: every future demo just
works.

---

## What to scaffold first

When starting a project with ndemo-kit, build in this order:

1. **The demo playbook stub** — write 3–8 segments of narration that
   tell the story. Don't worry about timing yet.
2. **The page tree** — one route per segment if needed, named after
   the segment ids.
3. **Static layout for each route** — markup + styles only, no logic.
   Include `data-testid` attributes for every targeted element.
4. **The demo-mode flag and mocks** — replace any external API the
   demo touches with a deterministic fixture replay.
5. **Just-enough behaviour** — wire the buttons/inputs to update state
   the demo cares about. Skip everything else.
6. **Generate audio + render** — verify the demo works end to end.
7. **Build the rest of the app** — real backend, real auth, real
   complexity. Demo mode keeps the recording reproducible throughout.

---

## A worked example

**Story**: "Search for a flight, hold the fare, pay, get confirmed."

**Segments**:
1. `intro` — landing page, value prop visible (10 s)
2. `search` — type origin/destination, hit search (15 s)
3. `pick-flight` — see results, click a card (12 s)
4. `hold` — review fare panel slides in, click hold (10 s)
5. `pay` — payment options, pick one, see processing (15 s)
6. `confirm` — success screen with PNR and details (8 s)
7. `closing` — fade on success screen (5 s)

**Routes** built first (markup only):

```
/                 → SearchLandingPage           testId="search-form"
                                                 testId="search-submit"
/results          → FlightResultsPage           testId="result-card-0"
/flight/:id       → FlightDetailPage            testId="hold-button"
/checkout         → CheckoutPage                testId="pay-fpx"
/confirmed/:pnr   → ConfirmationPage            testId="confirmation-pnr"
```

**Mocks** wired to `DEMO_MODE`:
- `searchFlights()` returns a fixed array of 3 flights
- `holdFare()` returns `{ holdRef: "MH-HOLD-DEMO", expiresAt: ... }`
- `processPayment()` resolves after 1200 ms with success
- `confirmBooking()` returns a fixed PNR

That's the entire app surface needed for the demo. Real auth, real
search backend, real payment gateway can come after — they don't
appear in the recording.

---

## Working with Claude in starter mode

When you hand a starter-mode project to Claude, give it these inputs:

1. The full demo narration (8–15 sentences, one per segment).
2. The target tech stack (Next.js / Vite / Astro / Remix / etc.).
3. Any branding constraints (colors, fonts, name).
4. Any backend you already have or want it to mock.

Then ask Claude to follow the seven-step scaffolding order above.
Don't ask for a full app — ask for the smallest app the demo needs.

The playbook YAML is the contract between you and the implementation.
If a segment isn't in the playbook, the feature it implies doesn't
need to exist yet.

# Working with ndemo-kit (auto-loaded)

> This file is read automatically by Claude Code when a session starts in
> this directory or any of its descendants. Acts as the handoff prompt.

## What this repo is

ndemo-kit produces narrated browser-demo videos of web apps. Pipeline:

```
playbook.yaml  →  generate-audio (edge-tts or manual)  →  ndemo render  →  demo.mp4
```

- **ndemo** (`~/tools/ndemo`) drives Playwright + captures via CDP screencast — no screen-recording permission, no desktop noise.
- **edge-tts** generates neural narration for free. Falls back to a `NARRATION_SCRIPT.txt` when unavailable so the user can produce MP3s manually.
- **prep-audio.mjs** stages MP3s into ndemo's hash-keyed cache so OpenAI is never called.
- All shell logic lives in `.mjs` files; `.sh` and `.ps1` are thin wrappers for cross-platform parity.

## When the user asks you to make a demo

Follow this order without prompting unless something is genuinely
ambiguous:

### 1. Verify the toolchain

Check that all of these exist; if any are missing, point at `install.sh`
(macOS/Linux) or `install.ps1` (Windows) and stop:

- `~/tools/ndemo/dist/cli.js`
- `~/tools/ndemo/ndemo` (or `ndemo.cmd` on Windows)
- `edge-tts` on PATH
- ffmpeg on PATH
- Node ≥ 20

### 2. Detect the project mode

Look at the current working directory:

- **Starter mode** — no `src/`, `app/`, or `pages/` yet; only this kit
  or a near-empty repo. The demo narration becomes the spec for the
  whole app build. Read `STARTER_MODE.md` end-to-end.

- **Retrofit mode** — existing app present. Plan **minimal additive
  changes only**: add `data-testid` attributes where needed, optionally
  add a `NEXT_PUBLIC_DEMO_MODE=1` mock for streaming/AI UIs, apply the
  Tailwind v4 + Turbopack tweaks if relevant. Read `RECIPE.md`.

### 3. Ask the user in one block

**Both modes:**
- What story should the demo tell? (User flow, end to end.)
- Target video length? (e.g., "60–90 s")
- Does the UI rely on AI / streaming / live backend output that varies
  between runs? (If yes, scripted mock is needed — see
  `examples/demo-script.example.ts`.)

**Starter mode adds:**
- Tech stack? (Next.js / Vite + React / Astro / Remix / Svelte / other)
- Branding constraints? (App name, primary color, vibe)
- Backend dependency? (Mock everything / use real DB / etc.)

**Retrofit mode adds:**
- Which existing routes/pages does the demo touch?
- Existing stable selectors I should reuse, or should I add new
  `data-testid`s?

**Wait for answers before authoring code or YAML.**

### 4. Bootstrap the demo folder

```bash
~/tools/ndemo-kit/new-demo.sh "$PWD" <demo-name> <app-url>
# add --starter for starter mode (cosmetic — tweaks per-demo README)
```

This creates `<project>/demo/<demo-name>/` with `playbook.yaml`,
`render.mjs`/`.sh`/`.ps1`, `prep-audio.mjs`, `generate-audio.mjs`,
`package.json`, and an empty `audio/`. It also writes/appends a
project-level `CLAUDE.md` so future sessions auto-pick up context.

### 5. Authoring rules

- **Stable selectors first.** Before writing playbook actions, add
  `data-testid` attributes to every element the playbook will target.
  Naming convention: `<feature>-<element>` (e.g. `search-submit`).
- **One narration clip per segment.** Use `timing: parallel` so actions
  sync with audio.
- **Hash stability.** Don't change `playbook.tts.voice` or
  `playbook.tts.speed` between runs — they're identifiers in ndemo's
  audio cache hash. The actual TTS voice is chosen via
  `./generate-audio.mjs --voice ...`.
- **Scripted mode for AI/streaming.** If the app's UI depends on a
  live LLM / SSE / WebSocket, add the `NEXT_PUBLIC_DEMO_MODE=1`
  mock pattern from `examples/demo-script.example.ts`. Otherwise the
  demo will drift between runs.

### 6. Starter-mode build order (only if starter)

Follow `STARTER_MODE.md` precisely:

1. Write the demo narration first (3–8 segments).
2. Stub route tree — one route per segment if needed.
3. Static markup + styles, with `data-testid`s pre-applied.
4. Wire the demo-mode env flag + deterministic fixture replay.
5. Just-enough behaviour to make the demo's actions update state.
6. **Skip everything not in the playbook** — no auth, settings,
   errors, polling, toasts, analytics, real-time anything.
7. Render and iterate.

### 7. Calibrate timing

Run `./render.sh` once. ndemo writes `audioDuration` and
`videoDuration` into each YAML segment. Adjust:

- `videoDuration < audioDuration` → add trailing wait
- `videoDuration > audioDuration` → tighten waits or lower `delay`
- Aim for `videoDuration ≈ audioDuration + 500 ms` per segment

### 8. Deliverable

One file at `<project>/demo/<demo-name>/demo.mp4` plus a matching `.srt`.

## Files to consult

| Path (relative to this CLAUDE.md) | Role |
|---|---|
| `RECIPE.md` | Pipeline internals, why each trick exists, troubleshooting |
| `STARTER_MODE.md` | Demo-driven UI design (read for starter mode) |
| `examples/playbook.example.yaml` | Every action type / target / done condition |
| `examples/demo-script.example.ts` | Scripted-mode mock pattern |
| `~/tools/ndemo/SKILL.md` | Full ndemo playbook schema reference |

## Common pitfalls (mention these proactively)

- **Env flags must prefix the dev-server command.** `NEXT_PUBLIC_*`
  vars are baked into the client bundle at server-start time.
- **Tailwind v4 + chromium profile clash.** Tailwind's source scanner
  reads the `.ndemo/browser-profile/SingletonSocket` Unix-socket file
  and Turbopack panics. Add `@source not "../../demo";` to the
  project's `globals.css`.
- **Workspace lockfiles** confuse Turbopack's root detection. Set
  `turbopack.root: path.resolve(__dirname)` in `next.config.ts`.
- **Heavy native deps** (e.g. some AI SDKs ship hundreds of MB of
  arch-specific binaries) need `serverExternalPackages: [...]` so
  webpack doesn't traverse them on every compile.
- **First render is slow.** Playwright cold start + ffmpeg assembly
  adds ~30 s. Re-renders are faster.

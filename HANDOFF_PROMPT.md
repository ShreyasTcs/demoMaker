# Handoff prompt — paste this into Claude Code in your project

Once `ndemo-kit` is cloned somewhere (default: `~/tools/ndemo-kit`) and
you've run `./install.sh` once on the machine, open Claude Code in the
project you want a demo for and paste the prompt block below as your
first message.

Claude will:

1. Detect whether this is a **starter-mode** project (empty repo, demo
   drives the build) or a **retrofit** project (existing app, add demo
   support).
2. Read the kit's docs and the project state.
3. Ask the right setup questions.
4. Drive the authoring + render end-to-end.

---

## Prompt

> I'd like a narrated demo video produced via the ndemo-kit toolkit at
> `~/tools/ndemo-kit`. Before doing anything else:
>
> 1. **Verify the kit is installed**: check that
>    `~/tools/ndemo-kit/scripts/render.mjs` and `~/tools/ndemo/dist/cli.js`
>    both exist, and `edge-tts` is on PATH. If any are missing, point me
>    at `~/tools/ndemo-kit/install.sh` (Unix) or `install.ps1` (Windows)
>    and stop.
>
> 2. **Detect the project mode** by inspecting the current directory:
>    - **Starter mode** — repo is empty / has only a README / no source
>      tree yet. Read `~/tools/ndemo-kit/STARTER_MODE.md` for the
>      demo-driven design principles. The demo narration becomes the
>      spec for the entire app build.
>    - **Retrofit mode** — repo has an existing app (src/, app/, pages/,
>      package.json with framework deps). Read
>      `~/tools/ndemo-kit/RECIPE.md` for the pipeline, then plan minimal
>      additive changes (add `data-testid`s, optional demo-mode flag).
>
> 3. **Ask me these questions in one block**, varying by mode:
>
>    **Both modes:**
>    - What story should the demo tell? (Describe the user flow,
>      end to end.)
>    - Target video length? ("60–90s", "around 2 min", etc.)
>    - Does the UI rely on AI / streaming / live backend output that
>      varies between runs? (If yes, we need a scripted mock — see
>      `~/tools/ndemo-kit/examples/demo-script.example.ts`.)
>
>    **Starter mode additionally:**
>    - Tech stack preference? (Next.js / Vite + React / Astro / Remix /
>      Svelte / vanilla / other.)
>    - Branding constraints? (App name, primary color, font, vibe.)
>    - Any backend dependency? (None / mock everything / real DB / etc.)
>
>    **Retrofit mode additionally:**
>    - Which existing routes/pages does the demo touch?
>    - Are there any selectors you want me to use, or should I add
>      `data-testid`s where I need them?
>
> 4. Wait for my answers before authoring code or YAML.
>
> ## Authoring rules
>
> **Both modes:**
>
> - Bootstrap the demo folder with:
>   ```
>   ~/tools/ndemo-kit/new-demo.sh "$PWD" <demo-name> <app-url>
>   ```
>   (add `--starter` if in starter mode — it tweaks the per-demo README).
> - One YAML segment per narration clip. Use `timing: parallel` so
>   actions sync with audio.
> - Default voice for `./generate-audio.mjs` is `en-US-AndrewNeural`
>   via edge-tts. If edge-tts is unavailable, the script writes
>   `NARRATION_SCRIPT.txt` — tell me to generate the MP3s manually
>   and drop them in `audio/`.
>
> **Starter mode authoring order (follow STARTER_MODE.md):**
>
> 1. Write the demo narration first (3–8 segments).
> 2. Stub the route tree — one route per segment if needed.
> 3. Static markup + styles per route, with `data-testid` attributes
>    pre-applied on every element the playbook will target.
> 4. Wire the `NEXT_PUBLIC_DEMO_MODE=1` flag (or framework equivalent)
>    and the deterministic fixture replay.
> 5. Just-enough behaviour to make the on-screen actions update state.
> 6. Skip everything not in the playbook — no auth screens, settings
>    pages, error states, polling, toasts, analytics, presence
>    indicators, real-time anything (unless the demo shows it).
> 7. Render and iterate.
>
> **Retrofit mode authoring order:**
>
> 1. Audit the existing UI on the target routes. Note which elements
>    need stable selectors.
> 2. Add `data-testid` attributes (additive — no logic changes).
> 3. If the app calls a live LLM / streaming API, add the demo-mode
>    mock from `examples/demo-script.example.ts`.
> 4. If using Tailwind v4, add `@source not "../../demo";` to the
>    project's `globals.css`.
> 5. If using Next.js with workspace lockfiles, set
>    `turbopack.root: path.resolve(__dirname)` in `next.config.ts`.
> 6. Author the playbook against the existing UI.
> 7. Render and iterate.
>
> ## Timing calibration
>
> - Run `./render.sh` once; ndemo writes `audioDuration` and
>   `videoDuration` into each segment of the YAML.
> - If `videoDuration < audioDuration`, lengthen the segment's
>   trailing wait. If it overflows, tighten waits or lower `delay`.
> - Aim for `videoDuration ≈ audioDuration + 500 ms` per segment.
>
> ## Deliverable
>
> One file at `demo/<demo-name>/demo.mp4` (plus a matching `.srt`).

---

## Files Claude should read (in order)

| File | When |
|---|---|
| `~/tools/ndemo-kit/RECIPE.md` | Always — pipeline internals + troubleshooting |
| `~/tools/ndemo-kit/STARTER_MODE.md` | Starter mode only — demo-driven design |
| `~/tools/ndemo-kit/examples/playbook.example.yaml` | When authoring the playbook |
| `~/tools/ndemo-kit/examples/demo-script.example.ts` | When the app has AI/streaming UI |
| `~/tools/ndemo/SKILL.md` | Reference for the full playbook YAML schema |

## Watch out for

- **Env flags must prefix the dev-server command.** Setting
  `NEXT_PUBLIC_*` after the server has started has no effect.
- **Tailwind v4 source-scans the demo folder** unless told otherwise.
  Add `@source not "../../demo";` to `globals.css`.
- **Workspace lockfiles** confuse Turbopack — set `turbopack.root` in
  `next.config.ts` if the project has a parent `package-lock.json`.
- **Heavy native packages** (e.g. some AI SDKs) need
  `serverExternalPackages: [...]` so webpack doesn't traverse them.
- **First render is slow** — Playwright cold start + ffmpeg assembly
  adds ~30 s on top of the demo duration. Re-renders are faster.

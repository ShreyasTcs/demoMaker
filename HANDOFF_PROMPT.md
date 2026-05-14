# Handoff prompt — paste this into Claude Code in your new project

Once you've cloned `ndemo-kit` somewhere and run `./install.sh`, open a
fresh Claude Code session in the project you want a demo for and paste
the prompt block below as your first message. Claude will read the
kit's RECIPE.md, ask you a few short setup questions, and drive the
authoring + render end-to-end.

---

## Prompt

> I'd like a narrated demo video of this app. The toolkit is installed
> at `~/tools/ndemo-kit` — start by reading `~/tools/ndemo-kit/RECIPE.md`
> end-to-end, then `~/tools/ndemo-kit/README.md` for the user-facing flow.
>
> Before authoring anything, please:
>
> 1. Check `~/tools/ndemo/dist/cli.js` exists and `edge-tts` is on PATH.
>    If anything is missing, point me at `~/tools/ndemo-kit/install.sh`
>    and stop.
>
> 2. Ask me these three questions in one block:
>    - **What should the demo show?** Describe the user flow you want
>      captured, end to end.
>    - **Is the UI deterministic?** Or does it talk to a live AI /
>      streaming backend that returns variable output? (If variable, we
>      need the scripted-mode mock from
>      `~/tools/ndemo-kit/examples/demo-script.example.ts`.)
>    - **Target video length?** A range like "60–90 s" or "around 2
>      minutes" is enough.
>
> 3. Wait for my answers before authoring code or YAML.
>
> When authoring:
>
> - Bootstrap the demo folder with
>   `~/tools/ndemo-kit/new-demo.sh "$PWD" <demo-name> <app-url>`.
> - Add `data-testid` attributes to any UI elements you'll target,
>   before writing the playbook actions.
> - For each segment, use `timing: parallel` so the actions sync with
>   the narration playback.
> - Default voice: `en-US-AndrewNeural` via edge-tts. Run
>   `./generate-audio.mjs` to produce all narration MP3s in one step.
>
> When calibrating timing:
>
> - Run `./render.sh` once; ndemo writes `audioDuration` and
>   `videoDuration` into each segment.
> - If `videoDuration < audioDuration`, add a trailing wait. If it
>   overflows, tighten the existing waits or typing `delay` values.
> - Aim for `videoDuration ≈ audioDuration + 500 ms` per segment.
>
> The deliverable is one file at `demo/<demo-name>/demo.mp4` (plus
> a matching `.srt`).

---

## Files Claude should know to read

- `~/tools/ndemo-kit/RECIPE.md` — pipeline internals, why each step
  exists, troubleshooting matrix
- `~/tools/ndemo-kit/examples/playbook.example.yaml` — every action
  type, target style, and done condition annotated
- `~/tools/ndemo-kit/examples/demo-script.example.ts` — scripted-mode
  mock pattern, only needed for AI / streaming UIs
- `~/tools/ndemo/SKILL.md` — ndemo's own reference, includes the full
  YAML schema

## What to keep an eye on

- **Env flags.** If your app needs `NEXT_PUBLIC_DEMO_MODE=1` or similar
  to enter scripted mode, make sure it's prefixed on the `npm run dev`
  command, not exported afterwards.
- **Tailwind v4** users: add `@source not "../../demo";` to your
  `globals.css` once. Otherwise Tailwind's source scanner reads the
  chromium socket file ndemo creates and Turbopack panics.
- **First render is slow.** Playwright cold-start + ffmpeg frame
  assembly adds ~30 s on top of the demo duration. Incremental
  re-renders are faster.

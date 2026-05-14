# ndemo-kit

Plug-and-play toolkit for producing narrated browser-demo videos of any web
app. Drop it into a project, edit one YAML file, run one command, get an MP4.

```
ndemo-kit → new-demo.sh <project> <name> →  edit playbook.yaml
                                        →  ./generate-audio.mjs   (auto TTS)
                                        →  ./render.sh            (→ demo.mp4)
```

- **Deterministic** — runs identically every time
- **No screen-recording permission** — captures only the browser viewport via Playwright CDP
- **No paid API** — automated narration via [edge-tts](https://github.com/rany2/edge-tts) (Microsoft Edge's free neural voices), manual MP3s also work
- **One-command render** — generate-audio + stage + render + mux in a single shell script

---

## One-time setup

```bash
git clone <your-fork-or-this-repo> ~/tools/ndemo-kit
cd ~/tools/ndemo-kit
./install.sh
```

`install.sh` will:
- Verify Node ≥ 20 and ffmpeg are installed (errors if not)
- Clone & build [splitbrain/ndemo](https://github.com/splitbrain/ndemo) to `~/tools/ndemo`
- Install Playwright chromium
- Install [edge-tts](https://pypi.org/project/edge-tts/) via pip

---

## Producing a demo for any project

### 1. Bootstrap

```bash
~/tools/ndemo-kit/new-demo.sh /path/to/your-project feature-tour http://localhost:3000
```

That creates `your-project/demo/feature-tour/` with a stub `playbook.yaml`, the helper scripts, and an empty `audio/` directory.

### 2. Edit `playbook.yaml`

Replace the placeholder narration text and actions. See `examples/playbook.example.yaml` for every action type, target style, and done condition you can use.

The playbook is a list of **segments**. Each segment is a chunk of narration + the browser actions that should happen while that narration plays.

### 3. Start your dev server

Whatever command you normally use, on the URL you put in the playbook.

### 4. Generate narration

```bash
cd /path/to/your-project/demo/feature-tour
./generate-audio.mjs
```

Produces `audio/<segment-id>.mp3` for every segment with `narration:` text. Defaults to edge-tts voice `en-US-AndrewNeural`. Override:

```bash
./generate-audio.mjs --voice en-US-AriaNeural
./generate-audio.mjs --voice en-GB-RyanNeural --rate "-10%" --pitch "+0Hz"
```

Or skip auto-generation and drop your own MP3s into `audio/<segment-id>.mp3` — the rest of the pipeline uses them as-is.

### 5. Render

```bash
./render.sh
```

Produces `demo.mp4` plus `demo.srt` subtitles. Total runtime: ~2–3 min for a 90-s demo.

---

## When to use scripted demo mode

If your app talks to a live AI / LLM / streaming backend, the response wording and timing will vary per run — the audio narration will drift. Fix it once: add an env flag (`NEXT_PUBLIC_DEMO_MODE=1` or similar) and a small mock in your client that replays a hardcoded fixture instead of hitting the real API.

See `examples/demo-script.example.ts` for the full pattern.

For static / deterministic apps, skip this — drive the real UI directly.

---

## Folder layout of a demo

```
your-project/demo/feature-tour/
├── playbook.yaml          ← what to say and what to click
├── prep-audio.mjs         ← stages MP3s into ndemo's cache (don't edit)
├── generate-audio.mjs     ← auto-TTS via edge-tts (don't edit)
├── render.sh              ← orchestration (don't edit)
├── package.json           ← yaml dep
├── audio/                 ← <segment-id>.mp3 lives here
└── video-raw/             ← intermediate frames + ndemo cache
demo.mp4 / demo.srt        ← final outputs at the demo dir root
```

---

## Files in this repo

| Path | Purpose |
|---|---|
| `install.sh` | One-time setup on a machine |
| `new-demo.sh` | Bootstrap a demo into any project |
| `scripts/prep-audio.mjs` | Stage MP3s with hash filenames so ndemo skips OpenAI TTS |
| `scripts/generate-audio.mjs` | Automated narration via edge-tts |
| `scripts/render.sh` | Auto-discover playbook + render |
| `scripts/package.json` | Local `yaml` dep for the scripts |
| `examples/playbook.example.yaml` | Annotated reference for every action type |
| `examples/demo-script.example.ts` | Reference for AI/streaming apps that need scripted mode |
| `RECIPE.md` | Deep dive: how the pipeline works, why each trick exists |
| `HANDOFF_PROMPT.md` | Prompt template for handing a demo task to Claude Code |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Header missing` errors during merge | TTS produced non-standard MP3 frames | `prep-audio.mjs` re-encodes via ffmpeg — should be automatic |
| `OPENAI_API_KEY` error in render | An audio file's hash doesn't match | Check `playbook.tts.voice/speed` match what `prep-audio.mjs` saw; re-run `prep-audio.mjs` |
| `Cannot find package 'yaml'` | First run | `render.sh` auto-runs `npm install` in the demo dir |
| ndemo can't find a button | Selector mismatch | Run `~/tools/ndemo/ndemo open <playbook>` + `~/tools/ndemo/ndemo page-state` to inspect the accessibility tree |
| Demo drifts between runs | App has live backend producing variable output | See `examples/demo-script.example.ts` for the scripted-mode mock pattern |
| Turbopack panics reading `.ndemo/.../SingletonSocket` | Tailwind v4 source scanner reads chromium profile dir | Add `@source not "../../demo";` to `globals.css` |

---

## Credits

Builds on [splitbrain/ndemo](https://github.com/splitbrain/ndemo) for the Playwright/CDP capture pipeline and [rany2/edge-tts](https://github.com/rany2/edge-tts) for free neural narration.

## License

MIT — see `LICENSE`.

# ndemo-kit

Plug-and-play toolkit for producing narrated browser-demo videos of any
web app. Drop it into a project, edit one YAML file, run one command,
get an MP4.

```
ndemo-kit  →  new-demo (bootstrap a demo folder)
           →  edit playbook.yaml (narration + browser actions)
           →  render            (auto-TTS via edge-tts, with manual fallback)
                                → demo.mp4 + demo.srt
```

- **Cross-platform** — macOS, Linux, Windows. Pure Node logic, thin `.sh` and `.ps1` wrappers.
- **Deterministic** — runs identically every time.
- **No screen-recording permission** — captures only the browser viewport via Playwright CDP.
- **No paid API** — default narration via [edge-tts](https://github.com/rany2/edge-tts) (free Microsoft Edge neural voices). Falls back to a manual-script flow when offline.
- **Two modes** — *starter* (demo drives a fresh project's build) or *retrofit* (add demos to an existing app).

---

## One-time setup

```bash
# Clone wherever you like; default convention is ~/tools/ndemo-kit
git clone https://github.com/<you>/ndemo-kit ~/tools/ndemo-kit
cd ~/tools/ndemo-kit

# macOS / Linux:
./install.sh

# Windows (PowerShell):
.\install.ps1
```

The installer verifies Node ≥ 20 + ffmpeg + Python, then installs:

- [splitbrain/ndemo](https://github.com/splitbrain/ndemo) into `~/tools/ndemo` (Playwright CDP demo runner)
- Playwright chromium browser
- [edge-tts](https://pypi.org/project/edge-tts/) via pip (for auto narration)

---

## Producing a demo for any project

### 1. Bootstrap

```bash
# macOS / Linux
~/tools/ndemo-kit/new-demo.sh /path/to/your-project feature-tour http://localhost:3000

# Windows
& "$HOME\tools\ndemo-kit\new-demo.ps1" "C:\path\to\your-project" feature-tour http://localhost:3000

# Any platform
node ~/tools/ndemo-kit/new-demo.mjs /path/to/your-project feature-tour http://localhost:3000
```

Add `--starter` if the target project is brand new and you want the
demo to drive its design. See `STARTER_MODE.md`.

That creates `your-project/demo/feature-tour/` with a stub
`playbook.yaml`, the helper scripts, a per-platform render wrapper, and
an empty `audio/` directory.

### 2. Edit `playbook.yaml`

Replace the placeholder narration text and actions. See
`examples/playbook.example.yaml` for every action type, target style,
and done condition.

The playbook is a list of **segments**. Each segment is a chunk of
narration + the browser actions that should happen during it.

### 3. Start your dev server

Whatever command you normally use, on the URL you put in the playbook.

### 4. Render

```bash
cd /path/to/your-project/demo/feature-tour

# macOS / Linux
./render.sh

# Windows
.\render.ps1

# Any platform
node render.mjs
```

`render` will:

1. Verify ffmpeg + ndemo + the dev server are reachable
2. Generate missing audio via edge-tts (or fall back to manual flow)
3. Stage the MP3s into ndemo's audio cache with the right hash filenames
4. Run ndemo render — Playwright drives the browser, CDP captures frames, ffmpeg merges

Output: `demo.mp4` (+ `demo.srt`). Total runtime: ~2–3 min for a 90-s demo.

---

## When edge-tts isn't available

If `edge-tts` can't be installed (no Python, restricted network, etc.)
the render script falls back to a manual flow:

1. Writes `NARRATION_SCRIPT.txt` in the demo folder — every segment's
   filename + narration text, copy-paste ready.
2. Exits cleanly with a clear instruction:
   - Open `NARRATION_SCRIPT.txt`
   - Generate each MP3 on any free TTS site (ttsmaker.com,
     naturalreaders.com, your OS's read-aloud, etc.)
   - Save them as `audio/<segment-id>.mp3`
   - Re-run `./render.sh`
3. On re-run, finds the MP3s and continues normally.

You can also force this flow with `node generate-audio.mjs --script-only`.

---

## Starter mode vs retrofit mode

The kit works two ways:

### Starter mode — build the app around the demo

Use when starting a new project. The demo narration becomes the spec:

1. Write the demo narration first (3–8 segments).
2. Build only the routes / components the narration shows.
3. Pre-instrument every targeted element with `data-testid` attributes.
4. Wire a `NEXT_PUBLIC_DEMO_MODE=1` flag from day one for deterministic playback.
5. Skip every screen, animation, toast, polling loop, and analytics
   call the demo doesn't show.

See `STARTER_MODE.md` for the full design principles.

### Retrofit mode — add demos to an existing app

Use when the app already exists. Minimal additive changes:

1. Add `data-testid` attributes to the elements the playbook will target.
2. If the app calls a live LLM / streaming API, add the scripted mock
   from `examples/demo-script.example.ts`.
3. Apply the Tailwind v4 + Turbopack workspace tweaks if needed (see
   `RECIPE.md`).
4. Author the playbook against the existing UI.

For Claude-driven work, paste `HANDOFF_PROMPT.md` into a Claude Code
session in the target project — Claude auto-detects the mode and
follows the right authoring order.

---

## Folder layout of a demo

```
your-project/demo/feature-tour/
├── playbook.yaml          ← what to say and what to click
├── README.md              ← per-demo quickstart
├── prep-audio.mjs         ← stages MP3s into ndemo's cache (don't edit)
├── generate-audio.mjs     ← auto-TTS via edge-tts + manual fallback
├── render.mjs             ← orchestration (cross-platform Node)
├── render.sh              ← Unix wrapper
├── render.ps1             ← Windows wrapper
├── package.json           ← yaml dep
├── audio/                 ← <segment-id>.mp3 lives here
└── video-raw/             ← intermediate frames + ndemo cache
demo.mp4 / demo.srt        ← final outputs at the demo dir root
```

---

## Files in this repo

| Path | Purpose |
|---|---|
| `install.{mjs,sh,ps1}` | One-time setup |
| `new-demo.{mjs,sh,ps1}` | Bootstrap a demo into any project |
| `scripts/render.{mjs,sh,ps1}` | Orchestrate render (copied into each demo) |
| `scripts/prep-audio.mjs` | Stage MP3s with hash filenames |
| `scripts/generate-audio.mjs` | Auto-TTS via edge-tts + fallback script writer |
| `scripts/package.json` | Local `yaml` dep for the scripts |
| `examples/playbook.example.yaml` | Annotated reference for every action type |
| `examples/demo-script.example.ts` | Scripted-mode mock for AI/streaming apps |
| `STARTER_MODE.md` | Demo-driven design principles for new projects |
| `RECIPE.md` | Pipeline internals, why each trick exists, troubleshooting |
| `HANDOFF_PROMPT.md` | Prompt for handing demo work to Claude Code |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Header missing` errors during merge | TTS produced non-standard MP3 frames | `prep-audio.mjs` re-encodes automatically — should not recur |
| `OPENAI_API_KEY` error during render | An audio file's hash doesn't match the YAML | Check `playbook.tts.{voice,speed}` are stable; re-run `prep-audio.mjs` |
| `Cannot find package 'yaml'` | First run in a fresh demo dir | `render` auto-runs `npm install` in the demo dir |
| ndemo can't find a button | Selector mismatch | `~/tools/ndemo/ndemo open <playbook>` then `~/tools/ndemo/ndemo page-state` to inspect the accessibility tree |
| Demo drifts between runs | App has live backend producing variable output | See `examples/demo-script.example.ts` for the scripted-mode mock |
| Turbopack panics reading `.ndemo/.../SingletonSocket` | Tailwind v4 source-scans the chromium profile dir | `@source not "../../demo";` in `globals.css` |
| Audio engine unavailable | No edge-tts, no Google key | Open `NARRATION_SCRIPT.txt`, generate MP3s manually, re-run |

---

## Credits

Builds on [splitbrain/ndemo](https://github.com/splitbrain/ndemo) for
the Playwright/CDP capture pipeline and
[rany2/edge-tts](https://github.com/rany2/edge-tts) for free neural
narration.

## License

MIT — see `LICENSE`.

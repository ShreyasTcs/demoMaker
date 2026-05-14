# RECIPE — how this kit actually works

Deeper reference for anyone (human or Claude) who wants to understand
the pipeline, modify it, or debug something unusual.

---

## What gets built

```
            ┌───────────────────────┐
            │     playbook.yaml     │   ← you author this
            └──────────┬────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
generate-audio.mjs               render.sh (orchestrates)
        │                             │
        ▼                             ▼
audio/<seg>.mp3        ┌──────────┴──────────┐
                       ▼                     ▼
              prep-audio.mjs           ndemo render
                       │                     │
                       ▼                     ▼
       video-raw/audio/<seg>-<hash>.mp3   chromium (CDP screencast)
                                     │       │
                                     │       ▼
                                     │   video-raw/.frames/
                                     │       │
                                     └───┬───┘
                                         ▼
                                  ffmpeg merger
                                         │
                                         ▼
                                    demo.mp4
                                    demo.srt
```

---

## The four key tricks

### 1. CDP screencast vs screen recording

ndemo uses Chrome DevTools Protocol's `Page.startScreencast` to capture
the browser viewport directly — not the desktop. Three benefits:

- No macOS screen-recording permission prompts
- No risk of capturing notifications, dock, menubar, or other apps
- Frame rate and resolution are deterministic regardless of system load

### 2. Audio cache hashing (bypassing OpenAI)

ndemo's `render` command would normally call OpenAI's TTS API to produce
narration. We don't want that dependency. The bypass:

ndemo computes `hash = sha256(narration + voice + speed)[:8]` for each
segment, then looks for `audio/<segment-id>-<hash>.mp3`. If the file
exists, it's used as-is and OpenAI is never called. `prep-audio.mjs`
exploits this: it takes whatever MP3 you have in `./audio/<seg>.mp3`
and copies it to that exact hash-suffixed path.

Implication: the YAML's `narration`, `tts.voice`, and `tts.speed` fields
must stay stable. Change any of them and the hash changes, the cached
file is no longer found, and ndemo will try to hit OpenAI.

### 3. MP3 normalisation

TTS sites — including edge-tts — sometimes emit MP3 streams with
non-standard frame layouts (mismatched sample rates, partial Xing
headers, ID3v2 quirks). ndemo's merger uses `ffmpeg -c copy` on the
audio side, which assumes valid streams and panics on the malformed
ones with thousands of `Header missing` errors.

`prep-audio.mjs` defends against this by re-encoding to canonical CBR
192 kbps, 44.1 kHz, stereo, with `-write_xing 0` (no Xing header) during
the staging copy. Output is always playable by every decoder ndemo
touches.

### 4. Playbook auto-discovery

Every script in this kit (`render.sh`, `prep-audio.mjs`,
`generate-audio.mjs`) finds the playbook by globbing `*.yaml` in its
own directory. One YAML per demo folder is the convention. No
hardcoded names — the kit works regardless of what you call your demo.

---

## Timing alignment

ndemo writes `audioDuration` and `videoDuration` back into each segment
after a render run. Use these to calibrate:

| Relationship | What happened | Fix |
|---|---|---|
| `audioDuration > videoDuration` | Browser actions finished before narration | Add a trailing `wait` to lengthen the visual |
| `audioDuration < videoDuration` | Browser actions overflowed past narration | Tighten waits, lower `delay` values, or shorten typed text |
| `audioDuration ≈ videoDuration + 500 ms` | About right — small audio buffer at segment end | Keep |

The merger handles slight mismatches per segment with silence padding,
but big gaps drift the overall video out of sync with the narration arc.

---

## Voice consistency

`generate-audio.mjs --voice <name>` controls only the TTS engine's voice.
The YAML's `tts.voice` is just a hash identifier — keep it stable
(`alloy` is fine) so prep-audio knows where to put files.

If you change voices mid-project, regenerate **all** segments with the
new voice and keep `playbook.tts.voice` the same. The audio files
themselves change; the YAML doesn't need to.

Free voices worth trying via edge-tts:

| Voice | Description |
|---|---|
| `en-US-AndrewNeural` | Warm professional male — default |
| `en-US-AriaNeural` | Clear professional female |
| `en-US-DavisNeural` | Deeper male, slightly authoritative |
| `en-US-JennyNeural` | Friendly, conversational female |
| `en-GB-RyanNeural` | British male, calm |
| `en-AU-NatashaNeural` | Australian female, warm |

Full list: `edge-tts --list-voices | less`.

---

## When the app is AI-powered

If your app's UI is driven by a live LLM / streaming API / WebSocket
that returns different output every run, the demo will drift between
renders. The narration won't match the on-screen text.

Fix: scripted demo mode. Add an env flag like `NEXT_PUBLIC_DEMO_MODE=1`
and a small mock in your client networking layer that replays a
hardcoded fixture instead of calling the real backend. See
`examples/demo-script.example.ts`.

The mock should preserve the streaming UX — text appearing in chunks,
tool-call badges popping in and out, choice buttons rendering after the
message completes. That's what makes the demo visually compelling.

---

## Common pitfalls

**Forgetting the env flag**

If your app needs `NEXT_PUBLIC_DEMO_MODE=1`, you have to pass it when
starting the dev server. Setting it after the server starts has no
effect — Next bakes `NEXT_PUBLIC_*` vars into the client bundle at
request time.

**Tailwind v4 scanning the demo dir**

If you use Tailwind v4 (`@import "tailwindcss"`), its source scanner
walks the whole project. ndemo creates a chromium profile at
`demo/<name>/.ndemo/browser-profile/` containing a Unix socket file
that Tailwind tries to read like text. Result: Turbopack panic. Fix:

```css
@import "tailwindcss";
@source not "../../demo";
@source not "../../node_modules";
@source not "../../.next";
```

**Multiple lockfiles confusing Turbopack**

If your Next app sits inside a workspace that has its own
`package-lock.json`, Turbopack will pick the wrong root and start
watching the parent tree (including any node_modules in it). Fix:

```ts
// next.config.ts
import path from "path";
const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
};
```

**Heavy native modules being bundled**

Apps that depend on packages with large native binaries (e.g. the
Anthropic SDK on ARM64 ships a ~200 MB binary) need them marked as
server-external so webpack doesn't try to traverse them on every
compile:

```ts
serverExternalPackages: ["@your-org/your-heavy-pkg"]
```

**Selector drift**

`role: button, name: "..."` selectors break when button text changes.
Add `data-testid` attributes to elements you'll target in the playbook
before authoring it. ndemo accepts `target: { testId: "x" }` — far more
stable than CSS or accessible-name selectors.

---

## Extending

**Adding a new TTS engine**

Edit `scripts/generate-audio.mjs`. Add a `generateXxx(text, out)`
function and wire it into the `--engine=xxx` switch. Keep the function
signature consistent: produce an MP3 at the given path.

**Customising the bootstrap stub**

Edit `new-demo.sh` — the playbook stub is a heredoc at the bottom.
Replace the placeholder segments with whatever convention your team
likes.

**Adding setup hooks**

Playbooks support an `app.setup` array that runs before each render —
useful for resetting fixture data, logging in, or seeding state. See
the commented example at the top of `examples/playbook.example.yaml`.

---

## Why these choices

| Decision | Alternative | Why chosen |
|---|---|---|
| ndemo (CDP screencast) | macOS screencapture / OBS / Loom | No permissions; viewport-only; scriptable |
| edge-tts | OpenAI / ElevenLabs / Google Cloud | Free; neural quality; no auth |
| YAML playbook | JSON / DSL / TS config | Multi-line strings without escaping; comment support |
| Hash-cached audio bypass | Fork ndemo to support new TTS | Zero ndemo modifications; survives upstream updates |
| One YAML per demo dir | Single mega-config | Auto-discovery; clean git history per demo |

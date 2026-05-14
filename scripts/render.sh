#!/usr/bin/env bash
# Render a narrated demo MP4 using ndemo (Playwright/CDP screencast).
#
# Auto-discovers the playbook *.yaml in this directory. Auto-installs
# the local yaml dep if missing. Auto-generates missing MP3s via
# generate-audio.mjs if found, else fails with a clear message.
#
# Usage:  ./render.sh
# Output: ./demo.mp4 (+ ./demo.srt)
#
# Env overrides:
#   NDEMO=/path/to/ndemo/binary    (default: ~/tools/ndemo/ndemo)

set -euo pipefail
cd "$(dirname "$0")"

NDEMO="${NDEMO:-$HOME/tools/ndemo/ndemo}"

# ── Discover the playbook YAML ───────────────────────────────
PLAYBOOK=""
for f in *.yaml *.yml; do
  [ -f "$f" ] || continue
  if [ -z "$PLAYBOOK" ]; then PLAYBOOK="$PWD/$f"; fi
done
if [ -z "$PLAYBOOK" ]; then
  echo "✗ No playbook *.yaml found in $PWD"; exit 1
fi

OUTPUT="$PWD/demo.mp4"

# ── Sanity checks ────────────────────────────────────────────
echo "═══ 1/4  Checking prerequisites ═══"
command -v ffmpeg >/dev/null 2>&1 || { echo "✗ ffmpeg not installed"; exit 1; }
[ -x "$NDEMO" ] || { echo "✗ ndemo not found at $NDEMO. Run install.sh"; exit 1; }

# Read app URL from playbook and verify it's up
APP_URL=$(grep -E '^\s*url:' "$PLAYBOOK" | head -1 | sed -E 's/.*url:\s*"?([^"]+)"?\s*$/\1/')
if ! curl -fsS --max-time 3 "$APP_URL" > /dev/null 2>&1; then
  echo "✗ App not responding at $APP_URL"
  echo "  Start your dev server first (and any required env flags)."
  exit 1
fi
echo "  ✓ app reachable at $APP_URL"

# ── Local yaml dep ───────────────────────────────────────────
if [ ! -d node_modules/yaml ]; then
  echo "  → installing local yaml dep"
  npm install --silent
fi

# ── Generate missing audio (if generate-audio.mjs present) ───
echo
echo "═══ 2/4  Resolving narration audio ═══"
SEGMENTS=$(node -e "
  import('yaml').then(({default:y}) => {
    const fs=require('fs');
    const pb = y.parse(fs.readFileSync('$PLAYBOOK','utf8'));
    console.log(pb.segments.filter(s=>s.narration).map(s=>s.id).join(' '));
  });
")
MISSING=()
for s in $SEGMENTS; do
  [ -s "audio/${s}.mp3" ] || MISSING+=("$s")
done

if [ ${#MISSING[@]} -ne 0 ]; then
  echo "  Missing: ${MISSING[*]}"
  if [ -x ./generate-audio.mjs ]; then
    echo "  → auto-generating via generate-audio.mjs"
    ./generate-audio.mjs
  else
    echo "✗ Missing source MP3s and no generate-audio.mjs found."
    echo "  Drop MP3s named: ${MISSING[*]/%/.mp3} into ./audio/"
    exit 1
  fi
else
  echo "  ✓ all ${#SEGMENTS[@]} narration MP3s present"
fi

# ── Stage audio with hash filenames ──────────────────────────
echo
echo "═══ 3/4  Staging audio into ndemo cache ═══"
node prep-audio.mjs

# ── Render ───────────────────────────────────────────────────
echo
echo "═══ 4/4  Rendering via Playwright/CDP ═══"
echo "  A chromium window will open and run the demo. Don't close it."

# Dummy OpenAI key only to satisfy lazy SDK init — never actually called
# because every audio file is hash-cached at this point.
export OPENAI_API_KEY="${OPENAI_API_KEY:-sk-cached-audio-no-call}"

"$NDEMO" render "$PLAYBOOK" --output "$OUTPUT"

# ── Done ─────────────────────────────────────────────────────
if [ -f "$OUTPUT" ]; then
  SIZE_MB=$(du -m "$OUTPUT" | cut -f1)
  DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUTPUT")
  echo
  echo "✓ Done"
  echo "  Video:     $OUTPUT  (${SIZE_MB} MB, ${DUR}s)"
  [ -f "${OUTPUT%.mp4}.srt" ] && echo "  Subtitles: ${OUTPUT%.mp4}.srt"
else
  echo "✗ Render finished but $OUTPUT not found"
  exit 1
fi

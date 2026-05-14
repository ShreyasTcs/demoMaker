#!/usr/bin/env bash
# Bootstrap a new demo into any project.
#
# Creates  <project>/demo/<demo-name>/  with:
#   playbook.yaml       (skeleton, pre-filled with app URL)
#   prep-audio.mjs      (copy from kit scripts/)
#   generate-audio.mjs  (copy from kit scripts/)
#   render.sh           (copy from kit scripts/)
#   package.json        (yaml dep)
#   audio/              (empty — generated or manual)
#
# Usage:
#   ./new-demo.sh <project-dir> <demo-name> [app-url]
#
# Examples:
#   ./new-demo.sh ~/projects/my-app feature-tour http://localhost:3000
#   ./new-demo.sh . onboarding-flow

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <project-dir> <demo-name> [app-url]"
  echo "  project-dir   target project root"
  echo "  demo-name     short lowercase-with-dashes name"
  echo "  app-url       optional, default http://localhost:3000"
  exit 1
fi

KIT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$1" && pwd)"
DEMO_NAME="$2"
APP_URL="${3:-http://localhost:3000}"

# Validate demo name
if ! [[ "$DEMO_NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "✗ demo-name must be lowercase alphanumeric with dashes only"
  exit 1
fi

DEMO_DIR="$PROJECT_DIR/demo/$DEMO_NAME"
if [ -e "$DEMO_DIR" ]; then
  echo "✗ $DEMO_DIR already exists"
  exit 1
fi

echo "▶ Creating $DEMO_DIR"
mkdir -p "$DEMO_DIR/audio"

# Copy helper scripts
cp "$KIT_DIR/scripts/prep-audio.mjs"     "$DEMO_DIR/"
cp "$KIT_DIR/scripts/generate-audio.mjs" "$DEMO_DIR/"
cp "$KIT_DIR/scripts/render.sh"          "$DEMO_DIR/"
cp "$KIT_DIR/scripts/package.json"       "$DEMO_DIR/"
chmod +x "$DEMO_DIR/prep-audio.mjs" "$DEMO_DIR/generate-audio.mjs" "$DEMO_DIR/render.sh"

# Write skeleton playbook with the app URL pre-filled
cat > "$DEMO_DIR/playbook.yaml" <<EOF
# $DEMO_NAME — demo playbook.
# Edit the segments below. Each segment's narration is what the voice will
# say; the actions are what the browser will do during that segment.
#
# After editing:
#   ./generate-audio.mjs    # auto-generate MP3s from narration
#   ./render.sh             # produce demo.mp4

app:
  url: "$APP_URL"
  viewport: { width: 1920, height: 1080 }
  scale: 1
  zoom: 1.0
  colorScheme: light

# Don't change these — they're identifiers for ndemo's audio-cache hash.
# The actual TTS voice used is controlled by generate-audio.mjs flags.
tts:
  provider: openai
  voice: alloy
  speed: 1.0

recording:
  outputDir: video-raw
  fps: 30

segments:
  - id: intro
    intent: "Show the landing screen"
    narration: |
      Welcome to <your app>. In this short tour, we'll show the key
      capabilities and how they fit together.
    timing: parallel
    actions:
      - { type: wait, duration: 4000 }

  - id: feature-walkthrough
    intent: "Click through the main feature"
    narration: |
      Replace this segment with the part you want to show. Each segment
      maps to a clip of narration and a sequence of browser actions.
    timing: parallel
    actions:
      # Add click/type/wait actions here. Examples:
      # - { type: click, target: { role: button, name: "Start" }, done: { stable: 500 } }
      # - { type: type,  target: { testId: "search" }, text: "hello", delay: 50 }
      # - { type: wait,  duration: 3000 }
      - { type: wait, duration: 4000 }

  - id: closing
    intent: "Hold final frame"
    narration: |
      That's the tour. Thanks for watching.
    timing: parallel
    actions:
      - { type: wait, duration: 3000 }
EOF

echo
echo "✓ Demo scaffolded at:"
echo "    $DEMO_DIR"
echo
echo "Next steps:"
echo "  1. cd $DEMO_DIR"
echo "  2. Edit playbook.yaml — replace placeholder narration + actions"
echo "  3. Start your dev server at $APP_URL"
echo "  4. ./generate-audio.mjs        # or drop MP3s into audio/<segment-id>.mp3"
echo "  5. ./render.sh                 # → demo.mp4"

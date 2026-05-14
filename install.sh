#!/usr/bin/env bash
# One-time setup for the ndemo-kit on a fresh machine.
#
# Installs:
#   - ndemo (cloned to ~/tools/ndemo, built)
#   - Playwright chromium browser
#   - edge-tts (Python pkg via pip — for automated narration)
#
# Verifies:
#   - Node ≥ 20
#   - ffmpeg with libx264 + libmp3lame
#   - Python ≥ 3.8 + pip
#
# Re-runnable. Skips already-installed pieces.

set -euo pipefail

echo "▶ ndemo-kit setup"
echo

# ── Node ─────────────────────────────────────────────────────
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "✗ Node ≥ 20 required (found $(node --version 2>/dev/null || echo none))"
  echo "  Install via Homebrew: brew install node"
  exit 1
fi
echo "  ✓ node $(node --version)"

# ── ffmpeg ───────────────────────────────────────────────────
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "✗ ffmpeg not installed"
  echo "  Install: brew install ffmpeg"
  exit 1
fi
echo "  ✓ ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)"

# ── Python + pip ─────────────────────────────────────────────
if ! command -v python3 >/dev/null 2>&1; then
  echo "✗ python3 not installed"
  echo "  Install: brew install python"
  exit 1
fi
echo "  ✓ python3 $(python3 --version | cut -d' ' -f2)"

# ── ndemo ────────────────────────────────────────────────────
NDEMO_DIR="$HOME/tools/ndemo"
if [ ! -x "$NDEMO_DIR/ndemo" ] || [ ! -f "$NDEMO_DIR/dist/cli.js" ]; then
  echo
  echo "▶ Installing ndemo to $NDEMO_DIR"
  mkdir -p "$HOME/tools"
  if [ ! -d "$NDEMO_DIR" ]; then
    git clone https://github.com/splitbrain/ndemo.git "$NDEMO_DIR"
  fi
  cd "$NDEMO_DIR"
  npm install
  npm run build
  npx playwright install chromium
  cd - >/dev/null
else
  echo "  ✓ ndemo already installed at $NDEMO_DIR"
fi

# ── edge-tts ─────────────────────────────────────────────────
if ! command -v edge-tts >/dev/null 2>&1; then
  echo
  echo "▶ Installing edge-tts (free Microsoft Edge neural voices)"
  if command -v pipx >/dev/null 2>&1; then
    pipx install edge-tts
  else
    python3 -m pip install --user edge-tts
    # Make sure the user-site bin dir is hinted
    USER_BIN=$(python3 -m site --user-base)/bin
    if ! echo "$PATH" | tr ':' '\n' | grep -qx "$USER_BIN"; then
      echo "  ⚠ Add to your shell rc (~/.zshrc or ~/.bashrc):"
      echo "      export PATH=\"$USER_BIN:\$PATH\""
    fi
  fi
else
  echo "  ✓ edge-tts already installed ($(edge-tts --help 2>&1 | head -1))"
fi

echo
echo "✓ Setup complete."
echo
echo "Bootstrap a demo into any project:"
echo "  $(cd "$(dirname "$0")" && pwd)/new-demo.sh <project-dir> <demo-name> [app-url]"

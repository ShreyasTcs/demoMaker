#!/usr/bin/env bash
# Thin wrapper around render.mjs (all real logic lives there for cross-platform parity).
# Unix users: ./render.sh
# Windows users: .\render.ps1   (or node render.mjs)
exec node "$(dirname "$0")/render.mjs" "$@"

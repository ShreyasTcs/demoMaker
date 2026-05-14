#!/usr/bin/env bash
# Thin wrapper around new-demo.mjs (all logic lives there for cross-platform parity).
exec node "$(dirname "$0")/new-demo.mjs" "$@"

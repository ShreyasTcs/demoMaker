#!/usr/bin/env bash
# Thin wrapper around install.mjs (all real logic lives there for cross-platform parity).
exec node "$(dirname "$0")/install.mjs" "$@"

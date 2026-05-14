# Thin wrapper around render.mjs (Windows entry point).
# All real logic lives in render.mjs for cross-platform parity.
$ErrorActionPreference = "Stop"
node "$PSScriptRoot\render.mjs" @args
exit $LASTEXITCODE

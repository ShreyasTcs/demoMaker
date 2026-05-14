# Thin wrapper around new-demo.mjs (Windows entry point).
$ErrorActionPreference = "Stop"
node "$PSScriptRoot\new-demo.mjs" @args
exit $LASTEXITCODE

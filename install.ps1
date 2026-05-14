# Thin wrapper around install.mjs (Windows entry point).
$ErrorActionPreference = "Stop"
node "$PSScriptRoot\install.mjs" @args
exit $LASTEXITCODE

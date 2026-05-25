# Windows entry point for ndemo-kit render.
# Auto-discovers ffmpeg and edge-tts if they are installed but not on PATH.
# All render logic lives in render.mjs for cross-platform parity.
$ErrorActionPreference = "Stop"

# ── ffmpeg: search common install locations ───────────────────────────────────
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  $candidates = @(
    "$env:USERPROFILE\tools\ffmpeg",
    "$env:ProgramFiles\ffmpeg",
    "$env:ProgramFiles(x86)\ffmpeg",
    "C:\ffmpeg",
    "$env:USERPROFILE\scoop\shims"
  )
  foreach ($base in $candidates) {
    if (Test-Path $base) {
      $exe = Get-ChildItem $base -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue |
             Select-Object -First 1
      if ($exe) {
        $env:PATH = "$($exe.DirectoryName);$env:PATH"
        break
      }
    }
  }
}

# ── edge-tts: scan versioned Python Scripts dirs ──────────────────────────────
if (-not (Get-Command edge-tts -ErrorAction SilentlyContinue)) {
  $roaming = "$env:APPDATA\Python"
  if (Test-Path $roaming) {
    Get-ChildItem $roaming -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $scripts = "$($_.FullName)\Scripts"
      if (Test-Path "$scripts\edge-tts.exe") {
        $env:PATH = "$scripts;$env:PATH"
      }
    }
    # Also check non-versioned Scripts subdir
    $plain = "$roaming\Scripts"
    if (Test-Path "$plain\edge-tts.exe") {
      $env:PATH = "$plain;$env:PATH"
    }
  }
}

node "$PSScriptRoot\render.mjs" @args
exit $LASTEXITCODE

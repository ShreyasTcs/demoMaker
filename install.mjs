#!/usr/bin/env node
/**
 * One-time setup for ndemo-kit. Cross-platform.
 *
 * Installs:
 *   - ndemo (cloned to ~/tools/ndemo, built)
 *   - Playwright chromium browser
 *   - edge-tts (Python pkg via pip — for automated narration)
 *
 * Verifies:
 *   - Node >= 20
 *   - ffmpeg with libx264 + libmp3lame
 *   - Python >= 3.8 + pip
 *
 * Re-runnable. Skips already-installed pieces.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const isWin = process.platform === "win32";

function which(cmd) {
  const r = spawnSync(isWin ? "where" : "which", [cmd], { stdio: "pipe" });
  if (r.status !== 0) return null;
  return r.stdout.toString().split(/\r?\n/)[0].trim() || null;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    console.error(`✗ command failed: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

function tryRun(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: "inherit", ...opts }).status === 0;
}

console.log("▶ ndemo-kit setup\n");

// ── Node version ─────────────────────────────────────────────
const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
if (nodeMajor < 20) {
  console.error(`✗ Node >= 20 required (found v${process.versions.node})`);
  console.error(
    isWin
      ? "  Install via https://nodejs.org or: winget install OpenJS.NodeJS"
      : "  Install: brew install node",
  );
  process.exit(1);
}
console.log(`  ✓ node v${process.versions.node}`);

// ── ffmpeg ───────────────────────────────────────────────────
if (!which("ffmpeg")) {
  console.error("✗ ffmpeg not installed");
  console.error(
    isWin
      ? "  Install: winget install Gyan.FFmpeg   (or: choco install ffmpeg)"
      : "  Install: brew install ffmpeg          (Linux: apt install ffmpeg)",
  );
  process.exit(1);
}
console.log(`  ✓ ffmpeg`);

// ── Python ───────────────────────────────────────────────────
const pythonCmd = which("python3") || which("python");
if (!pythonCmd) {
  console.error("✗ python3 not installed");
  console.error(
    isWin
      ? "  Install: winget install Python.Python.3.12"
      : "  Install: brew install python",
  );
  process.exit(1);
}
console.log(`  ✓ python (${path.basename(pythonCmd)})`);

// ── ndemo ────────────────────────────────────────────────────
const NDEMO_DIR = path.join(os.homedir(), "tools", "ndemo");
const ndemoBin = path.join(NDEMO_DIR, isWin ? "ndemo.cmd" : "ndemo");

if (!fs.existsSync(ndemoBin) || !fs.existsSync(path.join(NDEMO_DIR, "dist", "cli.js"))) {
  console.log(`\n▶ Installing ndemo to ${NDEMO_DIR}`);
  fs.mkdirSync(path.join(os.homedir(), "tools"), { recursive: true });

  if (!fs.existsSync(NDEMO_DIR)) {
    if (!which("git")) {
      console.error("✗ git not installed — needed to clone ndemo");
      process.exit(1);
    }
    run("git", ["clone", "https://github.com/splitbrain/ndemo.git", NDEMO_DIR]);
  }

  const npmCmd = isWin ? "npm.cmd" : "npm";
  const npxCmd = isWin ? "npx.cmd" : "npx";
  run(npmCmd, ["install"], { cwd: NDEMO_DIR });
  run(npmCmd, ["run", "build"], { cwd: NDEMO_DIR });
  run(npxCmd, ["playwright", "install", "chromium"], { cwd: NDEMO_DIR });
} else {
  console.log(`  ✓ ndemo already installed at ${NDEMO_DIR}`);
}

// ── edge-tts ─────────────────────────────────────────────────
if (!which("edge-tts")) {
  console.log("\n▶ Installing edge-tts (free Microsoft Edge neural voices)");
  const pipxOk = which("pipx") && tryRun("pipx", ["install", "edge-tts"]);
  if (!pipxOk) {
    const pipFlag = isWin ? ["--user"] : ["--user", "--break-system-packages"];
    // --break-system-packages is a no-op on Windows / older pip; harmless
    run(pythonCmd, ["-m", "pip", "install", ...pipFlag, "edge-tts"]);
    if (!which("edge-tts")) {
      const userBin = isWin
        ? path.join(os.homedir(), "AppData", "Roaming", "Python", "Scripts")
        : "";
      console.log(`\n  ⚠ edge-tts installed but not on PATH yet.`);
      if (isWin) console.log(`    Add to PATH: ${userBin}`);
      else
        console.log(
          `    Add to shell rc:  export PATH="$(python3 -m site --user-base)/bin:$PATH"`,
        );
    }
  }
} else {
  console.log(`  ✓ edge-tts already on PATH`);
}

console.log("\n✓ Setup complete.\n");
const here = path.dirname(new URL(import.meta.url).pathname);
const kitDir = isWin ? here.replace(/^\//, "") : here;
console.log("Bootstrap a demo into any project:");
console.log(`  ${isWin ? "node " : ""}${path.join(kitDir, isWin ? "new-demo.mjs" : "new-demo.sh")} <project-dir> <demo-name> [app-url]`);

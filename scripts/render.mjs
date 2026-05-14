#!/usr/bin/env node
/**
 * Render a narrated demo MP4 using ndemo (Playwright/CDP screencast).
 *
 * Cross-platform: pure Node, no shell. Wrapped by render.sh (Unix) and
 * render.ps1 (Windows) for convenience.
 *
 * Auto-discovers the playbook *.yaml in this directory. Auto-installs
 * the local yaml dep if missing. Auto-generates missing MP3s via
 * generate-audio.mjs if found, else writes NARRATION_SCRIPT.txt and
 * exits with a clear "go generate your audio" message.
 *
 * Env overrides:
 *   NDEMO_BIN=/abs/path/to/ndemo   (default: ~/tools/ndemo/ndemo[.cmd])
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const isWin = process.platform === "win32";

function which(cmd) {
  const r = spawnSync(isWin ? "where" : "which", [cmd], { stdio: "pipe" });
  if (r.status !== 0) return null;
  return r.stdout.toString().split(/\r?\n/)[0].trim() || null;
}

function fail(msg, code = 1) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function findPlaybook() {
  const yamls = fs
    .readdirSync(__dirname)
    .filter((f) => /\.ya?ml$/i.test(f) && !f.startsWith("."));
  if (yamls.length === 0) return null;
  if (yamls.length === 1) return path.join(__dirname, yamls[0]);
  const named = yamls.find(
    (f) => f === "playbook.yaml" || f === path.basename(__dirname) + ".yaml",
  );
  return named ? path.join(__dirname, named) : path.join(__dirname, yamls[0]);
}

const NDEMO_BIN =
  process.env.NDEMO_BIN ??
  path.join(
    os.homedir(),
    "tools",
    "ndemo",
    isWin ? "ndemo.cmd" : "ndemo",
  );

console.log("═══ 1/4  Checking prerequisites ═══");

if (!which("ffmpeg")) fail("ffmpeg not installed. brew/choco/apt install ffmpeg");
if (!fs.existsSync(NDEMO_BIN)) {
  fail(
    `ndemo not found at ${NDEMO_BIN}\n  Run the kit's install script first, or set NDEMO_BIN env var.`,
  );
}

const PLAYBOOK = findPlaybook();
if (!PLAYBOOK) fail(`No playbook *.yaml found in ${__dirname}`);

const playbookRaw = fs.readFileSync(PLAYBOOK, "utf8");
const urlMatch = playbookRaw.match(/^\s*url:\s*["']?([^"'\r\n]+)/m);
const APP_URL = urlMatch?.[1]?.trim();
if (!APP_URL) fail(`Could not read app.url from ${PLAYBOOK}`);

// Health-check the app
const healthCheck = await fetch(APP_URL, { signal: AbortSignal.timeout(3000) })
  .then((r) => r.ok || r.status < 500)
  .catch(() => false);
if (!healthCheck) {
  fail(
    `App not responding at ${APP_URL}\n  Start your dev server first (and any env flags it needs).`,
  );
}
ok(`app reachable at ${APP_URL}`);

// Local yaml dep
if (!fs.existsSync(path.join(__dirname, "node_modules", "yaml"))) {
  console.log("  → installing local yaml dep");
  const r = spawnSync(isWin ? "npm.cmd" : "npm", ["install", "--silent"], {
    cwd: __dirname,
    stdio: "inherit",
  });
  if (r.status !== 0) fail("npm install failed");
}

// Lazy-load yaml now that it's installed
const yaml = (await import("yaml")).default;
const playbook = yaml.parse(playbookRaw);
const expected = playbook.segments
  .filter((s) => s.narration)
  .map((s) => s.id);

console.log("\n═══ 2/4  Resolving narration audio ═══");
const audioDir = path.join(__dirname, "audio");
fs.mkdirSync(audioDir, { recursive: true });
const missing = expected.filter(
  (id) => !fs.existsSync(path.join(audioDir, `${id}.mp3`)),
);

if (missing.length > 0) {
  console.log(`  missing: ${missing.join(", ")}`);
  const genScript = path.join(__dirname, "generate-audio.mjs");
  if (fs.existsSync(genScript)) {
    console.log("  → trying auto-generation via generate-audio.mjs");
    const r = spawnSync(process.execPath, [genScript], {
      cwd: __dirname,
      stdio: "inherit",
    });
    if (r.status === 2) {
      // generate-audio.mjs exits 2 when it falls back to writing the
      // narration-script file. Stop cleanly and prompt the user.
      console.log("\n══════════════════════════════════════════════════════════");
      console.log(" Auto-generation unavailable — falling back to manual flow.");
      console.log("══════════════════════════════════════════════════════════");
      console.log(` See: ${path.join(__dirname, "NARRATION_SCRIPT.txt")}`);
      console.log(" Generate the MP3s on any free TTS site, drop them into");
      console.log(` ${path.relative(process.cwd(), audioDir)}/`);
      console.log(" then re-run this script.");
      process.exit(2);
    }
    if (r.status !== 0) fail("generate-audio.mjs failed", r.status ?? 1);
  } else {
    fail(
      `Missing MP3s and no generate-audio.mjs to fall back to.\n  Drop these files into ${audioDir}/:\n    ${missing.map((m) => m + ".mp3").join("\n    ")}`,
    );
  }
}
ok(`all ${expected.length} narration MP3s present`);

console.log("\n═══ 3/4  Staging audio into ndemo cache ═══");
{
  const r = spawnSync(process.execPath, [path.join(__dirname, "prep-audio.mjs")], {
    cwd: __dirname,
    stdio: "inherit",
  });
  if (r.status !== 0) fail("prep-audio.mjs failed", r.status ?? 1);
}

console.log("\n═══ 4/4  Rendering via Playwright/CDP ═══");
console.log("  A chromium window will open and run the demo. Don't close it.");

// Dummy OPENAI key so the OpenAI SDK's lazy init never throws — real
// calls never happen because every segment audio is hash-cached.
process.env.OPENAI_API_KEY ??= "sk-cached-audio-no-call";

const OUTPUT = path.join(__dirname, "demo.mp4");
const r = spawnSync(NDEMO_BIN, ["render", PLAYBOOK, "--output", OUTPUT], {
  cwd: __dirname,
  stdio: "inherit",
  env: process.env,
});
if (r.status !== 0) fail("ndemo render failed", r.status ?? 1);

if (!fs.existsSync(OUTPUT)) fail(`Render finished but ${OUTPUT} not found`);

try {
  const probe = execSync(
    `ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${OUTPUT}"`,
    { stdio: ["ignore", "pipe", "pipe"] },
  )
    .toString()
    .trim();
  const sizeMb = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1);
  console.log(`\n✓ Done`);
  console.log(`  Video:     ${OUTPUT}  (${sizeMb} MB, ${probe}s)`);
  const srt = OUTPUT.replace(/\.mp4$/, ".srt");
  if (fs.existsSync(srt)) console.log(`  Subtitles: ${srt}`);
} catch {
  console.log(`\n✓ Done — ${OUTPUT}`);
}

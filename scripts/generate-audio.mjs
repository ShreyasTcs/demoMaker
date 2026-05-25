#!/usr/bin/env node
/**
 * Automated narration audio generator for ndemo-kit demos.
 *
 * Reads the playbook *.yaml in this directory, generates one MP3 per
 * segment narration, and writes them to ./audio/<segment-id>.mp3
 *
 * Engines (in priority order):
 *   1. edge-tts (default)       — free, no auth, neural quality.
 *                                 Requires: pip install edge-tts
 *   2. Google Cloud TTS (REST)  — pass --engine=google + GOOGLE_TTS_API_KEY
 *
 * If no engine is available, writes ./NARRATION_SCRIPT.txt — a copy-paste
 * friendly file listing each segment's filename and text — and exits
 * with code 2. The user then generates MP3s on any free TTS site, drops
 * them into ./audio/<segment-id>.mp3, and re-runs ./render.sh.
 *
 * Usage:
 *   node generate-audio.mjs
 *   node generate-audio.mjs --voice en-US-AriaNeural
 *   node generate-audio.mjs --engine=google
 *   node generate-audio.mjs --force        # overwrite existing MP3s
 *   node generate-audio.mjs --script-only  # skip engines, write NARRATION_SCRIPT.txt
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const isWin = process.platform === "win32";

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return def;
  const a = argv[i];
  if (a.includes("=")) return a.split("=").slice(1).join("=");
  return argv[i + 1] ?? true;
};
const has = (name) => argv.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));

const ENGINE = flag("engine", "edge-tts");
const VOICE = flag("voice", "en-US-AndrewNeural");
const RATE = flag("rate", "-5%");
const PITCH = flag("pitch", "-2Hz");
const FORCE = has("force");
const SCRIPT_ONLY = has("script-only");
const LIST_VOICES = has("list-voices");

const NATURAL_VOICES = [
  { name: "en-US-AndrewNeural",  label: "Andrew  (US male, warm)"          },
  { name: "en-US-JennyNeural",   label: "Jenny   (US female, friendly)"    },
  { name: "en-US-AriaNeural",    label: "Aria    (US female, natural)"     },
  { name: "en-US-GuyNeural",     label: "Guy     (US male, confident)"     },
  { name: "en-US-EricNeural",    label: "Eric    (US male, clear)"         },
  { name: "en-US-BrianNeural",   label: "Brian   (US male, casual)"        },
  { name: "en-US-EmmaNeural",    label: "Emma    (US female, bright)"      },
  { name: "en-GB-RyanNeural",    label: "Ryan    (UK male, authoritative)" },
  { name: "en-GB-SoniaNeural",   label: "Sonia   (UK female, crisp)"       },
  { name: "en-AU-WilliamNeural", label: "William (AU male, casual)"        },
];

if (LIST_VOICES) {
  console.log("\nNatural neural voices available with edge-tts:\n");
  NATURAL_VOICES.forEach((v, i) =>
    console.log(`  ${String(i + 1).padStart(2)}.  ${v.name.padEnd(26)}  ${v.label}`)
  );
  console.log(`\nUsage:`);
  console.log(`  node generate-audio.mjs --voice en-US-JennyNeural --force`);
  console.log(`  node change-voice.mjs --voice jenny --render\n`);
  process.exit(0);
}

function which(cmd) {
  const r = spawnSync(isWin ? "where" : "which", [cmd], { stdio: "pipe" });
  return r.status === 0 && r.stdout.toString().trim() !== "";
}

function findPlaybook() {
  const yamls = fs
    .readdirSync(__dirname)
    .filter((f) => /\.ya?ml$/i.test(f) && !f.startsWith("."));
  if (yamls.length === 0) throw new Error("No playbook *.yaml in this directory");
  if (yamls.length === 1) return path.join(__dirname, yamls[0]);
  const named = yamls.find(
    (f) => f === "playbook.yaml" || f === path.basename(__dirname) + ".yaml",
  );
  if (named) return path.join(__dirname, named);
  return path.join(__dirname, yamls[0]);
}

// Lazy-install yaml dep if missing
if (!fs.existsSync(path.join(__dirname, "node_modules", "yaml"))) {
  const r = spawnSync(isWin ? "npm.cmd" : "npm", ["install", "--silent"], {
    cwd: __dirname,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error("✗ npm install failed");
    process.exit(1);
  }
}
const yaml = (await import("yaml")).default;

const playbookPath = findPlaybook();
const playbook = yaml.parse(fs.readFileSync(playbookPath, "utf8"));
const audioDir = path.join(__dirname, "audio");
fs.mkdirSync(audioDir, { recursive: true });

const segments = playbook.segments
  .filter((s) => s.narration)
  .map((s) => ({ id: s.id, text: s.narration.trim().replace(/\s+/g, " ") }));

if (segments.length === 0) {
  console.error("✗ No segments with narration found in playbook.");
  process.exit(1);
}

/* ── Manual-script fallback ──────────────────────────────────────── */

function writeNarrationScript() {
  const scriptPath = path.join(__dirname, "NARRATION_SCRIPT.txt");
  const lines = [
    "# Narration script for manual TTS",
    "#",
    "# Auto-generation engines were unavailable. Use any free TTS site",
    "# (e.g. ttsmaker.com, naturalreaders.com, or your OS's built-in",
    "# read-aloud) to record each block below as a separate MP3.",
    "#",
    "# Save each MP3 with the exact filename shown — case matters — and",
    "# drop them all into:",
    `#     ${path.relative(process.cwd(), audioDir)}/`,
    "#",
    "# Then re-run ./render.sh (or .\\render.ps1 on Windows).",
    "#",
    "# Tip: use the same voice for every clip so the audio flows when",
    "# segments are concatenated.",
    "",
    "",
  ];
  for (const seg of segments) {
    lines.push("─".repeat(70));
    lines.push(`FILE:   audio/${seg.id}.mp3`);
    lines.push(`LENGTH: ~${Math.round(seg.text.length / 14)}s at natural pace`);
    lines.push("─".repeat(70));
    lines.push("");
    lines.push(seg.text);
    lines.push("");
    lines.push("");
  }
  fs.writeFileSync(scriptPath, lines.join("\n"));
  console.log();
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`  Wrote ${segments.length} narration prompts to:`);
  console.log(`     ${scriptPath}`);
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  Open that file, generate each MP3 on a free TTS site, save");
  console.log(`  them as audio/<segment-id>.mp3, then re-run ./render.sh.`);
  console.log();
}

if (SCRIPT_ONLY) {
  writeNarrationScript();
  process.exit(0);
}

/* ── Engine probes ───────────────────────────────────────────────── */

if (ENGINE === "edge-tts" && !which("edge-tts")) {
  console.log("ℹ edge-tts not found on PATH.");
  console.log("  Install: pip install edge-tts   (or pipx install edge-tts)");
  console.log("  Falling back to NARRATION_SCRIPT.txt for manual generation.");
  writeNarrationScript();
  process.exit(2);
}
if (ENGINE === "google" && !process.env.GOOGLE_TTS_API_KEY) {
  console.log("ℹ GOOGLE_TTS_API_KEY not set for --engine=google.");
  writeNarrationScript();
  process.exit(2);
}

/* ── Engine implementations ──────────────────────────────────────── */

function edgeTts(text, out) {
  // edge-tts is a Python entry point — call as a child process
  const r = spawnSync(
    "edge-tts",
    [
      "--voice", VOICE,
      `--rate=${RATE}`,
      `--pitch=${PITCH}`,
      "--text", text,
      "--write-media", out,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  if (r.status !== 0) {
    throw new Error(`edge-tts failed: ${r.stderr?.toString() ?? "unknown"}`);
  }
}

async function googleTts(text, out) {
  const key = process.env.GOOGLE_TTS_API_KEY;
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: "en-US",
          name: VOICE.startsWith("en-") ? VOICE : "en-US-Neural2-D",
        },
        audioConfig: { audioEncoding: "MP3", speakingRate: 0.95, pitch: -1.5 },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Google TTS ${res.status}: ${await res.text()}`);
  }
  const { audioContent } = await res.json();
  fs.writeFileSync(out, Buffer.from(audioContent, "base64"));
}

/* ── Generate loop ───────────────────────────────────────────────── */

console.log(`▶ Engine: ${ENGINE}   Voice: ${VOICE}\n`);

let generated = 0, skipped = 0, failed = 0;
const failures = [];

for (const seg of segments) {
  const out = path.join(audioDir, `${seg.id}.mp3`);
  if (fs.existsSync(out) && !FORCE) {
    console.log(`  ↪ ${seg.id.padEnd(18)} (exists — use --force to overwrite)`);
    skipped++;
    continue;
  }
  process.stdout.write(`  → ${seg.id.padEnd(18)} (${seg.text.length} chars) … `);
  try {
    if (ENGINE === "google") await googleTts(seg.text, out);
    else edgeTts(seg.text, out);
    console.log("✓");
    generated++;
  } catch (err) {
    console.log("✗");
    failures.push({ id: seg.id, error: err.message });
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n✗ ${failed} segment${failed > 1 ? "s" : ""} failed:`);
  for (const f of failures) console.error(`    ${f.id}: ${f.error}`);
  console.log();
  writeNarrationScript();
  process.exit(2);
}

console.log(`\n✓ Generated ${generated} MP3s (${skipped} skipped) in audio/`);
console.log(`  Next: ./render.sh   (or .\\render.ps1 / node render.mjs)`);

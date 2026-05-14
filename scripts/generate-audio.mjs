#!/usr/bin/env node
/**
 * Automated narration audio generator for ndemo-kit demos.
 *
 * Reads the playbook *.yaml in this directory, generates one MP3 per
 * segment narration, and writes them to ./audio/<segment-id>.mp3
 *
 * Engines (in priority order):
 *   1. edge-tts (default)       — free, no auth, high-quality neural voices.
 *                                 Requires: pip install edge-tts
 *   2. Google Cloud TTS (REST)  — pass --engine=google + GOOGLE_TTS_API_KEY
 *
 * Manual fallback: just drop your own .mp3 files into ./audio/ with the
 * matching segment IDs (e.g. audio/intro.mp3). prep-audio.mjs will use
 * whatever it finds there and skip this script entirely.
 *
 * Usage:
 *   ./generate-audio.mjs
 *   ./generate-audio.mjs --voice en-US-AriaNeural
 *   ./generate-audio.mjs --engine=google
 *   ./generate-audio.mjs --force               # overwrite existing MP3s
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";
import yaml from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const RATE = flag("rate", "-5%");      // edge-tts: percentage signed string
const PITCH = flag("pitch", "-2Hz");    // edge-tts
const FORCE = has("force");

function findPlaybook() {
  const yamls = fs.readdirSync(__dirname).filter((f) => /\.ya?ml$/.test(f));
  if (yamls.length === 0) throw new Error("No playbook *.yaml in this directory");
  if (yamls.length === 1) return path.join(__dirname, yamls[0]);
  const named = yamls.find((f) => f === "playbook.yaml" || f === path.basename(__dirname) + ".yaml");
  if (named) return path.join(__dirname, named);
  throw new Error(`Ambiguous playbook: ${yamls.join(", ")}`);
}

function checkCmd(cmd) {
  return spawnSync("which", [cmd], { stdio: "ignore" }).status === 0;
}

async function generateEdgeTts(text, out) {
  if (!checkCmd("edge-tts")) {
    console.error("\n✗ edge-tts CLI is not on PATH.");
    console.error("  Install with: pip install edge-tts   (or: pipx install edge-tts)");
    console.error("  Or skip auto-generation and drop your own MP3s into ./audio/.");
    process.exit(1);
  }
  execSync(
    `edge-tts --voice "${VOICE}" --rate="${RATE}" --pitch="${PITCH}" ` +
    `--text ${JSON.stringify(text)} --write-media "${out}"`,
    { stdio: ["ignore", "ignore", "pipe"] },
  );
}

async function generateGoogle(text, out) {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) {
    console.error("✗ GOOGLE_TTS_API_KEY env var is required for --engine=google");
    process.exit(1);
  }
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-US", name: VOICE.startsWith("en-") ? VOICE : "en-US-Neural2-D" },
        audioConfig: { audioEncoding: "MP3", speakingRate: 0.95, pitch: -1.5 },
      }),
    },
  );
  if (!res.ok) {
    console.error(`✗ Google TTS error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const { audioContent } = await res.json();
  fs.writeFileSync(out, Buffer.from(audioContent, "base64"));
}

const playbookPath = findPlaybook();
const playbook = yaml.parse(fs.readFileSync(playbookPath, "utf8"));
const audioDir = path.join(__dirname, "audio");
fs.mkdirSync(audioDir, { recursive: true });

console.log(`▶ Engine: ${ENGINE}   Voice: ${VOICE}\n`);

let generated = 0, skipped = 0;
for (const seg of playbook.segments) {
  if (!seg.narration) continue;
  const out = path.join(audioDir, `${seg.id}.mp3`);
  const text = seg.narration.trim().replace(/\s+/g, " ");

  if (fs.existsSync(out) && !FORCE) {
    console.log(`  ↪ ${seg.id.padEnd(18)} (exists, skipping — use --force to overwrite)`);
    skipped++;
    continue;
  }

  process.stdout.write(`  → ${seg.id.padEnd(18)} (${text.length} chars) … `);
  try {
    if (ENGINE === "google") {
      await generateGoogle(text, out);
    } else {
      await generateEdgeTts(text, out);
    }
    console.log("✓");
    generated++;
  } catch (err) {
    console.log("✗");
    console.error(err.stderr?.toString() ?? err.message);
    process.exit(1);
  }
}

console.log(`\n✓ Generated ${generated} MP3s (${skipped} skipped) in audio/`);
console.log(`  Next: ./render.sh`);

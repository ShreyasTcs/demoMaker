#!/usr/bin/env node
/**
 * Stage manually-recorded or auto-generated MP3s into ndemo's audio cache
 * directory with the hash-suffixed filenames it expects. After this runs,
 * `ndemo render` will find the cached files and skip its OpenAI TTS step.
 *
 * Source:  ./audio/<segment-id>.mp3
 * Target:  <outputDir>/audio/<segment-id>-<hash>.mp3
 *
 * Hash = sha256(narration + voice + speed)[:8]   — matches ndemo's ttsHash().
 *
 * Files are re-encoded via ffmpeg to canonical CBR 192k 44.1kHz stereo,
 * since MP3s from various TTS sources can have non-standard frame headers
 * that crash ndemo's merger (which uses ffmpeg -c copy on audio).
 *
 * Generic — reads any playbook *.yaml in the current directory.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import yaml from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findPlaybook() {
  const yamls = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  if (yamls.length === 0) throw new Error("No playbook *.yaml in this directory");
  if (yamls.length === 1) return path.join(__dirname, yamls[0]);
  const named = yamls.find((f) => f === "playbook.yaml" || f === path.basename(__dirname) + ".yaml");
  if (named) return path.join(__dirname, named);
  throw new Error(`Multiple YAMLs found, ambiguous: ${yamls.join(", ")}. Name one playbook.yaml`);
}

const playbookPath = findPlaybook();
const playbook = yaml.parse(fs.readFileSync(playbookPath, "utf8"));
const srcDir = path.join(__dirname, "audio");
const outputDir = path.resolve(__dirname, playbook.recording.outputDir);
const dstDir = path.join(outputDir, "audio");
fs.mkdirSync(dstDir, { recursive: true });

const voice = playbook.tts.voice;
const speed = playbook.tts.speed;

function ttsHash(narration, v, s) {
  return crypto
    .createHash("sha256")
    .update(narration + v + s)
    .digest("hex")
    .slice(0, 8);
}

let staged = 0;
const missing = [];
for (const seg of playbook.segments) {
  if (!seg.narration) continue;
  const src = path.join(srcDir, `${seg.id}.mp3`);
  if (!fs.existsSync(src)) {
    missing.push(seg.id);
    continue;
  }
  const hash = ttsHash(seg.narration, voice, speed);
  const dst = path.join(dstDir, `${seg.id}-${hash}.mp3`);

  // Remove stale variants for this segment
  for (const f of fs.readdirSync(dstDir)) {
    if (f.startsWith(`${seg.id}-`) && f.endsWith(".mp3") && f !== path.basename(dst)) {
      fs.unlinkSync(path.join(dstDir, f));
    }
  }

  process.stdout.write(`→ ${seg.id.padEnd(18)} `);
  try {
    execSync(
      `ffmpeg -y -hide_banner -loglevel error -i "${src}" ` +
      `-c:a libmp3lame -b:a 192k -ar 44100 -ac 2 -write_xing 0 "${dst}"`,
      { stdio: ["ignore", "ignore", "pipe"] },
    );
  } catch (err) {
    console.error("✗ ffmpeg re-encode failed");
    console.error(err.stderr?.toString() ?? err.message);
    process.exit(1);
  }
  console.log(`→ ${path.relative(__dirname, dst)}`);
  staged++;
}

if (missing.length > 0) {
  console.error(`\n✗ Missing source MP3s for: ${missing.join(", ")}`);
  console.error(`  Either generate them via:  ./generate-audio.mjs`);
  console.error(`  Or drop the .mp3 files into: ${path.relative(process.cwd(), srcDir)}/`);
  process.exit(1);
}

console.log(`\n✓ Staged ${staged} normalised MP3s for ndemo render`);

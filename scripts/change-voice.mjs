#!/usr/bin/env node
/**
 * Switch the TTS voice and regenerate audio for a demo.
 *
 * Usage:
 *   node change-voice.mjs                         # list available voices
 *   node change-voice.mjs --voice jenny            # fuzzy match → en-US-JennyNeural
 *   node change-voice.mjs --voice en-US-AriaNeural # exact name
 *   node change-voice.mjs --voice aria --render    # regenerate + re-render
 */

import { spawnSync } from "node:child_process";
import { readdirSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));

const VOICES = [
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

const args = process.argv.slice(2);
const voiceArg = (() => {
  const i = args.indexOf("--voice");
  return i !== -1 ? args[i + 1] : null;
})();
const doRender = args.includes("--render");

if (!voiceArg) {
  console.log("\nAvailable natural voices:\n");
  VOICES.forEach((v, i) =>
    console.log(`  ${String(i + 1).padStart(2)}.  ${v.name.padEnd(26)}  ${v.label}`)
  );
  console.log(`
Usage:
  node change-voice.mjs --voice jenny            # fuzzy match
  node change-voice.mjs --voice en-US-AriaNeural # exact name
  node change-voice.mjs --voice aria --render    # regenerate + re-render
`);
  process.exit(0);
}

// Resolve voice by exact match or fuzzy substring
const needle = voiceArg.toLowerCase();
const matched =
  VOICES.find((v) => v.name.toLowerCase() === needle) ||
  VOICES.find((v) => v.name.toLowerCase().includes(needle));

if (!matched) {
  console.error(`\n✗ No voice matched "${voiceArg}". Run without --voice to list options.\n`);
  process.exit(1);
}

console.log(`\n▶ Voice: ${matched.name}  —  ${matched.label}\n`);

// Clear cached MP3s so generate-audio re-synthesises with the new voice
function clearDir(dir, label) {
  if (!existsSync(dir)) return;
  const mp3s = readdirSync(dir).filter((f) => f.endsWith(".mp3"));
  if (mp3s.length) {
    mp3s.forEach((f) => unlinkSync(join(dir, f)));
    console.log(`  Cleared ${mp3s.length} cached MP3(s) from ${label}`);
  }
}
clearDir(join(__dir, "audio"), "audio/");
clearDir(join(__dir, "video-raw", "audio"), "video-raw/audio/");

// Regenerate with new voice
console.log("\nGenerating audio...\n");
const gen = spawnSync(
  process.execPath,
  [join(__dir, "generate-audio.mjs"), "--voice", matched.name, "--force"],
  { cwd: __dir, stdio: "inherit", shell: false }
);
if (gen.status !== 0) {
  console.error("\n✗ generate-audio.mjs failed.\n");
  process.exit(gen.status ?? 1);
}

if (doRender) {
  console.log("\nRendering video...\n");
  const render = spawnSync(process.execPath, [join(__dir, "render.mjs")], {
    cwd: __dir,
    stdio: "inherit",
    shell: false,
  });
  process.exit(render.status ?? 0);
} else {
  console.log(`\n✓ Audio ready. Next:\n  node render.mjs\n`);
}

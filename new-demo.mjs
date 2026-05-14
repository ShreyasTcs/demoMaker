#!/usr/bin/env node
/**
 * Bootstrap a new demo into any project.
 *
 * Cross-platform: pure Node, no shell. Wrapped by new-demo.sh (Unix) and
 * new-demo.ps1 (Windows) for convenience.
 *
 * Creates  <project>/demo/<demo-name>/  with:
 *   playbook.yaml       (skeleton, pre-filled with app URL)
 *   prep-audio.mjs      (copy from kit scripts/)
 *   generate-audio.mjs  (copy from kit scripts/)
 *   render.mjs          (copy from kit scripts/)
 *   render.sh           (Unix wrapper)
 *   render.ps1          (Windows wrapper)
 *   package.json        (local yaml dep)
 *   audio/              (empty — generated or manual)
 *
 * Usage:
 *   node new-demo.mjs <project-dir> <demo-name> [app-url] [--starter]
 *
 *   --starter   Hint flag for Claude/the user: this is a fresh project
 *               being built around the demo flow. (Cosmetic — affects only
 *               the README footer in the demo folder.)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

function usage(exitCode = 1) {
  console.log(
    [
      "Usage: node new-demo.mjs <project-dir> <demo-name> [app-url] [--starter]",
      "",
      "  project-dir   target project root (use \".\" for current dir)",
      "  demo-name     lowercase-with-dashes, e.g. feature-tour",
      "  app-url       optional, default http://localhost:3000",
      "  --starter     this is a brand-new project built around the demo",
      "",
      "Examples:",
      "  node new-demo.mjs ~/projects/my-app feature-tour",
      "  node new-demo.mjs . onboarding-flow http://localhost:5173 --starter",
    ].join("\n"),
  );
  process.exit(exitCode);
}

if (args.length < 2 || args.includes("-h") || args.includes("--help")) usage(0);

const positional = args.filter((a) => !a.startsWith("--"));
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [projectArg, demoName, appUrl = "http://localhost:3000"] = positional;

if (!/^[a-z0-9][a-z0-9-]*$/.test(demoName)) {
  console.error("✗ demo-name must be lowercase alphanumeric with dashes only");
  process.exit(1);
}

const projectDir = path.resolve(projectArg);
if (!fs.existsSync(projectDir)) {
  console.error(`✗ project directory does not exist: ${projectDir}`);
  process.exit(1);
}

const demoDir = path.join(projectDir, "demo", demoName);
if (fs.existsSync(demoDir)) {
  console.error(`✗ already exists: ${demoDir}`);
  process.exit(1);
}

console.log(`▶ Creating ${demoDir}`);
fs.mkdirSync(path.join(demoDir, "audio"), { recursive: true });

// Copy helper scripts
const SCRIPTS_DIR = path.join(__dirname, "scripts");
const COPY = [
  "prep-audio.mjs",
  "generate-audio.mjs",
  "render.mjs",
  "render.sh",
  "render.ps1",
  "package.json",
];
for (const f of COPY) {
  fs.copyFileSync(path.join(SCRIPTS_DIR, f), path.join(demoDir, f));
}
// Make .mjs and .sh executable on Unix (no-op on Windows)
if (process.platform !== "win32") {
  for (const f of ["prep-audio.mjs", "generate-audio.mjs", "render.mjs", "render.sh"]) {
    try {
      fs.chmodSync(path.join(demoDir, f), 0o755);
    } catch {}
  }
}

// Skeleton playbook
const playbook = `# ${demoName} — demo playbook.
# Edit the segments below. Each segment's narration is what the voice
# will say; the actions are what the browser will do during that segment.
#
# After editing:
#   ./render.sh             # (Unix)  or:  node render.mjs
#   .\\render.ps1            # (Windows) or: node render.mjs

app:
  url: "${appUrl}"
  viewport: { width: 1920, height: 1080 }
  scale: 1
  zoom: 1.0
  colorScheme: light

# Don't change these — they're identifiers for ndemo's audio-cache hash.
# The actual TTS voice used is controlled by generate-audio.mjs flags.
tts:
  provider: openai
  voice: alloy
  speed: 1.0

recording:
  outputDir: video-raw
  fps: 30

segments:
  - id: intro
    intent: "Show the landing screen"
    narration: |
      Welcome to <your app>. In this short tour we'll show the key
      capabilities and how they fit together.
    timing: parallel
    actions:
      - { type: wait, duration: 4000 }

  - id: feature-walkthrough
    intent: "Click through the main feature"
    narration: |
      Replace this segment with the part you want to show. Each segment
      maps to a narration clip plus a sequence of browser actions.
    timing: parallel
    actions:
      # - { type: click, target: { role: button, name: "Start" }, done: { stable: 500 } }
      # - { type: type,  target: { testId: "search" }, text: "hello", delay: 50 }
      # - { type: wait,  duration: 3000 }
      - { type: wait, duration: 4000 }

  - id: closing
    intent: "Hold final frame"
    narration: |
      That's the tour. Thanks for watching.
    timing: parallel
    actions:
      - { type: wait, duration: 3000 }
`;
fs.writeFileSync(path.join(demoDir, "playbook.yaml"), playbook);

// Per-demo README
const isStarter = flags.has("--starter");
const readme = `# ${demoName}

${isStarter
  ? "This demo folder is the **starter pack** for a project being built around the demo flow."
  : "This demo folder produces a narrated video of a feature in this app."}

## Quick start

\`\`\`
# 1. Make sure your dev server is running at ${appUrl}
# 2. Edit playbook.yaml — set the narration text + actions
# 3. Generate or supply audio:
./render.sh             # auto-tries edge-tts; if unavailable, drops a
                         # NARRATION_SCRIPT.txt for you to TTS manually
# 4. Re-run after dropping MP3s into ./audio/<segment-id>.mp3:
./render.sh
\`\`\`

Output: \`demo.mp4\` (+ \`demo.srt\`).

## Per-platform entry points

- macOS / Linux: \`./render.sh\`
- Windows:       \`.\\render.ps1\`
- Anywhere:      \`node render.mjs\`

See the kit's \`RECIPE.md\` for the full pipeline reference.
`;
fs.writeFileSync(path.join(demoDir, "README.md"), readme);

console.log();
console.log("✓ Demo scaffolded at:");
console.log(`    ${demoDir}`);
console.log();
console.log("Next steps:");
console.log(`  1. cd ${demoDir}`);
console.log("  2. Edit playbook.yaml — replace placeholder narration + actions");
console.log(`  3. Start your dev server at ${appUrl}`);
console.log(`  4. ./render.sh           (Unix)`);
console.log(`     .\\render.ps1          (Windows)`);
console.log(`     node render.mjs       (any platform)`);

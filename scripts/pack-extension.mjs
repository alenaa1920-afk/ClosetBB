/**
 * Builds the ZIP the Chrome Web Store wants.
 *
 *   node scripts/pack-extension.mjs
 *
 * Refuses to pack if the extension is still pointed at localhost, because an
 * extension published that way silently does nothing on anyone else's machine.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "extension");
const outDir = join(root, "dist");

const manifest = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8"));
const worker = readFileSync(join(source, "service-worker.js"), "utf8");

// Anchored to the start of a line: the doc comment above the constant shows an
// example assignment, and an unanchored match happily reads that instead.
const production = /^const PRODUCTION_APP_URL = "([^"]*)"/m.exec(worker)?.[1] ?? "";

console.log(`Mon Amour extension v${manifest.version}`);
console.log(`Production address: ${production || "(not set)"}\n`);

const problems = [];
if (!production) {
  problems.push(
    "PRODUCTION_APP_URL is empty in extension/service-worker.js.\n" +
      "    Set it to your live URL, or she will install an extension that\n" +
      "    only talks to localhost — i.e. to nothing.",
  );
} else if (!/^https:\/\//.test(production)) {
  problems.push(`PRODUCTION_APP_URL must be https. Got: ${production}`);
}

if (!manifest.icons?.["128"]) problems.push("manifest is missing a 128px icon.");

if (problems.length) {
  console.error("Not packing:\n");
  for (const problem of problems) console.error(`  · ${problem}\n`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const zipPath = join(outDir, `mon-amour-extension-v${manifest.version}.zip`);
rmSync(zipPath, { force: true });

// Exclude notes meant for us, not for Google.
execFileSync(
  "zip",
  ["-r", "-q", zipPath, ".", "-x", "README.md", "-x", ".*", "-x", "*/.*"],
  { cwd: source, stdio: "inherit" },
);

if (!existsSync(zipPath)) {
  console.error("zip produced nothing.");
  process.exit(1);
}

console.log(`Packed → ${zipPath}`);
console.log("\nUpload at https://chrome.google.com/webstore/devconsole");
console.log("Set visibility to Unlisted so only people with the link can install.");

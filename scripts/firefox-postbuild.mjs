// Runs after `vite build` with `TARGET=firefox`. Reads the freshly
// emitted `dist-firefox/manifest.json`, hands it to `rewriteForFirefox`
// to apply the Chromium→Firefox field translations, and writes it back.
//
// All of the actual rewriting logic lives in `firefox-manifest.mjs` so
// it can be unit-tested without touching the filesystem or spawning a
// build. See that file for the per-field rationale.
//
// Failure modes:
//   - Missing `dist-firefox/manifest.json` → exit 1 (build never ran).
//   - `rewriteForFirefox` throws (e.g. no service_worker to rewrite) →
//     surface the error and exit 1.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rewriteForFirefox } from './firefox-manifest.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifestPath = join(root, 'dist-firefox', 'manifest.json');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

try {
  rewriteForFirefox(manifest);
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exit(1);
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const loader = manifest.background.scripts[0];
console.log(`✓ rewrote background.service_worker → background.scripts (${loader})`);
console.log('  stripped Chromium-only `use_dynamic_url` from web_accessible_resources');

// Firefox does not yet enable `background.service_worker` in shipping
// builds (the flag is off by default), but crxjs only emits that field.
// After the Firefox build, rewrite the manifest to use the MV3-compatible
// `background.scripts` form pointing at the same loader.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifestPath = join(root, 'dist-firefox', 'manifest.json');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const loader = manifest.background?.service_worker;
if (!loader) {
  console.error('✖ dist-firefox/manifest.json has no background.service_worker to rewrite.');
  process.exit(1);
}

manifest.background = { scripts: [loader], type: 'module' };

// `use_dynamic_url` is Chrome-only (CRX-7173); Firefox logs a manifest
// warning if it sees it. Strip from each web_accessible_resources entry.
if (Array.isArray(manifest.web_accessible_resources)) {
  for (const entry of manifest.web_accessible_resources) {
    delete entry.use_dynamic_url;
  }
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`✓ rewrote background.service_worker → background.scripts (${loader})`);

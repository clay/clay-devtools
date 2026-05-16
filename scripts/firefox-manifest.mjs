// Pure helper that takes the Chromium-shaped manifest crxjs emits and
// rewrites the handful of fields that Firefox needs in a different form.
//
// Kept separate from `firefox-postbuild.mjs` so it can be unit-tested
// in isolation (the postbuild script is a one-shot file mutation).
//
// What we rewrite and why:
//
//   1. `background.service_worker` → `background.scripts` (array form).
//      crxjs always emits the Chromium MV3 shape (`service_worker`),
//      but Firefox 121+ implements MV3 backgrounds via ES-module
//      `background.scripts`. Loading a Firefox build with the original
//      `service_worker` field surfaces no errors — Firefox just never
//      runs the background, which makes every panel→service-worker
//      message (open tab, capture screenshot, badge update) silently
//      time out. The rewrite preserves `type: 'module'`, which is
//      required for `import` to work inside the background.
//
//   2. `web_accessible_resources[].use_dynamic_url`. This field is
//      Chromium-only (CRX-7173, ships obfuscated UUID URLs at runtime).
//      Firefox logs a manifest warning for unknown fields, which clutters
//      the console for users on `about:debugging`. We drop it from every
//      entry rather than special-case it.
//
// If you need to add another rewrite, do it here and add a corresponding
// case to `tests/scripts/firefox-manifest.test.ts`.

/**
 * @typedef {object} ChromiumManifest
 * @property {object} [background]
 * @property {string} [background.service_worker]
 * @property {string} [background.type]
 * @property {string[]} [background.scripts]
 * @property {Array<{ resources?: string[]; matches?: string[]; use_dynamic_url?: boolean }>} [web_accessible_resources]
 */

/**
 * Mutates the given manifest in place and returns it. Mutating in place
 * matches the postbuild script's intent (overwrite the file we just
 * read), and avoids the cost of a structuredClone of a large object.
 *
 * Throws if the manifest doesn't have a `background.service_worker` to
 * rewrite — that's the only way the postbuild step could be a no-op,
 * and silently no-oping would mean shipping a broken Firefox build.
 *
 * @param {ChromiumManifest} manifest
 * @returns {ChromiumManifest}
 */
export function rewriteForFirefox(manifest) {
  const loader = manifest.background?.service_worker;
  if (!loader) {
    throw new Error(
      'Firefox postbuild: manifest.background.service_worker is missing. The build is empty or already rewritten.'
    );
  }

  manifest.background = { scripts: [loader], type: 'module' };

  if (Array.isArray(manifest.web_accessible_resources)) {
    for (const entry of manifest.web_accessible_resources) {
      delete entry.use_dynamic_url;
    }
  }

  return manifest;
}

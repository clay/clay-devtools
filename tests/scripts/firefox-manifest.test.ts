// Unit test for `scripts/firefox-manifest.mjs`. The actual postbuild
// script wraps this helper with file IO; we test the pure transformation
// here so the shape contract is locked in without spawning a build.
import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs sibling without types; the helper is intentionally JS-only.
import { rewriteForFirefox } from '../../scripts/firefox-manifest.mjs';

interface ChromiumManifest {
  background?: { service_worker?: string; type?: string; scripts?: string[] };
  web_accessible_resources?: Array<{
    matches?: string[];
    resources?: string[];
    use_dynamic_url?: boolean;
  }>;
}

describe('rewriteForFirefox', () => {
  it('rewrites background.service_worker → background.scripts (array, type: module)', () => {
    // The crxjs-shape we receive: a single service_worker entry with type module.
    // The Firefox-shape we want: a `scripts` array containing that loader,
    // type still 'module' so ES imports inside the background work on FF 121+.
    const m: ChromiumManifest = {
      background: { service_worker: 'service-worker-loader.js', type: 'module' },
    };
    rewriteForFirefox(m);
    expect(m.background).toEqual({
      scripts: ['service-worker-loader.js'],
      type: 'module',
    });
    expect(m.background?.service_worker).toBeUndefined();
  });

  it('throws when there is no background.service_worker to rewrite', () => {
    // Defensive contract: a no-op rewrite would mean a silent broken
    // build (background never starts on Firefox), so the script fails
    // loudly instead.
    expect(() => rewriteForFirefox({})).toThrow(/manifest\.background\.service_worker is missing/);
    expect(() => rewriteForFirefox({ background: {} })).toThrow(
      /manifest\.background\.service_worker is missing/
    );
  });

  it('strips Chromium-only `use_dynamic_url` from every web_accessible_resources entry', () => {
    // Firefox warns on unknown manifest keys (clutters about:debugging
    // for users), and use_dynamic_url is a Chromium-only switch that
    // toggles obfuscated UUID URLs at runtime.
    const m: ChromiumManifest = {
      background: { service_worker: 'sw.js', type: 'module' },
      web_accessible_resources: [
        {
          matches: ['<all_urls>'],
          resources: ['assets/a.js'],
          use_dynamic_url: false,
        },
        {
          matches: ['<all_urls>'],
          resources: ['assets/b.js'],
          use_dynamic_url: true,
        },
      ],
    };
    rewriteForFirefox(m);
    for (const entry of m.web_accessible_resources ?? []) {
      expect(entry).not.toHaveProperty('use_dynamic_url');
      // Other fields untouched — the rewrite is targeted, not a rebuild.
      expect(entry.matches).toEqual(['<all_urls>']);
      expect(entry.resources?.length).toBe(1);
    }
  });

  it('is a no-op on web_accessible_resources when the field is absent', () => {
    // We must not synthesize an empty array — that would change the
    // generated manifest in a way Firefox sees as "explicit empty list".
    const m: ChromiumManifest = {
      background: { service_worker: 'sw.js', type: 'module' },
    };
    rewriteForFirefox(m);
    expect(m.web_accessible_resources).toBeUndefined();
  });

  it('mutates in place AND returns the same reference', () => {
    // The postbuild script relies on the in-place mutation (it writes
    // `manifest` back to disk after calling the helper). Returning the
    // same reference keeps it ergonomic for tests + future callers
    // that prefer the expression form.
    const m: ChromiumManifest = {
      background: { service_worker: 'sw.js', type: 'module' },
    };
    const out = rewriteForFirefox(m);
    expect(out).toBe(m);
  });
});

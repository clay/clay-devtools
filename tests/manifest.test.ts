// Lock in the cross-browser branching contract of `src/manifest.ts`. The
// file is read once by Vite at build time and turns `process.env.TARGET`
// into either the Chromium or the Firefox manifest shape. Importing it
// twice in the same vitest run would normally cache the first result —
// we use `vi.resetModules()` between imports so each test gets a fresh
// evaluation under a different env var.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface ChromiumOnlyManifest {
  manifest_version: number;
  name: string;
  version: string;
  description: string;
  minimum_chrome_version?: string;
  background?: { service_worker?: string; type?: string };
  permissions?: string[];
  host_permissions?: string[];
  icons?: Record<string, string>;
}

interface FirefoxBranchManifest extends ChromiumOnlyManifest {
  browser_specific_settings?: {
    gecko?: {
      id?: string;
      strict_min_version?: string;
      data_collection_permissions?: { required?: string[] };
    };
  };
}

async function loadManifest<T = ChromiumOnlyManifest>(target: string | undefined): Promise<T> {
  // Reset the module graph so the next import re-evaluates the top-level
  // `process.env.TARGET` check. Without this, the second import would
  // return whatever the first import cached.
  vi.resetModules();
  if (target === undefined) delete process.env.TARGET;
  else process.env.TARGET = target;
  const mod = await import('@/manifest');
  return mod.default as T;
}

describe('src/manifest.ts cross-browser branching', () => {
  const originalTarget = process.env.TARGET;

  beforeEach(() => {
    delete process.env.TARGET;
  });

  afterEach(() => {
    if (originalTarget === undefined) delete process.env.TARGET;
    else process.env.TARGET = originalTarget;
  });

  it('default (Chromium) build adds minimum_chrome_version and NO gecko block', async () => {
    const m = await loadManifest<FirefoxBranchManifest>(undefined);
    expect(m.minimum_chrome_version).toBe('116');
    expect(m.browser_specific_settings).toBeUndefined();
    // Chromium gets the standard MV3 service worker shape — the Firefox
    // postbuild step is what rewrites this to background.scripts.
    expect(m.background?.service_worker).toBeTruthy();
  });

  it('TARGET=firefox build adds the gecko block and drops minimum_chrome_version', async () => {
    const m = await loadManifest<FirefoxBranchManifest>('firefox');
    // Mutual exclusion — these two fields exist for opposite browser
    // families and should never co-exist in the same manifest. AMO and
    // CWS would both flag the cross-browser field as "unknown key".
    expect(m.minimum_chrome_version).toBeUndefined();
    expect(m.browser_specific_settings?.gecko?.id).toBe('clay-slip@slate.com');
    expect(m.browser_specific_settings?.gecko?.strict_min_version).toBe('121.0');
    // We don't collect anything; the only honest value Firefox accepts
    // here is `['none']`, and shipping with a different value would be
    // both inaccurate AND surface a misleading AMO listing.
    expect(m.browser_specific_settings?.gecko?.data_collection_permissions?.required).toEqual([
      'none',
    ]);
  });

  it('shared MV3 fields are identical between targets (single source of truth)', async () => {
    // Anything that's not the gecko / minimum_chrome_version branch
    // must come out identical from both builds. Locking it down here
    // catches a future "I added this field for Chrome only" regression
    // before Firefox users hit it (or vice versa).
    const chromium = await loadManifest<FirefoxBranchManifest>(undefined);
    const firefox = await loadManifest<FirefoxBranchManifest>('firefox');

    expect(firefox.manifest_version).toBe(chromium.manifest_version);
    expect(firefox.name).toBe(chromium.name);
    expect(firefox.version).toBe(chromium.version);
    expect(firefox.description).toBe(chromium.description);
    expect(firefox.permissions).toEqual(chromium.permissions);
    expect(firefox.host_permissions).toEqual(chromium.host_permissions);
    expect(firefox.icons).toEqual(chromium.icons);
  });

  it('manifest description stays under the 132-char store ceiling', async () => {
    // Both Chrome Web Store and AMO cap manifest.description at 132.
    // The `src/manifest.ts` module throws at import if package.json
    // exceeds this limit, which is what we lean on here — passing the
    // import means the limit is honored. We assert the length too so
    // a future bump that drops the guard would still fail loudly.
    const m = await loadManifest(undefined);
    expect(m.description.length).toBeGreaterThan(0);
    expect(m.description.length).toBeLessThanOrEqual(132);
  });
});

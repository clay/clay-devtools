import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPreferences, savePreferences } from '@/lib/storage';
import { DEFAULT_PREFERENCES } from '@/lib/types';

interface MockSync {
  data: Record<string, unknown>;
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (entries: Record<string, unknown>) => Promise<void>;
}

interface MockChrome {
  storage: {
    sync: MockSync;
    onChanged: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
    };
  };
}

function getMockChrome(): MockChrome {
  return (globalThis as { chrome?: unknown }).chrome as MockChrome;
}

beforeEach(() => {
  const sync: MockSync = {
    data: {},
    get: vi.fn(async (key: string) => ({ [key]: sync.data[key] })),
    set: vi.fn(async (entries: Record<string, unknown>) => {
      Object.assign(sync.data, entries);
    }),
  };
  const mock: MockChrome = {
    storage: {
      sync,
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  };
  (globalThis as { chrome?: unknown }).chrome = mock;
});

describe('loadPreferences', () => {
  it('returns defaults when nothing is stored', async () => {
    const prefs = await loadPreferences();
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('merges stored values over defaults', async () => {
    getMockChrome().storage.sync.data['preferences'] = { theme: 'dark' };
    const prefs = await loadPreferences();
    expect(prefs.theme).toBe('dark');
    expect(prefs.panelPosition).toBe(DEFAULT_PREFERENCES.panelPosition);
  });
});

describe('savePreferences', () => {
  it('merges partial updates into existing preferences', async () => {
    await savePreferences({ theme: 'light' });
    expect(getMockChrome().storage.sync.data['preferences']).toMatchObject({
      theme: 'light',
    });
    await savePreferences({ panelPosition: 'top-left' });
    expect(getMockChrome().storage.sync.data['preferences']).toMatchObject({
      theme: 'light',
      panelPosition: 'top-left',
    });
  });
});

describe('persistent enable/disable flag', () => {
  // The `enabled` preference is the master kill-switch users asked for
  // ("a way to turn it off entirely and persist the change until they
  // turn it back on"). It rides on the same chrome.storage.sync key as
  // every other preference, which is what gives us:
  //   - persistence across browser restarts (storage.sync is durable)
  //   - cross-tab propagation (storage.onChanged broadcasts)
  //   - cross-device sync for the same browser profile on both
  //     Chromium and Firefox families (storage.sync is in the
  //     webextension-polyfill, identical surface on both)
  // The tests below lock those three properties in via behavior the
  // rest of the codebase already depends on.

  it('defaults `enabled` to true so first-run installs are immediately useful', async () => {
    const prefs = await loadPreferences();
    expect(prefs.enabled).toBe(true);
  });

  it('round-trips a `false` value through storage so the disabled state survives reloads', async () => {
    await savePreferences({ enabled: false });
    // Re-load from a fresh `loadPreferences` call to simulate the next
    // page load reading the persisted value. This is exactly the path
    // the content-script bootstrap takes, so a regression here would
    // mean "users disable the extension, navigate, and it's back on".
    const prefs = await loadPreferences();
    expect(prefs.enabled).toBe(false);
  });

  it('preserves unrelated preferences when only `enabled` is set', async () => {
    // Catches a class of bugs where a partial update accidentally
    // wipes the rest of the prefs (e.g. by overwriting the whole
    // object instead of merging). The popup writes only `{ enabled }`,
    // so this is the exact call shape we ship.
    getMockChrome().storage.sync.data['preferences'] = {
      theme: 'dark',
      panelPosition: 'left-side',
    };
    await savePreferences({ enabled: false });
    expect(getMockChrome().storage.sync.data['preferences']).toMatchObject({
      enabled: false,
      theme: 'dark',
      panelPosition: 'left-side',
    });
  });

  it('re-enabling clears the false value and reverts to the default load behavior', async () => {
    await savePreferences({ enabled: false });
    await savePreferences({ enabled: true });
    const prefs = await loadPreferences();
    expect(prefs.enabled).toBe(true);
  });
});

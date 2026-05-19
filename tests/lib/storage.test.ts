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

describe('windowGlobals round-trip', () => {
  // Lock in that the new field behaves like every other preference:
  // missing → default ([]), present → persisted as-is, partial
  // updates don't clobber sibling fields. Catches the most common
  // regression after extending UserPreferences (forgetting to add
  // the field to DEFAULT_PREFERENCES).
  it('defaults windowGlobals to [] when nothing is stored', async () => {
    const prefs = await loadPreferences();
    expect(prefs.windowGlobals).toEqual([]);
  });

  it('round-trips an explicit windowGlobals list', async () => {
    await savePreferences({ windowGlobals: ['nymGtmPage', 'dataLayer'] });
    const prefs = await loadPreferences();
    expect(prefs.windowGlobals).toEqual(['nymGtmPage', 'dataLayer']);
  });

  it('preserves other fields when only windowGlobals is updated', async () => {
    await savePreferences({ theme: 'dark' });
    await savePreferences({ windowGlobals: ['nymGtmPage'] });
    const prefs = await loadPreferences();
    expect(prefs.theme).toBe('dark');
    expect(prefs.windowGlobals).toEqual(['nymGtmPage']);
  });
});

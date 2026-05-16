import browser, { type Storage } from 'webextension-polyfill';
import { DEFAULT_PREFERENCES, type UserPreferences } from './types';

const PREFS_KEY = 'preferences';

export async function loadPreferences(): Promise<UserPreferences> {
  if (!browser?.storage?.sync) return DEFAULT_PREFERENCES;
  const stored = await browser.storage.sync.get(PREFS_KEY);
  return { ...DEFAULT_PREFERENCES, ...(stored[PREFS_KEY] ?? {}) };
}

export async function savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
  if (!browser?.storage?.sync) return;
  const current = await loadPreferences();
  const merged = { ...current, ...prefs };
  await browser.storage.sync.set({ [PREFS_KEY]: merged });
}

export function onPreferencesChanged(cb: (prefs: UserPreferences) => void): () => void {
  const listener = (changes: Record<string, Storage.StorageChange>, area: string) => {
    if (area === 'sync' && changes[PREFS_KEY]) {
      cb({ ...DEFAULT_PREFERENCES, ...(changes[PREFS_KEY].newValue ?? {}) });
    }
  };
  browser.storage?.onChanged.addListener(listener);
  return () => browser.storage?.onChanged.removeListener(listener);
}

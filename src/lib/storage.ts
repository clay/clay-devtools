import { DEFAULT_PREFERENCES, type UserPreferences } from './types';

const PREFS_KEY = 'preferences';

export async function loadPreferences(): Promise<UserPreferences> {
  if (!chrome?.storage?.sync) return DEFAULT_PREFERENCES;
  const stored = await chrome.storage.sync.get(PREFS_KEY);
  return { ...DEFAULT_PREFERENCES, ...(stored[PREFS_KEY] ?? {}) };
}

export async function savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
  if (!chrome?.storage?.sync) return;
  const current = await loadPreferences();
  const merged = { ...current, ...prefs };
  await chrome.storage.sync.set({ [PREFS_KEY]: merged });
}

export function onPreferencesChanged(cb: (prefs: UserPreferences) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName
  ) => {
    if (area === 'sync' && changes[PREFS_KEY]) {
      cb({ ...DEFAULT_PREFERENCES, ...(changes[PREFS_KEY].newValue ?? {}) });
    }
  };
  chrome.storage?.onChanged.addListener(listener);
  return () => chrome.storage?.onChanged.removeListener(listener);
}

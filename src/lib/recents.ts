import type { RecentComponent } from './types';

const STORAGE_KEY = 'recentComponents';
const HARD_CAP = 100;

export async function loadRecents(): Promise<RecentComponent[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const list = stored[STORAGE_KEY] as RecentComponent[] | undefined;
  return list ?? [];
}

/**
 * Push a new entry to the front of the recents list, dedup'd by URI, and
 * clamp the list to `cap` (defaulting to a hard cap so storage stays small).
 */
export async function pushRecent(entry: RecentComponent, cap = 20): Promise<RecentComponent[]> {
  const list = await loadRecents();
  const filtered = list.filter((r) => r.uri !== entry.uri);
  const next = [entry, ...filtered].slice(0, Math.min(cap, HARD_CAP));
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function clearRecents(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export function onRecentsChanged(listener: (next: RecentComponent[]) => void): () => void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: chrome.storage.AreaName
  ) => {
    if (areaName !== 'local') return;
    if (!(STORAGE_KEY in changes)) return;
    const next = (changes[STORAGE_KEY]?.newValue as RecentComponent[] | undefined) ?? [];
    listener(next);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

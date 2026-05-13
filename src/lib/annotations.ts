import type { Annotation } from './types';

const STORAGE_KEY = 'annotations';

type AnnotationMap = Record<string, Annotation>;

async function loadMap(): Promise<AnnotationMap> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as AnnotationMap | undefined) ?? {};
}

async function saveMap(map: AnnotationMap): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: map });
}

export async function listAnnotations(): Promise<Annotation[]> {
  const map = await loadMap();
  return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getAnnotation(uri: string): Promise<Annotation | null> {
  const map = await loadMap();
  return map[uri] ?? null;
}

export async function getAnnotationUris(): Promise<Set<string>> {
  const map = await loadMap();
  return new Set(Object.keys(map));
}

export async function upsertAnnotation(meta: Omit<Annotation, 'updatedAt'>): Promise<Annotation> {
  const map = await loadMap();
  const next: Annotation = { ...meta, updatedAt: Date.now() };
  map[meta.uri] = next;
  await saveMap(map);
  return next;
}

export async function deleteAnnotation(uri: string): Promise<void> {
  const map = await loadMap();
  if (!(uri in map)) return;
  delete map[uri];
  await saveMap(map);
}

/**
 * Subscribe to cross-context annotation changes (other tabs, options page,
 * etc.). Listener fires with the current full list.
 */
export function onAnnotationsChanged(listener: (next: Annotation[]) => void): () => void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: chrome.storage.AreaName
  ) => {
    if (areaName !== 'local') return;
    if (!(STORAGE_KEY in changes)) return;
    const next = (changes[STORAGE_KEY]?.newValue as AnnotationMap | undefined) ?? {};
    listener(Object.values(next).sort((a, b) => b.updatedAt - a.updatedAt));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

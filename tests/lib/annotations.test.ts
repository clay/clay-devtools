import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteAnnotation,
  getAnnotation,
  getAnnotationUris,
  listAnnotations,
  upsertAnnotation,
} from '@/lib/annotations';

interface MockLocal {
  data: Record<string, unknown>;
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (entries: Record<string, unknown>) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

interface MockChrome {
  storage: {
    local: MockLocal;
    onChanged: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
    };
  };
}

beforeEach(() => {
  const local: MockLocal = {
    data: {},
    get: vi.fn(async (key: string) => ({ [key]: local.data[key] })),
    set: vi.fn(async (entries: Record<string, unknown>) => {
      Object.assign(local.data, entries);
    }),
    remove: vi.fn(async (key: string) => {
      delete local.data[key];
    }),
  };
  const mock: MockChrome = {
    storage: {
      local,
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  };
  (globalThis as { chrome?: unknown }).chrome = mock;
});

const meta = {
  uri: 'site/_components/byline/instances/x',
  displayName: 'Byline',
  pageUrl: 'https://example.com/page',
  pageTitle: 'Test',
  note: 'Hello',
};

describe('annotations', () => {
  it('round-trips an annotation', async () => {
    const saved = await upsertAnnotation(meta);
    expect(saved.note).toBe('Hello');
    expect(saved.updatedAt).toBeGreaterThan(0);

    const fetched = await getAnnotation(meta.uri);
    expect(fetched?.note).toBe('Hello');
  });

  it('exposes the set of annotated URIs', async () => {
    await upsertAnnotation(meta);
    await upsertAnnotation({ ...meta, uri: 'other', note: 'Other note' });
    const uris = await getAnnotationUris();
    expect(uris.has(meta.uri)).toBe(true);
    expect(uris.has('other')).toBe(true);
    expect(uris.size).toBe(2);
  });

  it('lists annotations newest-first', async () => {
    await upsertAnnotation(meta);
    await new Promise((r) => setTimeout(r, 5));
    await upsertAnnotation({ ...meta, uri: 'newer', note: 'newer one' });

    const list = await listAnnotations();
    expect(list[0]!.uri).toBe('newer');
  });

  it('deletes annotations', async () => {
    await upsertAnnotation(meta);
    await deleteAnnotation(meta.uri);
    expect(await getAnnotation(meta.uri)).toBeNull();
  });
});

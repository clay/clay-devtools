import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRecents, pushRecent } from '@/lib/recents';
import type { RecentComponent } from '@/lib/types';

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

function entry(uri: string): RecentComponent {
  return {
    uri,
    displayName: uri,
    instance: null,
    pageUrl: 'https://example.com',
    pageTitle: 'Example',
    visitedAt: Date.now(),
  };
}

describe('pushRecent', () => {
  it('starts empty', async () => {
    expect(await loadRecents()).toEqual([]);
  });

  it('pushes new entries to the front', async () => {
    await pushRecent(entry('a'));
    await pushRecent(entry('b'));
    const list = await loadRecents();
    expect(list.map((r) => r.uri)).toEqual(['b', 'a']);
  });

  it('dedupes by URI and re-promotes to the front', async () => {
    await pushRecent(entry('a'));
    await pushRecent(entry('b'));
    await pushRecent(entry('a'));
    const list = await loadRecents();
    expect(list.map((r) => r.uri)).toEqual(['a', 'b']);
  });

  it('caps the list to the requested cap', async () => {
    for (let i = 0; i < 10; i += 1) await pushRecent(entry(`u${i}`));
    const list = await pushRecent(entry('u10'), 5);
    expect(list).toHaveLength(5);
    expect(list[0]!.uri).toBe('u10');
  });
});

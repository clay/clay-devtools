/**
 * Behavioral tests for the content-script bootstrap.
 *
 * The bootstrap is the layer that consults the persistent `enabled`
 * preference and decides whether to install the highlighter stylesheet,
 * mount the panel, and announce the Clay page to the background worker.
 * The contract is:
 *
 *  - On a non-Clay page: never paint or mount, but DO subscribe to
 *    preference changes so a future `enabled: true` flip elsewhere
 *    doesn't require a reload.
 *  - On a Clay page with `enabled: false`: announce CLAY_DETECTED so
 *    the popup shows the toggle UI, but skip every paint/mount.
 *  - On a Clay page with `enabled: true`: full bootstrap.
 *  - When the preference flips after bootstrap: tear down or bring up
 *    the panel + highlighter live without a reload.
 *
 * Tests below run the bootstrap repeatedly (via vi.resetModules) to
 * exercise each branch, then drive the storage.onChanged listener to
 * verify the live tear-down / bring-up behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES } from '@/lib/types';

interface StorageChangeListener {
  (changes: Record<string, { newValue?: unknown }>, area: string): void;
}

interface OnMessageListener {
  (
    message: unknown,
    sender: { tab?: { id?: number } },
    sendResponse: (response: unknown) => void
  ): boolean | void;
}

interface MockChrome {
  runtime: {
    onInstalled: { addListener: ReturnType<typeof vi.fn> };
    onMessage: {
      addListener: ReturnType<typeof vi.fn>;
      listeners: OnMessageListener[];
    };
    sendMessage: ReturnType<typeof vi.fn> & { messages: unknown[] };
    openOptionsPage: ReturnType<typeof vi.fn>;
  };
  storage: {
    sync: {
      data: Record<string, unknown>;
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    };
    onChanged: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
      listeners: StorageChangeListener[];
    };
    local: {
      data: Record<string, unknown>;
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    };
  };
  action: { setBadgeText: ReturnType<typeof vi.fn> };
}

function makeMockChrome(initialPrefs: Record<string, unknown> = {}): MockChrome {
  const data: Record<string, unknown> = { preferences: initialPrefs };
  const local: Record<string, unknown> = {};
  const messageListeners: OnMessageListener[] = [];
  const storageListeners: StorageChangeListener[] = [];
  const sendMessageMessages: unknown[] = [];
  const sendMessage = Object.assign(
    vi.fn(async (msg: unknown) => {
      sendMessageMessages.push(msg);
      return undefined;
    }),
    { messages: sendMessageMessages }
  );
  return {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: {
        addListener: vi.fn((l: OnMessageListener) => messageListeners.push(l)),
        listeners: messageListeners,
      },
      sendMessage,
      openOptionsPage: vi.fn(async () => undefined),
    },
    storage: {
      sync: {
        data,
        get: vi.fn(async (key: string) => ({ [key]: data[key] })),
        set: vi.fn(async (entries: Record<string, unknown>) => {
          Object.assign(data, entries);
        }),
      },
      onChanged: {
        addListener: vi.fn((l: StorageChangeListener) => storageListeners.push(l)),
        removeListener: vi.fn(),
        listeners: storageListeners,
      },
      local: {
        data: local,
        get: vi.fn(async () => local),
        set: vi.fn(async (entries: Record<string, unknown>) => {
          Object.assign(local, entries);
        }),
      },
    },
    action: { setBadgeText: vi.fn(async () => undefined) },
  };
}

function getMock(): MockChrome {
  return (globalThis as { chrome?: MockChrome }).chrome as MockChrome;
}

function makeClayDocument(): void {
  document.documentElement.setAttribute('data-uri', 'thecut.com/_pages/abc@published');
  const comp = document.createElement('div');
  comp.setAttribute('data-uri', 'thecut.com/_components/header/instances/hero@published');
  document.body.appendChild(comp);
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

async function importBootstrap(): Promise<void> {
  vi.resetModules();
  await import('@/content/index');
  // Bootstrap is async (awaits loadPreferences); two ticks lets the
  // microtask queue drain.
  await tick();
  await tick();
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-uri');
  document.documentElement.removeAttribute('data-clay-slip-mode');
  document.getElementById('clay-slip-shadow-host')?.remove();
  (globalThis as { chrome?: MockChrome }).chrome = makeMockChrome();
});

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-uri');
  document.documentElement.removeAttribute('data-clay-slip-mode');
  document.getElementById('clay-slip-shadow-host')?.remove();
  delete (globalThis as { chrome?: MockChrome }).chrome;
});

describe('bootstrap on a non-Clay page', () => {
  it('does not paint, does not mount the panel, but still subscribes to prefs changes', async () => {
    await importBootstrap();
    expect(document.getElementById('clay-slip-highlight-styles')).toBeNull();
    expect(document.getElementById('clay-slip-shadow-host')).toBeNull();
    // Subscribed so a re-enable / disable elsewhere is reactive.
    expect(getMock().storage.onChanged.listeners.length).toBeGreaterThan(0);
  });
});

describe('bootstrap on a Clay page with enabled: false (persistent kill-switch)', () => {
  beforeEach(() => {
    makeClayDocument();
    getMock().storage.sync.data['preferences'] = { ...DEFAULT_PREFERENCES, enabled: false };
  });

  it('does not install the highlighter stylesheet', async () => {
    await importBootstrap();
    expect(document.getElementById('clay-slip-highlight-styles')).toBeNull();
  });

  it('does not mount the panel host', async () => {
    await importBootstrap();
    expect(document.getElementById('clay-slip-shadow-host')).toBeNull();
  });

  it('does not write any data-clay-slip-* attribute to host components', async () => {
    await importBootstrap();
    const comp = document.querySelector('[data-uri*="header"]') as HTMLElement;
    expect(comp.hasAttributeNS(null, 'data-clay-slip-color')).toBe(false);
    expect(comp.hasAttributeNS(null, 'data-clay-slip-color-idx')).toBe(false);
  });

  it('still announces CLAY_DETECTED so the toolbar popup gets the toggle UI', async () => {
    await importBootstrap();
    const messages = getMock().runtime.sendMessage.messages;
    expect(messages).toContainEqual(expect.objectContaining({ type: 'CLAY_DETECTED' }));
  });

  it('reports a badge count of 0 (extension is off, no components surfaced)', async () => {
    await importBootstrap();
    const badge = getMock().runtime.sendMessage.messages.find(
      (m): m is { type: 'UPDATE_BADGE'; count: number } =>
        !!m && typeof m === 'object' && (m as { type?: string }).type === 'UPDATE_BADGE'
    );
    expect(badge?.count).toBe(0);
  });
});

describe('bootstrap on a Clay page with enabled: true (default)', () => {
  beforeEach(() => {
    makeClayDocument();
  });

  it('installs the highlighter stylesheet', async () => {
    await importBootstrap();
    expect(document.getElementById('clay-slip-highlight-styles')).not.toBeNull();
  });

  it('mounts the panel host', async () => {
    await importBootstrap();
    expect(document.getElementById('clay-slip-shadow-host')).not.toBeNull();
  });
});

describe('live re-enable / disable via storage.onChanged', () => {
  // The single most valuable contract here is that flipping `enabled`
  // from another tab tears down (or brings up) the panel + highlighter
  // on every other tab without a reload. Without it the kill-switch
  // would be lopsided: turning OFF would require a reload to take
  // effect, which is exactly what the persistent flag is supposed to
  // avoid.

  beforeEach(() => {
    makeClayDocument();
  });

  it('tears down the panel + highlighter when enabled flips to false', async () => {
    // Boot enabled; verify it's mounted; flip to false; verify
    // teardown.
    await importBootstrap();
    expect(document.getElementById('clay-slip-highlight-styles')).not.toBeNull();
    expect(document.getElementById('clay-slip-shadow-host')).not.toBeNull();

    for (const listener of getMock().storage.onChanged.listeners) {
      listener({ preferences: { newValue: { ...DEFAULT_PREFERENCES, enabled: false } } }, 'sync');
    }
    await tick();
    expect(document.getElementById('clay-slip-shadow-host')).toBeNull();
  });

  it('brings the panel back up when enabled flips to true', async () => {
    getMock().storage.sync.data['preferences'] = { ...DEFAULT_PREFERENCES, enabled: false };
    await importBootstrap();
    // Confirms the cold-start disabled state we're starting from.
    expect(document.getElementById('clay-slip-shadow-host')).toBeNull();

    for (const listener of getMock().storage.onChanged.listeners) {
      listener({ preferences: { newValue: { ...DEFAULT_PREFERENCES, enabled: true } } }, 'sync');
    }
    await tick();
    await tick();
    expect(document.getElementById('clay-slip-shadow-host')).not.toBeNull();
    expect(document.getElementById('clay-slip-highlight-styles')).not.toBeNull();
  });
});

/**
 * Behavioral tests for the service-worker / background script.
 *
 * The worker is the layer that decides whether the toolbar popup should
 * be shown or suppressed on each tab, which is the *only* mechanism we
 * have to give users a UI surface to flip the persistent `enabled`
 * preference back on from a Clay tab once they've turned it off.
 * Getting this contract right is the whole reason the persistent
 * kill-switch is a useful feature instead of a one-way trap.
 *
 * The test isolates the worker's listener registration so we can drive
 * individual messages through it and verify the resulting calls to
 * `browser.action.setPopup`. The webextension-polyfill mock in
 * `tests/setup.ts` forwards `import browser from 'webextension-polyfill'`
 * to whatever this file assigns to `globalThis.chrome`, so the worker
 * source can be imported unmodified.
 *
 * Same source ships to Chromium and Firefox (manifest postbuild only
 * touches the background entry shape, not the worker logic), so these
 * assertions cover both browser families.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES } from '@/lib/types';

interface OnMessageListener {
  (
    message: unknown,
    sender: { tab?: { id?: number; windowId?: number } },
    sendResponse: (response: unknown) => void
  ): boolean | void;
}

interface StorageChangeListener {
  (changes: Record<string, { newValue?: unknown }>, area: string): void;
}

interface MockChrome {
  action: {
    setBadgeBackgroundColor: ReturnType<typeof vi.fn>;
    setBadgeText: ReturnType<typeof vi.fn>;
    setPopup: ReturnType<typeof vi.fn>;
    onClicked: { addListener: ReturnType<typeof vi.fn> };
  };
  runtime: {
    onInstalled: { addListener: ReturnType<typeof vi.fn> };
    onMessage: {
      addListener: ReturnType<typeof vi.fn>;
      listeners: OnMessageListener[];
    };
    openOptionsPage: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
  };
  tabs: {
    onUpdated: { addListener: ReturnType<typeof vi.fn> };
    create: ReturnType<typeof vi.fn>;
    captureVisibleTab: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
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
  };
}

function makeMockChrome(initialPrefs: Record<string, unknown> = {}): MockChrome {
  const messageListeners: OnMessageListener[] = [];
  const storageListeners: StorageChangeListener[] = [];
  const data: Record<string, unknown> = { preferences: initialPrefs };
  const mock: MockChrome = {
    action: {
      setBadgeBackgroundColor: vi.fn(async () => undefined),
      setBadgeText: vi.fn(async () => undefined),
      setPopup: vi.fn(async () => undefined),
      onClicked: { addListener: vi.fn() },
    },
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: {
        addListener: vi.fn((l: OnMessageListener) => messageListeners.push(l)),
        listeners: messageListeners,
      },
      openOptionsPage: vi.fn(async () => undefined),
      sendMessage: vi.fn(async () => undefined),
    },
    tabs: {
      onUpdated: { addListener: vi.fn() },
      create: vi.fn(async () => undefined),
      captureVisibleTab: vi.fn(async () => 'data:image/png;base64,xxx'),
      sendMessage: vi.fn(async () => undefined),
      query: vi.fn(async () => [{ id: 10 }, { id: 11 }, { id: 12 }]),
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
    },
  };
  return mock;
}

function tick(): Promise<void> {
  // Lets pending microtasks (the async preferences load on import,
  // followed by the setExtensionEnabled update) drain before assertions.
  return new Promise((r) => setTimeout(r, 0));
}

async function importWorker(): Promise<void> {
  // Each test resets the module registry so the worker re-runs its
  // top-level side effects (registering listeners, hydrating the
  // enabled-cache from storage) against the fresh mock.
  vi.resetModules();
  await import('@/background/service-worker');
  await tick();
}

beforeEach(() => {
  (globalThis as { chrome?: MockChrome }).chrome = makeMockChrome();
});

afterEach(() => {
  delete (globalThis as { chrome?: MockChrome }).chrome;
});

function getMock(): MockChrome {
  return (globalThis as { chrome?: MockChrome }).chrome as MockChrome;
}

function dispatchMessage(
  message: unknown,
  sender: { tab?: { id?: number; windowId?: number } } = {}
): unknown {
  let response: unknown;
  for (const listener of getMock().runtime.onMessage.listeners) {
    listener(message, sender, (r) => {
      response = r;
    });
  }
  return response;
}

describe('CLAY_DETECTED popup gating (per-tab popup suppress)', () => {
  it('suppresses the popup on Clay tabs while the extension is enabled', async () => {
    // Default prefs → `enabled: true`. The historical behavior (single
    // click on the toolbar = toggle the in-page panel) depends on the
    // popup being cleared for the Clay tab.
    await importWorker();
    dispatchMessage({ type: 'CLAY_DETECTED' }, { tab: { id: 42 } });
    expect(getMock().action.setPopup).toHaveBeenCalledWith({ tabId: 42, popup: '' });
  });

  it('does NOT suppress the popup on Clay tabs while the extension is disabled', async () => {
    // The whole point of the persistent kill-switch is that users can
    // flip the extension back on from any tab. If we suppressed the
    // popup on Clay tabs while disabled, a user who turned the
    // extension off and then navigated to a Clay page would have no
    // UI surface left to re-enable from. Lock the gate in.
    getMock().storage.sync.data['preferences'] = { ...DEFAULT_PREFERENCES, enabled: false };
    await importWorker();
    dispatchMessage({ type: 'CLAY_DETECTED' }, { tab: { id: 42 } });
    // CLAY_DETECTED is the *only* path that clears the popup; if the
    // worker didn't call setPopup with popup:'' the per-tab override
    // is left as whatever the global default was (the popup HTML),
    // which is exactly the behavior we want.
    const clearedCalls = getMock().action.setPopup.mock.calls.filter(
      (call) => call[0]?.tabId === 42 && call[0]?.popup === ''
    );
    expect(clearedCalls).toHaveLength(0);
  });

  it('ignores CLAY_DETECTED with no tab id (defensive, no crash on unusual senders)', async () => {
    await importWorker();
    // setPopup may have been called by other listeners during import;
    // we only care that the new dispatch didn't add a no-tabId call.
    const before = getMock().action.setPopup.mock.calls.length;
    expect(() => dispatchMessage({ type: 'CLAY_DETECTED' }, {})).not.toThrow();
    expect(getMock().action.setPopup.mock.calls.length).toBe(before);
  });
});

describe('EXTENSION_ENABLED_CHANGED (popup force-on)', () => {
  it('forces the popup back on every tab when the user disables the extension', async () => {
    // The persistent kill-switch needs a synchronous way to recover
    // the UI surface on every existing Clay tab — otherwise users
    // would have to navigate before they could re-enable. This is
    // the contract the popup-force takes care of.
    await importWorker();
    dispatchMessage({ type: 'EXTENSION_ENABLED_CHANGED', enabled: false });
    await tick();
    await tick();
    const popupCalls = getMock().action.setPopup.mock.calls.filter(
      (call) => call[0]?.popup === 'src/popup/index.html'
    );
    // 3 tabs in the mocked tabs.query response → 3 force-on calls.
    expect(popupCalls.length).toBeGreaterThanOrEqual(3);
    expect(popupCalls.map((c) => c[0].tabId).sort()).toEqual([10, 11, 12]);
  });

  it('does NOT force the popup on every tab when the user re-enables', async () => {
    // Re-enabling is fine to leave the per-tab popup state alone —
    // non-Clay tabs already show the popup (default), and Clay tabs
    // will re-suppress it on the next CLAY_DETECTED. Forcing the
    // popup on across all tabs on every re-enable would actually
    // *break* the one-click panel toggle on Clay tabs that aren't
    // currently focused (the popup override would shadow the
    // suppress until the next page load).
    await importWorker();
    // Disable first so the in-memory cache flips off.
    dispatchMessage({ type: 'EXTENSION_ENABLED_CHANGED', enabled: false });
    await tick();
    const setPopupBefore = getMock().action.setPopup.mock.calls.length;
    dispatchMessage({ type: 'EXTENSION_ENABLED_CHANGED', enabled: true });
    await tick();
    await tick();
    // No additional bulk popup calls — re-enable doesn't force a sweep.
    expect(getMock().action.setPopup.mock.calls.length).toBe(setPopupBefore);
  });

  it('updates the in-memory cache synchronously so the very next CLAY_DETECTED respects it', async () => {
    // Disable -> immediately CLAY_DETECTED on a tab. The worker must
    // NOT clear the popup for that tab (because the user just turned
    // the extension off). If the cache update was deferred to the
    // async onPreferencesChanged listener we'd race here.
    await importWorker();
    dispatchMessage({ type: 'EXTENSION_ENABLED_CHANGED', enabled: false });
    dispatchMessage({ type: 'CLAY_DETECTED' }, { tab: { id: 99 } });
    const tab99Suppressions = getMock().action.setPopup.mock.calls.filter(
      (call) => call[0]?.tabId === 99 && call[0]?.popup === ''
    );
    expect(tab99Suppressions).toHaveLength(0);
  });

  it('round-trips off -> on -> off -> on with the cache tracking each flip', async () => {
    // Catches a sticky-state bug where the cache only flips one way.
    await importWorker();
    dispatchMessage({ type: 'EXTENSION_ENABLED_CHANGED', enabled: false });
    dispatchMessage({ type: 'CLAY_DETECTED' }, { tab: { id: 1 } });
    dispatchMessage({ type: 'EXTENSION_ENABLED_CHANGED', enabled: true });
    dispatchMessage({ type: 'CLAY_DETECTED' }, { tab: { id: 2 } });
    dispatchMessage({ type: 'EXTENSION_ENABLED_CHANGED', enabled: false });
    dispatchMessage({ type: 'CLAY_DETECTED' }, { tab: { id: 3 } });
    dispatchMessage({ type: 'EXTENSION_ENABLED_CHANGED', enabled: true });
    dispatchMessage({ type: 'CLAY_DETECTED' }, { tab: { id: 4 } });
    const suppressed = (tabId: number) =>
      getMock().action.setPopup.mock.calls.some((c) => c[0]?.tabId === tabId && c[0]?.popup === '');
    expect(suppressed(1)).toBe(false); // disabled
    expect(suppressed(2)).toBe(true); //  enabled
    expect(suppressed(3)).toBe(false); // disabled
    expect(suppressed(4)).toBe(true); //  enabled
  });
});

describe('storage hydration', () => {
  it('starts with `enabled` honored from chrome.storage.sync on cold start', async () => {
    // Simulates "user disabled the extension yesterday, restarts the
    // browser today" — the worker boots, hydrates from storage, and
    // the very first CLAY_DETECTED on a Clay tab must not suppress
    // the popup.
    getMock().storage.sync.data['preferences'] = { ...DEFAULT_PREFERENCES, enabled: false };
    await importWorker();
    dispatchMessage({ type: 'CLAY_DETECTED' }, { tab: { id: 7 } });
    const tab7Suppressions = getMock().action.setPopup.mock.calls.filter(
      (call) => call[0]?.tabId === 7 && call[0]?.popup === ''
    );
    expect(tab7Suppressions).toHaveLength(0);
  });

  it('reacts to storage.onChanged so a flip from another tab propagates', async () => {
    // Cross-tab propagation is one of the reasons we picked
    // storage.sync in the first place. Verify the worker's
    // onPreferencesChanged listener is wired and consulting the new
    // value.
    await importWorker();
    expect(getMock().storage.onChanged.listeners.length).toBeGreaterThan(0);

    // Simulate a write from another tab.
    for (const listener of getMock().storage.onChanged.listeners) {
      listener(
        {
          preferences: { newValue: { ...DEFAULT_PREFERENCES, enabled: false } },
        },
        'sync'
      );
    }
    await tick();
    await tick();

    // Now CLAY_DETECTED on this tab should not suppress.
    dispatchMessage({ type: 'CLAY_DETECTED' }, { tab: { id: 33 } });
    const tab33Suppressions = getMock().action.setPopup.mock.calls.filter(
      (call) => call[0]?.tabId === 33 && call[0]?.popup === ''
    );
    expect(tab33Suppressions).toHaveLength(0);
  });
});

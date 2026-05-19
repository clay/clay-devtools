import browser from 'webextension-polyfill';
import { loadPreferences, onPreferencesChanged } from '@/lib/storage';
import type { CaptureResponse, RuntimeMessage } from '@/lib/types';

// Toolbar badge color — matches the unified inspector accent
// (`--cs-accent` in the panel theme, `ACCENT_RGB` in the highlighter).
// Chrome doesn't switch theme on the badge, so we pick the lighter
// blue-400 variant which stays readable against either a light or dark
// browser-toolbar background.
const BADGE_BG = '#60a5fa';
const POPUP_PATH = 'src/popup/index.html';

/**
 * Track the persistent enable/disable state in the service-worker
 * memory so the per-tab popup-suppress logic (which runs on every
 * CLAY_DETECTED + tabs.onUpdated) can consult it synchronously without
 * an awaited storage round-trip on the hot path.
 *
 * Hydrated at startup from `chrome.storage.sync` and kept in sync via
 * `onPreferencesChanged`. Defaults to `true` so the worst case during
 * the (very brief) pre-hydration window is "popup gets suppressed on a
 * Clay page the same way it always has been" — same UX as before this
 * change, never worse.
 */
let extensionEnabled = true;

void loadPreferences().then((prefs) => {
  extensionEnabled = prefs.enabled;
});

onPreferencesChanged((prefs) => {
  const wasEnabled = extensionEnabled;
  extensionEnabled = prefs.enabled;
  if (wasEnabled === prefs.enabled) return;
  // Toggle re-asserted the popup state across all tabs. When the user
  // disables the extension we force the popup back on for every tab
  // (otherwise the Clay pages that were popup-suppressed would have no
  // UI surface left to re-enable from); when they re-enable we leave
  // the per-tab state alone — the content script's next CLAY_DETECTED
  // will suppress it again on Clay pages, and non-Clay pages already
  // had the popup on.
  if (!prefs.enabled) void forcePopupOnAllTabs();
});

async function forcePopupOnAllTabs(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({});
    await Promise.all(
      tabs.map((t) =>
        typeof t.id === 'number'
          ? browser.action.setPopup({ tabId: t.id, popup: POPUP_PATH }).catch(() => undefined)
          : Promise.resolve()
      )
    );
  } catch {
    // browser.tabs.query can reject in restricted contexts; nothing to
    // do — the popup is still mounted as the global default, the only
    // thing missing is the per-tab override clear on previously-Clay
    // tabs. Affected users get the popup back on the next page load.
  }
}

browser.runtime.onInstalled.addListener(() => {
  browser.action.setBadgeBackgroundColor({ color: BADGE_BG });
});

/**
 * Reset the popup whenever a tab starts navigating. The new page's content
 * script will re-disable the popup with CLAY_DETECTED if the destination is a
 * Clay page; otherwise the popup stays active and the icon click shows the
 * "Not a Clay page" message.
 */
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    browser.action.setPopup({ tabId, popup: POPUP_PATH }).catch(() => undefined);
    browser.action.setBadgeText({ tabId, text: '' }).catch(() => undefined);
  }
});

/**
 * On Clay pages the popup is disabled (so this handler fires); on non-Clay
 * pages the default popup shows automatically and this never runs. Also
 * runs on Clay pages when `enabled: false` — in that case we always force
 * the popup, and this handler will not be invoked at all (the popup opens
 * instead).
 */
browser.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  browser.tabs.sendMessage(tab.id, { type: 'PANEL_TOGGLE' } satisfies RuntimeMessage).catch(() => {
    // Content script not loaded (e.g. chrome:// pages). Ignore.
  });
});

browser.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
  const message = rawMessage as RuntimeMessage;
  switch (message.type) {
    case 'OPEN_TAB': {
      browser.tabs.create({ url: message.url, active: true });
      sendResponse({ ok: true });
      break;
    }
    case 'OPEN_OPTIONS': {
      browser.runtime.openOptionsPage().catch(() => undefined);
      sendResponse({ ok: true });
      break;
    }
    case 'UPDATE_BADGE': {
      const tabId = message.tabId ?? sender.tab?.id;
      if (typeof tabId === 'number') {
        const text = message.count > 0 ? String(message.count) : '';
        browser.action.setBadgeText({ text, tabId }).catch(() => undefined);
      }
      sendResponse({ ok: true });
      break;
    }
    case 'CLAY_DETECTED': {
      const tabId = sender.tab?.id;
      if (typeof tabId === 'number' && extensionEnabled) {
        // Only suppress the popup on Clay pages when the extension is
        // actually enabled. If it's been disabled, leaving the popup
        // suppressed would leave the user with no UI surface to flip
        // it back on from a Clay tab — they'd have to navigate away
        // first.
        browser.action.setPopup({ tabId, popup: '' }).catch(() => undefined);
      }
      sendResponse({ ok: true });
      break;
    }
    case 'EXTENSION_ENABLED_CHANGED': {
      // Mirror the new value into the in-memory cache so the very next
      // CLAY_DETECTED on the same tab respects it without waiting for
      // the onPreferencesChanged listener (which fires asynchronously).
      extensionEnabled = message.enabled;
      if (!message.enabled) void forcePopupOnAllTabs();
      sendResponse({ ok: true });
      break;
    }
    case 'CAPTURE_TAB': {
      const windowId = sender.tab?.windowId;
      if (typeof windowId !== 'number') {
        sendResponse({ ok: false, error: 'No window id' } satisfies CaptureResponse);
        break;
      }
      browser.tabs
        .captureVisibleTab(windowId, { format: 'png' })
        .then((dataUrl) => sendResponse({ ok: true, dataUrl } satisfies CaptureResponse))
        .catch((err: unknown) =>
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          } satisfies CaptureResponse)
        );
      return true;
    }
    default:
      break;
  }
  return true;
});

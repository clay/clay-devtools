import browser from 'webextension-polyfill';
import type { CaptureResponse, RuntimeMessage } from '@/lib/types';

// Toolbar badge color — matches the unified inspector accent
// (`--cs-accent` in the panel theme, `ACCENT_RGB` in the highlighter).
// Chrome doesn't switch theme on the badge, so we pick the lighter
// blue-400 variant which stays readable against either a light or dark
// browser-toolbar background.
const BADGE_BG = '#60a5fa';
const POPUP_PATH = 'src/popup/index.html';

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
 * pages the default popup shows automatically and this never runs.
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
      if (typeof tabId === 'number') {
        browser.action.setPopup({ tabId, popup: '' }).catch(() => undefined);
      }
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

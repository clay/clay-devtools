import type { CaptureResponse, RuntimeMessage } from '@/lib/types';

const BADGE_BG = '#e22c2c';
const POPUP_PATH = 'src/popup/index.html';

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: BADGE_BG });
});

/**
 * Reset the popup whenever a tab starts navigating. The new page's content
 * script will re-disable the popup with CLAY_DETECTED if the destination is a
 * Clay page; otherwise the popup stays active and the icon click shows the
 * "Not a Clay page" message.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setPopup({ tabId, popup: POPUP_PATH }).catch(() => undefined);
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => undefined);
  }
});

/**
 * On Clay pages the popup is disabled (so this handler fires); on non-Clay
 * pages the default popup shows automatically and this never runs.
 */
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'PANEL_TOGGLE' } satisfies RuntimeMessage).catch(() => {
    // Content script not loaded (e.g. chrome:// pages). Ignore.
  });
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  switch (message.type) {
    case 'OPEN_TAB': {
      chrome.tabs.create({ url: message.url, active: true });
      sendResponse({ ok: true });
      break;
    }
    case 'OPEN_OPTIONS': {
      chrome.runtime.openOptionsPage().catch(() => undefined);
      sendResponse({ ok: true });
      break;
    }
    case 'UPDATE_BADGE': {
      const tabId = message.tabId ?? sender.tab?.id;
      if (typeof tabId === 'number') {
        const text = message.count > 0 ? String(message.count) : '';
        chrome.action.setBadgeText({ text, tabId }).catch(() => undefined);
      }
      sendResponse({ ok: true });
      break;
    }
    case 'CLAY_DETECTED': {
      const tabId = sender.tab?.id;
      if (typeof tabId === 'number') {
        chrome.action.setPopup({ tabId, popup: '' }).catch(() => undefined);
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
      chrome.tabs
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

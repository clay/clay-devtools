import type { RuntimeMessage } from '@/lib/types';

const BADGE_BG = '#e22c2c';

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: BADGE_BG });
});

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
    case 'UPDATE_BADGE': {
      const tabId = message.tabId ?? sender.tab?.id;
      if (typeof tabId === 'number') {
        const text = message.count > 0 ? String(message.count) : '';
        chrome.action.setBadgeText({ text, tabId });
      }
      sendResponse({ ok: true });
      break;
    }
    default:
      break;
  }
  return true;
});

import { isClayDocument } from '@/lib/clay-uri';
import type { RuntimeMessage } from '@/lib/types';
import { applyHighlights, clearHighlights, installHighlightStyles } from './highlighter';
import { readComponents } from './page-info';
import { isPanelMounted, mountPanel, unmountPanel } from './shadow-host';
import { useStore } from './panel/store';

function bootstrap(): void {
  if (!isClayDocument()) {
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count: 0 } satisfies RuntimeMessage);
    return;
  }

  installHighlightStyles();
  const components = readComponents();
  applyHighlights(components.map((c) => c.element));

  useStore.getState().setComponents(components);

  chrome.runtime.sendMessage({
    type: 'UPDATE_BADGE',
    count: components.length,
  } satisfies RuntimeMessage);
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'PANEL_TOGGLE') {
    if (!isClayDocument()) {
      chrome.runtime.sendMessage({
        type: 'OPEN_TAB',
        url: chrome.runtime.getURL('src/popup/index.html'),
      } satisfies RuntimeMessage);
      sendResponse({ ok: false, reason: 'not-clay' });
      return true;
    }
    if (isPanelMounted()) {
      const components = useStore.getState().components.map((c) => c.element);
      clearHighlights(components);
      unmountPanel();
    } else {
      bootstrap();
      mountPanel();
    }
    sendResponse({ ok: true });
  }
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (isClayDocument()) {
      installHighlightStyles();
      const components = readComponents();
      useStore.getState().setComponents(components);
      chrome.runtime.sendMessage({
        type: 'UPDATE_BADGE',
        count: components.length,
      } satisfies RuntimeMessage);
    }
  });
} else if (isClayDocument()) {
  installHighlightStyles();
  const components = readComponents();
  useStore.getState().setComponents(components);
  chrome.runtime.sendMessage({
    type: 'UPDATE_BADGE',
    count: components.length,
  } satisfies RuntimeMessage);
}

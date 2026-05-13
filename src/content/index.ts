import { isClayDocument, parseShareTarget } from '@/lib/clay-uri';
import type { RuntimeMessage } from '@/lib/types';
import {
  applyHighlights,
  clearHighlights,
  installHighlightStyles,
  setSelected,
} from './highlighter';
import { readComponents } from './page-info';
import { isPanelMounted, mountPanel, unmountPanel } from './shadow-host';
import { useStore } from './panel/store';

function send(message: RuntimeMessage): void {
  chrome.runtime.sendMessage(message).catch(() => undefined);
}

function paintAndSync(): number {
  installHighlightStyles();
  const components = readComponents();
  applyHighlights(components.map((c) => c.element));
  useStore.getState().setComponents(components);
  return components.length;
}

function handleDeepLink(): void {
  const target = parseShareTarget(location.href);
  if (!target) return;
  const components = useStore.getState().components;
  const match = components.find((c) => c.uri === target);
  if (!match) return;
  setSelected(null, match.element);
  useStore.getState().setSelected(match);
  match.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function bootstrap(): void {
  if (!isClayDocument()) {
    send({ type: 'UPDATE_BADGE', count: 0 });
    return;
  }
  send({ type: 'CLAY_DETECTED' });
  const count = paintAndSync();
  send({ type: 'UPDATE_BADGE', count });

  // If the user landed via a Slip share link, auto-open the panel and select.
  if (parseShareTarget(location.href)) {
    if (!isPanelMounted()) mountPanel();
    setTimeout(handleDeepLink, 50);
  }
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'PANEL_TOGGLE') {
    if (!isClayDocument()) {
      sendResponse({ ok: false, reason: 'not-clay' });
      return true;
    }
    if (isPanelMounted()) {
      const components = useStore.getState().components.map((c) => c.element);
      clearHighlights(components);
      unmountPanel();
    } else {
      paintAndSync();
      mountPanel();
    }
    sendResponse({ ok: true });
  }
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

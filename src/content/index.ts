import { isClayDocument, parseShareTarget } from '@/lib/clay-uri';
import type { RuntimeMessage } from '@/lib/types';
import {
  applyHighlights,
  clearHighlights,
  installAltRevealListener,
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
  applyHighlights(
    components.map((c) => c.element),
    // Selection badge label — passed down so the CSS pseudo-element can
    // surface it via attr(). Falling back to component name keeps the
    // badge useful when an instance ID isn't present.
    components.map((c) => c.displayName || c.name)
  );
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

  // Wire the Alt/Option modifier so users can "peek" at every component
  // when in 'all' mode. No-op in other modes (the listener checks per-event)
  // so installing it once at bootstrap is safe and doesn't need to react
  // to mode changes.
  installAltRevealListener();

  // Auto-mount on every Clay page. The panel boots into its collapsed state
  // (the floating Clay button); the user clicks the FAB to expand. This is
  // the standard pattern for in-page extension chrome (Sentry/Hotjar/Crisp).
  if (!isPanelMounted()) mountPanel();

  // If the user landed via a Slip share link, also auto-expand + select.
  if (parseShareTarget(location.href)) {
    useStore.getState().toggleCollapsed();
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

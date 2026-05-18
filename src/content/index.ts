import browser from 'webextension-polyfill';
import { isClayDocument, isEditMode, parseShareTarget } from '@/lib/clay-uri';
import { loadPreferences, onPreferencesChanged } from '@/lib/storage';
import type { RuntimeMessage } from '@/lib/types';
import {
  applyHighlights,
  clearHighlights,
  installHighlightStyles,
  installRevealKeyListener,
  setSelected,
} from './highlighter';
import { readComponents } from './page-info';
import { isPanelMounted, mountPanel, unmountPanel } from './shadow-host';
import { useStore } from './panel/store';

function send(message: RuntimeMessage): void {
  browser.runtime.sendMessage(message).catch(() => undefined);
}

/**
 * Tears the highlighter + panel back down. Used when the user flips the
 * persistent `enabled` preference to `false` from another tab (or this
 * one's options page / popup) — we want the host page to return to its
 * pre-mount state without forcing a reload.
 */
function teardown(): void {
  const components = useStore.getState().components.map((c) => c.element);
  clearHighlights(components);
  if (isPanelMounted()) unmountPanel();
}

/**
 * Read all Clay components on the page and push them into the panel store.
 * **Read-only** — does not write any attribute to host elements, does not
 * install the stylesheet. Safe to call in passive (edit) mode where we
 * don't want to touch the host DOM at all.
 */
function syncComponents(): number {
  const components = readComponents();
  useStore.getState().setComponents(components);
  return components.length;
}

/**
 * The full active-mode setup: install the stylesheet, mark every component
 * with the highlight attributes, and push them into the panel store. This
 * is what runs on a normal Clay page; on `?edit=true` pages we call
 * {@link syncComponents} alone instead.
 */
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
  // setSelected is a no-op in passive mode (no stylesheet installed → no
  // outline rule to fire). The store update + scrollIntoView still work,
  // which is the only behavior the deep-link UX actually depends on.
  setSelected(null, match.element);
  useStore.getState().setSelected(match);
  match.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function bootstrap(): Promise<void> {
  if (!isClayDocument()) {
    send({ type: 'UPDATE_BADGE', count: 0 });
    // Even on non-Clay pages we need to start watching the prefs change
    // listener so that flipping `enabled` from another tab doesn't
    // require a reload. Cheap (one storage subscription) and avoids
    // surprising behavior where a re-enable doesn't take effect until
    // the user navigates.
    watchEnabledPref();
    return;
  }

  // Persistent kill-switch: if the user has disabled the extension we
  // still announce the Clay page (so the popup shows the toggle UI on
  // it) and listen for re-enable, but we never paint or mount anything.
  const prefs = await loadPreferences();
  if (!prefs.enabled) {
    send({ type: 'CLAY_DETECTED' });
    send({ type: 'UPDATE_BADGE', count: 0 });
    watchEnabledPref();
    return;
  }
  // Send CLAY_DETECTED on EVERY Clay page (including edit-mode ones), so
  // the toolbar popup shows the panel-toggle UI rather than the
  // "Not a Clay page" message. The actual difference between active and
  // passive mode is whether we install the highlighter, not whether we
  // recognize the page.
  send({ type: 'CLAY_DETECTED' });

  if (isEditMode()) {
    // Passive mode for `?edit=true` pages.
    //
    // Goal: keep the panel fully functional (component tree, JSON, Diff,
    // SEO, Notes, copy buttons, links, recents) but DO NOT compete with
    // Clay's own in-page editor chrome — it has its own click-to-select,
    // its own highlight overlays, and a toolbar that shouldn't have to
    // share visual real-estate with ours.
    //
    // Concretely we skip:
    //   - `installHighlightStyles()` → no <style> tag added to <head>,
    //     no `outline` rules ever match anything. Every element-writing
    //     helper in highlighter.ts is gated on the stylesheet's presence
    //     and silently no-ops (see `isHighlighterInstalled`), so we don't
    //     have to plumb the edit-mode flag through every call site.
    //   - The host-page click/hover listeners (see `useElementSelection`).
    //   - The reveal-modifier keyboard listener (Control).
    //
    // What still runs:
    //   - Component detection (read-only walk of `[data-uri]`).
    //   - Panel mount + every read-only feature inside it.
    //   - The toolbar badge + popup ("Clay page; click to toggle panel").
    //   - Tree-click selection (which goes through the panel store, not
    //     through the host-DOM click listener).
    const count = syncComponents();
    send({ type: 'UPDATE_BADGE', count });
    if (!isPanelMounted()) mountPanel();
    return;
  }

  const count = paintAndSync();
  send({ type: 'UPDATE_BADGE', count });

  // Wire the Control modifier so users can "peek" at every component
  // when in 'selection' mode. No-op in other modes (the listener checks
  // per-event) so installing it once at bootstrap is safe and doesn't need
  // to react to mode changes. Skipped entirely in passive mode above so
  // we don't add keyboard listeners on edit pages.
  installRevealKeyListener();

  // Auto-mount on every Clay page. The panel boots into its collapsed state
  // (the floating Clay button); the user clicks the FAB to expand. This is
  // the standard pattern for in-page extension chrome (Sentry/Hotjar/Crisp).
  if (!isPanelMounted()) mountPanel();

  // If the user landed via a Slip share link, also auto-expand + select.
  if (parseShareTarget(location.href)) {
    useStore.getState().toggleCollapsed();
    setTimeout(handleDeepLink, 50);
  }

  // Watch the persistent kill-switch so a flip from another tab tears
  // this tab down (or brings it back up) without a reload.
  watchEnabledPref();
}

/**
 * Subscribe to preference changes and react to flips of the persistent
 * `enabled` flag. Mounted exactly once per content-script lifetime via
 * the guard below — multiple bootstrap call sites share a single
 * subscription.
 *
 * When the user disables: tear down the panel + highlighter so the host
 * page returns to its pristine state. When they re-enable: re-run the
 * paint/mount path (or the passive-mode path on edit pages) so the
 * panel reappears in the same tab without a reload.
 */
let enabledWatcherInstalled = false;
function watchEnabledPref(): void {
  if (enabledWatcherInstalled) return;
  enabledWatcherInstalled = true;
  onPreferencesChanged((prefs) => {
    if (!isClayDocument()) return;
    if (!prefs.enabled) {
      teardown();
      send({ type: 'UPDATE_BADGE', count: 0 });
      return;
    }
    // Re-enable path: only re-mount if we previously tore down. The
    // `isPanelMounted` check is the cheapest way to detect that
    // without tracking a parallel boolean.
    if (isPanelMounted()) return;
    if (isEditMode()) {
      const count = syncComponents();
      send({ type: 'UPDATE_BADGE', count });
      mountPanel();
    } else {
      const count = paintAndSync();
      send({ type: 'UPDATE_BADGE', count });
      installRevealKeyListener();
      mountPanel();
    }
  });
}

browser.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
  const message = rawMessage as RuntimeMessage;
  if (message.type === 'PANEL_TOGGLE') {
    if (!isClayDocument()) {
      sendResponse({ ok: false, reason: 'not-clay' });
      return true;
    }
    // No `enabled` re-check here: when the extension is disabled, the
    // service worker force-mounts the popup on every tab, so the
    // toolbar icon opens the popup instead of dispatching this
    // message. The flow is owned at the service-worker layer.
    if (isPanelMounted()) {
      // `clearHighlights` is a no-op in passive mode (no stylesheet → no
      // attrs were ever written), so we can run it unconditionally.
      const components = useStore.getState().components.map((c) => c.element);
      clearHighlights(components);
      unmountPanel();
    } else if (isEditMode()) {
      // Re-mounting on an edit page: stay in passive mode, don't
      // install the stylesheet or paint.
      syncComponents();
      mountPanel();
    } else {
      paintAndSync();
      mountPanel();
    }
    sendResponse({ ok: true });
  }
  return true;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void bootstrap();
  });
} else {
  void bootstrap();
}

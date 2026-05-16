import { useEffect } from 'react';
import browser from 'webextension-polyfill';
import { copyToClipboard } from '@/lib/clipboard';
import { buildUrl, ensureProtocol } from '@/lib/clay-uri';
import type { RuntimeMessage } from '@/lib/types';
import { useStore } from '../store';

const SEQUENCE_TIMEOUT_MS = 600;

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    let pending: string | null = null;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const clearPending = () => {
      pending = null;
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = null;
    };

    const handle = async (e: KeyboardEvent) => {
      if (!useStore.getState().preferences.enableShortcuts) return;

      // Bail when typing into ANY editable element — including those inside
      // our Shadow DOM panel. Default `e.target` gets retargeted to the shadow
      // host at document level, hiding the real focused element from us, so
      // we walk `composedPath()` to find the actual focus surface.
      const path = e.composedPath();
      for (const node of path) {
        if (!(node instanceof HTMLElement)) continue;
        if (/^(input|textarea|select)$/i.test(node.tagName)) return;
        if (node.isContentEditable) return;
      }

      const state = useStore.getState();
      const {
        page,
        selected,
        toggleShortcuts,
        toggleCollapsed,
        cycleHighlightMode,
        pushToast,
        setActiveTab,
      } = state;

      if (e.key === '?' && (e.shiftKey || e.key === '?')) {
        e.preventDefault();
        toggleShortcuts();
        return;
      }
      if (e.key === 'Escape') {
        if (useStore.getState().showShortcuts) {
          toggleShortcuts();
        }
        return;
      }
      if (e.key === '[') {
        e.preventDefault();
        toggleCollapsed();
        return;
      }
      if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        cycleHighlightMode();
        return;
      }
      if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTab('tree');
        return;
      }
      if ((e.key === 'i' || e.key === 'I') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setActiveTab('inspect');
        return;
      }

      if (pending) {
        const combo = `${pending}${e.key}`;
        clearPending();

        if (combo === 'yp' && page) {
          // Always copy a fully-qualified URL so the keyboard shortcut
          // matches what the in-panel copy button writes.
          const ok = await copyToClipboard(ensureProtocol(page.pageUri));
          pushToast(ok ? 'Page URI copied' : 'Copy failed', ok ? 'success' : 'error');
        } else if (combo === 'yc' && selected) {
          const ok = await copyToClipboard(ensureProtocol(selected.uri));
          pushToast(ok ? 'Component URI copied' : 'Copy failed', ok ? 'success' : 'error');
        } else if (combo === 'op' && page) {
          // No host override: buildUrl uses the URI's embedded host, which
          // is the page's actual host. Cross-env nav is handled by the
          // "View on…" pills (siteHosts) and the Diff tab.
          browser.runtime.sendMessage({
            type: 'OPEN_TAB',
            url: buildUrl(page.pageUri, ''),
          } satisfies RuntimeMessage);
        } else if (combo === 'oc' && (selected || page)) {
          const uri = selected?.uri ?? page?.pageUri;
          if (uri) {
            browser.runtime.sendMessage({
              type: 'OPEN_TAB',
              url: buildUrl(uri, ''),
            } satisfies RuntimeMessage);
          }
        }
        return;
      }

      if (e.key === 'y' || e.key === 'o') {
        pending = e.key;
        pendingTimer = setTimeout(clearPending, SEQUENCE_TIMEOUT_MS);
      }
    };

    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      clearPending();
    };
  }, []);
}

export const SHORTCUTS = [
  { keys: ['?'], description: 'Show this shortcut overlay' },
  { keys: ['['], description: 'Collapse / expand the panel' },
  { keys: ['h'], description: 'Cycle highlight mode (off → selection → editable → all)' },
  { keys: ['i'], description: 'Switch to Inspect tab' },
  { keys: ['t'], description: 'Switch to Tree tab' },
  { keys: ['y', 'p'], description: 'Copy current page URI' },
  { keys: ['y', 'c'], description: 'Copy selected component URI' },
  { keys: ['o', 'p'], description: 'Open current page in new tab' },
  { keys: ['o', 'c'], description: 'Open selected component in new tab' },
  { keys: ['Esc'], description: 'Close overlays' },
] as const;

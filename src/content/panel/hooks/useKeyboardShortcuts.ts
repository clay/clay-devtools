import { useEffect } from 'react';
import { copyToClipboard } from '@/lib/clipboard';
import { buildUrl } from '@/lib/clay-uri';
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
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (target?.isContentEditable) return;

      const { page, selected, toggleShortcuts, toggleCollapsed, pushToast, setActiveTab } =
        useStore.getState();

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
          const ok = await copyToClipboard(page.pageUri);
          pushToast(ok ? 'Page URI copied' : 'Copy failed', ok ? 'success' : 'error');
        } else if (combo === 'yc' && selected) {
          const ok = await copyToClipboard(selected.uri);
          pushToast(ok ? 'Component URI copied' : 'Copy failed', ok ? 'success' : 'error');
        } else if (combo === 'op' && page) {
          chrome.runtime.sendMessage({
            type: 'OPEN_TAB',
            url: buildUrl(page.pageUri),
          } satisfies RuntimeMessage);
        } else if (combo === 'oc' && (selected || page)) {
          const uri = selected?.uri ?? page?.pageUri;
          if (uri) {
            chrome.runtime.sendMessage({
              type: 'OPEN_TAB',
              url: buildUrl(uri),
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
  { keys: ['i'], description: 'Switch to Inspect tab' },
  { keys: ['t'], description: 'Switch to Tree tab' },
  { keys: ['y', 'p'], description: 'Copy current page URI' },
  { keys: ['y', 'c'], description: 'Copy selected component URI' },
  { keys: ['o', 'p'], description: 'Open current page in new tab' },
  { keys: ['o', 'c'], description: 'Open selected component in new tab' },
  { keys: ['Esc'], description: 'Close overlays' },
] as const;

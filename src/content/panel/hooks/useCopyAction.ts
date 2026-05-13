import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '@/lib/clipboard';
import { useStore } from '../store';

/**
 * Default key used by single-button consumers that don't need to
 * disambiguate between siblings. Picked as a string instead of `null`
 * so callers can always do `copiedKey === 'btnA'` without null-checks.
 */
const DEFAULT_KEY = 'default';
const DEFAULT_DURATION_MS = 1500;

interface UseCopyActionResult {
  /**
   * Copy `text` to the clipboard, push a feedback toast, and (on success)
   * mark `key` as the most recently copied so the calling component can
   * render an inline "Copied" affordance for `durationMs`.
   *
   * - `text`        : what to write to the clipboard verbatim. Caller is
   *                   responsible for any normalization (e.g. `ensureProtocol`).
   * - `toastLabel`  : short noun used in the toast — e.g. passing `"URI"`
   *                   yields the toast text `"URI copied"`.
   * - `key`         : optional disambiguator when one component renders
   *                   multiple copy buttons. Defaults to `'default'`.
   */
  readonly copy: (text: string, toastLabel: string, key?: string) => Promise<boolean>;
  /**
   * Key of the most recently copied button, or `null` once the inline
   * feedback window has elapsed. `=== DEFAULT_KEY` for single-button uses.
   */
  readonly copiedKey: string | null;
}

/**
 * Bundles the three things every copy button in the panel needs:
 *
 *   1. The actual `navigator.clipboard.writeText` call (delegated to
 *      `copyToClipboard`).
 *   2. A toast push so the user gets *some* feedback even if their eyes
 *      are away from the button (e.g. they triggered copy via shortcut
 *      or the button is in a now-collapsed menu).
 *   3. A short-lived `copiedKey` flag so the button itself can render an
 *      inline "Copied" affordance (icon swap, label change, tinted border
 *      — caller's choice).
 *
 * Why both a toast *and* an inline indicator? They cover different
 * failure modes of feedback: a toast is global but easy to miss if the
 * user is focused on the button; the inline indicator is co-located but
 * disappears if the menu collapses. Together they guarantee one of them
 * is always visible right after a click.
 */
export function useCopyAction(durationMs = DEFAULT_DURATION_MS): UseCopyActionResult {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushToast = useStore((s) => s.pushToast);

  // If the consumer unmounts during the post-copy window (e.g. user
  // collapses the panel right after copying), make sure the timeout
  // doesn't stamp on a defunct setState.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const copy = useCallback(
    async (text: string, toastLabel: string, key: string = DEFAULT_KEY) => {
      const ok = await copyToClipboard(text);
      if (ok) {
        setCopiedKey(key);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopiedKey(null), durationMs);
        pushToast(`${toastLabel} copied`, 'success');
      } else {
        pushToast('Copy failed', 'error');
      }
      return ok;
    },
    [durationMs, pushToast]
  );

  return { copy, copiedKey };
}

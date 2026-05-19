import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import clayIconUrl from '@/assets/clay-icon.png?inline';
import { loadPreferences, onPreferencesChanged, savePreferences } from '@/lib/storage';
import { DEFAULT_PREFERENCES, type RuntimeMessage } from '@/lib/types';

/**
 * Browser-action popup. Shown in two scenarios:
 *
 *  1. **Non-Clay tabs** — the default. The popup tells the user this
 *     page isn't a Clay page and offers the persistent enable/disable
 *     toggle so they can pre-arm or pre-disable the extension before
 *     navigating somewhere it matters.
 *
 *  2. **Clay tabs when `enabled: false`** — the service worker
 *     normally suppresses the popup on Clay pages (so clicking the
 *     toolbar icon toggles the in-page panel in one click). When the
 *     user has explicitly disabled the extension the service worker
 *     force-shows the popup again so they can flip it back on without
 *     navigating away from the current page.
 *
 * The popup deliberately doesn't know which scenario it's in — it
 * shows the toggle either way. Users reported they wanted "a way to
 * turn it off entirely and persist the change until they turn it back
 * on", and the popup is the only UI surface that's always reachable
 * regardless of whether the in-page panel is currently mounted.
 */
export function Popup() {
  const [enabled, setEnabled] = useState<boolean>(DEFAULT_PREFERENCES.enabled);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPreferences().then((prefs) => {
      if (cancelled) return;
      setEnabled(prefs.enabled);
      setReady(true);
    });
    const cleanup = onPreferencesChanged((prefs) => {
      if (cancelled) return;
      setEnabled(prefs.enabled);
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  const onToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    // Update local state first for instant visual feedback even if the
    // sync write is slow (network-backed storage can take ~hundreds of
    // ms on cold sync).
    setEnabled(next);
    await savePreferences({ enabled: next });
    // Tell the service worker so it can re-assert popup behavior on
    // every tab immediately (without waiting for its own
    // onPreferencesChanged listener to fire). Best-effort: even if this
    // message fails, the storage change will reach the worker via its
    // listener shortly after.
    browser.runtime
      .sendMessage({
        type: 'EXTENSION_ENABLED_CHANGED',
        enabled: next,
      } satisfies RuntimeMessage)
      .catch(() => undefined);
  };

  const openOptions = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    browser.runtime.openOptionsPage().catch(() => undefined);
  };

  return (
    <div className="popup">
      <img className="popup-logo" src={clayIconUrl} alt="" aria-hidden="true" />
      <h1 className="popup-title">Clay Slip</h1>
      <p className="popup-body">
        {enabled
          ? 'Visit a Clay page to inspect components. The floating Clay button appears in the corner.'
          : 'The extension is disabled — it will not run on any page until you turn it back on.'}
      </p>

      <label className="popup-toggle">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!ready}
          onChange={onToggle}
          aria-label="Enable Clay Slip on all pages"
        />
        <span className="popup-toggle-text">
          {enabled ? 'Enabled' : 'Disabled'}
          <span className="popup-toggle-hint">
            {enabled
              ? 'Click to turn off Clay Slip everywhere.'
              : 'Click to turn Clay Slip back on.'}
          </span>
        </span>
      </label>

      <div className="popup-links">
        <a className="popup-link" href="#options" onClick={openOptions}>
          Open settings →
        </a>
        <a
          className="popup-link"
          href="https://github.com/clay/clay"
          target="_blank"
          rel="noreferrer noopener"
        >
          About Clay →
        </a>
      </div>
    </div>
  );
}

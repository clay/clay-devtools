import { useEffect, useState } from 'react';
import clayIconUrl from '@/assets/clay-icon.png?inline';
import {
  hasHostPermission,
  hostFromUrl,
  removeHostPermission,
  requestHostPermission,
} from '@/lib/permissions';

type State =
  | { kind: 'loading' }
  | { kind: 'unsupported'; tabId?: number } // chrome://, about:, file:, etc.
  | { kind: 'needsGrant'; tabId: number; host: string }
  | { kind: 'grantedNonClay'; tabId: number; host: string };

export function Popup() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void resolveActiveTab().then(setState);
  }, []);

  async function onGrant() {
    if (state.kind !== 'needsGrant') return;
    setBusy(true);
    const granted = await requestHostPermission(state.host);
    if (granted) {
      // Reload the tab so the now-allowed content script auto-injects.
      await chrome.tabs.reload(state.tabId).catch(() => undefined);
      window.close();
    } else {
      setBusy(false);
    }
  }

  async function onRevoke() {
    if (state.kind !== 'grantedNonClay') return;
    setBusy(true);
    const ok = await removeHostPermission(state.host);
    if (ok) setState({ ...state, kind: 'needsGrant' });
    setBusy(false);
  }

  return (
    <div className="popup">
      <img className="popup-logo" src={clayIconUrl} alt="" aria-hidden="true" />

      {state.kind === 'loading' && <p className="popup-body">Loading…</p>}

      {state.kind === 'unsupported' && (
        <>
          <h1 className="popup-title">Clay Slip can&rsquo;t run here</h1>
          <p className="popup-body">
            This page uses an internal browser scheme (<code className="popup-mono">chrome://</code>
            , <code className="popup-mono">file://</code>, extension stores, etc.) that extensions
            can&rsquo;t access.
          </p>
        </>
      )}

      {state.kind === 'needsGrant' && (
        <>
          <h1 className="popup-title">Allow Clay Slip on this site?</h1>
          <p className="popup-body">
            Clay Slip needs your permission to run on{' '}
            <code className="popup-mono">{state.host}</code>. You&rsquo;ll see a Chrome prompt —
            click
            <strong> Allow</strong> to enable inspection on every page of this site.
          </p>
          <button
            type="button"
            className="popup-button popup-button-primary"
            onClick={onGrant}
            disabled={busy}
          >
            {busy ? 'Granting…' : `Allow on ${state.host}`}
          </button>
          <p className="popup-fineprint">
            You can revoke access any time from{' '}
            <a
              className="popup-link"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                chrome.runtime.openOptionsPage().catch(() => undefined);
              }}
            >
              Settings
            </a>
            .
          </p>
        </>
      )}

      {state.kind === 'grantedNonClay' && (
        <>
          <h1 className="popup-title">No Clay components here</h1>
          <p className="popup-body">
            This page on <code className="popup-mono">{state.host}</code> doesn&rsquo;t appear to be
            powered by Clay. Open a Clay page and the panel will appear automatically.
          </p>
          <button
            type="button"
            className="popup-button"
            onClick={onRevoke}
            disabled={busy}
            title={`Revoke Clay Slip's access to ${state.host}`}
          >
            {busy ? 'Revoking…' : `Revoke access to ${state.host}`}
          </button>
        </>
      )}

      <a
        className="popup-link"
        href="https://github.com/clay/clay-devtools"
        target="_blank"
        rel="noreferrer noopener"
      >
        About Clay Slip →
      </a>
    </div>
  );
}

async function resolveActiveTab(): Promise<State> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const host = hostFromUrl(tab?.url);
    if (!tab?.id || !host) return { kind: 'unsupported', tabId: tab?.id };
    const granted = await hasHostPermission(host);
    return granted
      ? { kind: 'grantedNonClay', tabId: tab.id, host }
      : { kind: 'needsGrant', tabId: tab.id, host };
  } catch {
    return { kind: 'unsupported' };
  }
}

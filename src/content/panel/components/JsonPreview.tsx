import { useEffect, useState } from 'react';
import { buildUrl } from '@/lib/clay-uri';
import { copyToClipboard } from '@/lib/clipboard';
import { highlightJson } from '@/lib/json-highlight';
import { useEnvHost, useStore } from '../store';
import { Icon } from './Icon';

interface FetchState {
  readonly status: 'idle' | 'loading' | 'success' | 'error';
  readonly data?: unknown;
  readonly error?: string;
}

const cache = new Map<string, FetchState>();

function cacheKey(uri: string | null, host: string): string {
  return `${host || '_'}::${uri ?? ''}`;
}

function initialStateFor(uri: string | null, host: string): FetchState {
  if (!uri) return { status: 'idle' };
  return cache.get(cacheKey(uri, host)) ?? { status: 'loading' };
}

export function JsonPreview() {
  const selected = useStore((s) => s.selected);
  const page = useStore((s) => s.page);
  const pushToast = useStore((s) => s.pushToast);
  const envHost = useEnvHost();

  const targetUri = selected?.uri ?? page?.pageUri ?? null;
  const fetchUrl = targetUri ? buildUrl(targetUri, '.json', envHost) : null;

  const [state, setState] = useState<FetchState>(() => initialStateFor(targetUri, envHost));
  const [prevKey, setPrevKey] = useState(cacheKey(targetUri, envHost));

  const currentKey = cacheKey(targetUri, envHost);
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setState(initialStateFor(targetUri, envHost));
  }

  useEffect(() => {
    if (!fetchUrl || !targetUri) return;
    const key = cacheKey(targetUri, envHost);
    const cached = cache.get(key);
    if (cached && cached.status !== 'loading') return;

    let cancelled = false;
    fetch(fetchUrl, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const next: FetchState = { status: 'success', data };
        cache.set(key, next);
        setState(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        const next: FetchState = { status: 'error', error: message };
        cache.set(key, next);
        setState(next);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchUrl, targetUri, envHost]);

  if (!targetUri) {
    return <div className="cs-empty">Select a component to preview its data.</div>;
  }

  if (state.status === 'loading') {
    return (
      <div className="cs-loading">
        <span className="cs-spinner" /> Fetching {fetchUrl}…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="cs-empty">
        Failed to fetch JSON: <code>{state.error}</code>
      </div>
    );
  }

  if (state.status !== 'success' || state.data === undefined) {
    return null;
  }

  const onCopy = async () => {
    const ok = await copyToClipboard(JSON.stringify(state.data, null, 2));
    pushToast(ok ? 'JSON copied' : 'Copy failed', ok ? 'success' : 'error');
  };

  return (
    <section className="cs-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 className="cs-section-title">JSON</h4>
        <button className="cs-icon-btn" onClick={onCopy} aria-label="Copy JSON">
          <Icon name="copy" />
        </button>
      </div>
      <pre className="cs-json" dangerouslySetInnerHTML={{ __html: highlightJson(state.data) }} />
    </section>
  );
}

import { useEffect, useState } from 'react';
import { buildUrl } from '@/lib/clay-uri';
import { highlightJson } from '@/lib/json-highlight';
import { useCopyAction } from '../hooks/useCopyAction';
import { useStore } from '../store';
import { Icon } from './Icon';

interface FetchState {
  readonly status: 'idle' | 'loading' | 'success' | 'error';
  readonly data?: unknown;
  readonly error?: string;
}

const cache = new Map<string, FetchState>();

function cacheKey(uri: string | null): string {
  return `::${uri ?? ''}`;
}

function initialStateFor(uri: string | null): FetchState {
  if (!uri) return { status: 'idle' };
  return cache.get(cacheKey(uri)) ?? { status: 'loading' };
}

export function JsonPreview() {
  const selected = useStore((s) => s.selected);
  const page = useStore((s) => s.page);
  const { copy, copiedKey } = useCopyAction();
  const copied = copiedKey === 'default';

  // No host override: buildUrl uses the URI's embedded host, which is
  // the page's actual host. Cross-env fetches now go through the Diff
  // tab's site-host-mapping selector instead of a global default env.
  const targetUri = selected?.uri ?? page?.pageUri ?? null;
  const fetchUrl = targetUri ? buildUrl(targetUri, '.json') : null;

  const [state, setState] = useState<FetchState>(() => initialStateFor(targetUri));
  const [prevKey, setPrevKey] = useState(cacheKey(targetUri));

  const currentKey = cacheKey(targetUri);
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setState(initialStateFor(targetUri));
  }

  useEffect(() => {
    if (!fetchUrl || !targetUri) return;
    const key = cacheKey(targetUri);
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
  }, [fetchUrl, targetUri]);

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

  const onCopy = () => {
    void copy(JSON.stringify(state.data, null, 2), 'JSON');
  };

  return (
    <section className="cs-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 className="cs-section-title">JSON</h4>
        <button
          className={`cs-icon-btn ${copied ? 'cs-icon-btn-copied' : ''}`}
          onClick={onCopy}
          aria-label={copied ? 'JSON copied' : 'Copy JSON'}
          title={copied ? 'Copied!' : 'Copy JSON to clipboard'}
        >
          <Icon name={copied ? 'check' : 'copy'} />
        </button>
      </div>
      <pre className="cs-json" dangerouslySetInnerHTML={{ __html: highlightJson(state.data) }} />
    </section>
  );
}

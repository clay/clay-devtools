import { useEffect, useState } from 'react';
import { buildUrl, isPublished, unpublishedUri } from '@/lib/clay-uri';
import { useStore } from '../store';

interface DualState {
  readonly status: 'idle' | 'loading' | 'success' | 'error';
  readonly published?: unknown;
  readonly draft?: unknown;
  readonly error?: string;
}

function diffLines(
  left: unknown,
  right: unknown
): Array<{
  text: string;
  tone: 'added' | 'removed' | 'context';
}> {
  const l = JSON.stringify(left, null, 2).split('\n');
  const r = JSON.stringify(right, null, 2).split('\n');
  const result: Array<{ text: string; tone: 'added' | 'removed' | 'context' }> = [];
  const max = Math.max(l.length, r.length);
  for (let i = 0; i < max; i += 1) {
    const a = l[i];
    const b = r[i];
    if (a === b) {
      if (a !== undefined) result.push({ text: a, tone: 'context' });
    } else {
      if (a !== undefined) result.push({ text: a, tone: 'removed' });
      if (b !== undefined) result.push({ text: b, tone: 'added' });
    }
  }
  return result;
}

function initialStateFor(uri: string | null): DualState {
  if (!uri || !isPublished(uri)) return { status: 'idle' };
  return { status: 'loading' };
}

export function DiffView() {
  const selected = useStore((s) => s.selected);
  const page = useStore((s) => s.page);
  const targetUri = selected?.uri ?? page?.pageUri ?? null;

  const [state, setState] = useState<DualState>(() => initialStateFor(targetUri));
  const [prevUri, setPrevUri] = useState(targetUri);

  if (prevUri !== targetUri) {
    setPrevUri(targetUri);
    setState(initialStateFor(targetUri));
  }

  useEffect(() => {
    if (!targetUri || !isPublished(targetUri)) return;

    let cancelled = false;

    Promise.all([
      fetch(buildUrl(targetUri, '.json'), { credentials: 'include' }).then((r) => r.json()),
      fetch(buildUrl(unpublishedUri(targetUri), '.json'), { credentials: 'include' }).then((r) =>
        r.json()
      ),
    ])
      .then(([published, draft]) => {
        if (cancelled) return;
        setState({ status: 'success', published, draft });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [targetUri]);

  if (!targetUri) {
    return <div className="cs-empty">Select a component to compare its versions.</div>;
  }

  if (!isPublished(targetUri)) {
    return (
      <div className="cs-empty">
        Diff is only available for published items. The current selection is a draft.
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="cs-loading">
        <span className="cs-spinner" /> Loading both versions…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="cs-empty">
        Failed to load diff: <code>{state.error}</code>
      </div>
    );
  }

  if (state.status !== 'success') return null;

  const lines = diffLines(state.published, state.draft);

  return (
    <section className="cs-section">
      <h4 className="cs-section-title">Published → Draft</h4>
      <pre className="cs-json" style={{ maxHeight: 360 }}>
        {lines.map((l, i) => {
          const cls =
            l.tone === 'added' ? 'cs-diff-added' : l.tone === 'removed' ? 'cs-diff-removed' : '';
          const prefix = l.tone === 'added' ? '+ ' : l.tone === 'removed' ? '- ' : '  ';
          return (
            <div key={i} className={cls} style={{ padding: '0 4px' }}>
              {prefix}
              {l.text}
            </div>
          );
        })}
      </pre>
    </section>
  );
}

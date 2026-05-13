import { useEffect, useMemo, useState } from 'react';
import { buildUrl, isPublished, unpublishedUri } from '@/lib/clay-uri';
import { ENVIRONMENT_LABELS, ENVIRONMENT_ORDER, type Environment } from '@/lib/types';
import { useEnvHost, useStore } from '../store';

type DiffMode = 'published-vs-draft' | `env:${Environment}`;

interface DualState {
  readonly status: 'idle' | 'loading' | 'success' | 'error';
  readonly left?: unknown;
  readonly right?: unknown;
  readonly error?: string;
}

interface DiffOption {
  readonly id: DiffMode;
  readonly label: string;
  readonly leftLabel: string;
  readonly rightLabel: string;
  readonly available: boolean;
  readonly hostOverride?: string;
}

function diffLines(
  left: unknown,
  right: unknown
): Array<{ text: string; tone: 'added' | 'removed' | 'context' }> {
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

export function DiffView() {
  const selected = useStore((s) => s.selected);
  const page = useStore((s) => s.page);
  const envHost = useEnvHost();
  const env = useStore((s) => s.preferences.defaultEnvironment);
  const envHosts = useStore((s) => s.preferences.environments);
  const targetUri = selected?.uri ?? page?.pageUri ?? null;

  const [mode, setMode] = useState<DiffMode>('published-vs-draft');

  const options: DiffOption[] = useMemo(() => {
    const list: DiffOption[] = [
      {
        id: 'published-vs-draft',
        label: 'Published vs. Draft',
        leftLabel: 'Published',
        rightLabel: 'Draft',
        available: !!targetUri && isPublished(targetUri ?? ''),
      },
    ];
    for (const e of ENVIRONMENT_ORDER) {
      if (e === env) continue;
      const host = envHosts[e];
      list.push({
        id: `env:${e}`,
        label: `${ENVIRONMENT_LABELS[env]} vs. ${ENVIRONMENT_LABELS[e]}`,
        leftLabel: ENVIRONMENT_LABELS[env],
        rightLabel: ENVIRONMENT_LABELS[e],
        available: !!targetUri && Boolean(host?.trim()),
        hostOverride: host,
      });
    }
    return list;
  }, [targetUri, env, envHosts]);

  const activeOption =
    options.find((o) => o.id === mode && o.available) ??
    options.find((o) => o.available) ??
    options[0]!;

  const currentKey = `${activeOption.id}::${envHost}::${targetUri ?? ''}`;
  const initial: DualState =
    targetUri && activeOption.available ? { status: 'loading' } : { status: 'idle' };
  const [state, setState] = useState<DualState>(initial);
  const [prevKey, setPrevKey] = useState(currentKey);

  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setState(initial);
  }

  useEffect(() => {
    if (!targetUri || !activeOption.available) return;
    let cancelled = false;

    const leftUrl = buildUrl(targetUri, '.json', envHost);
    const rightUrl =
      activeOption.id === 'published-vs-draft'
        ? buildUrl(unpublishedUri(targetUri), '.json', envHost)
        : buildUrl(targetUri, '.json', activeOption.hostOverride ?? '');

    Promise.all([
      fetch(leftUrl, { credentials: 'include' }).then((r) => r.json()),
      fetch(rightUrl, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([left, right]) => {
        if (cancelled) return;
        setState({ status: 'success', left, right });
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
  }, [targetUri, envHost, activeOption.id, activeOption.available, activeOption.hostOverride]);

  if (!targetUri) {
    return <div className="cs-empty">Select a component to compare its versions.</div>;
  }

  return (
    <section className="cs-section">
      <div className="cs-diff-controls">
        <label>
          <span>Compare:</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as DiffMode)}>
            {options.map((o) => (
              <option key={o.id} value={o.id} disabled={!o.available}>
                {o.label}
                {!o.available ? ' (unavailable)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!activeOption.available && (
        <div className="cs-empty">
          {activeOption.id === 'published-vs-draft'
            ? 'Diff is only available for published items. The current selection is a draft.'
            : `No host configured for ${activeOption.rightLabel}. Set one in Settings → Environments.`}
        </div>
      )}

      {activeOption.available && state.status === 'loading' && (
        <div className="cs-loading">
          <span className="cs-spinner" /> Loading both versions…
        </div>
      )}

      {activeOption.available && state.status === 'error' && (
        <div className="cs-empty">
          Failed to load diff: <code>{state.error}</code>
        </div>
      )}

      {activeOption.available && state.status === 'success' && (
        <>
          <h4 className="cs-section-title">
            {activeOption.leftLabel} → {activeOption.rightLabel}
          </h4>
          <pre className="cs-json" style={{ maxHeight: 360 }}>
            {diffLines(state.left, state.right).map((l, i) => {
              const cls =
                l.tone === 'added'
                  ? 'cs-diff-added'
                  : l.tone === 'removed'
                    ? 'cs-diff-removed'
                    : '';
              const prefix = l.tone === 'added' ? '+ ' : l.tone === 'removed' ? '- ' : '  ';
              return (
                <div key={i} className={cls} style={{ padding: '0 4px' }}>
                  {prefix}
                  {l.text}
                </div>
              );
            })}
          </pre>
        </>
      )}
    </section>
  );
}

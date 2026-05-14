import { useEffect, useMemo, useState } from 'react';
import { buildUrl, isPublished, unpublishedUri } from '@/lib/clay-uri';
import { findMappingForHost } from '@/lib/site-host';
import { SITE_ENV_LABELS, SITE_ENV_ORDER, type SiteEnv } from '@/lib/types';
import { useStore } from '../store';

type DiffMode = 'published-vs-draft' | `env:${SiteEnv}`;

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

/**
 * Cross-environment diff viewer.
 *
 * The "compare against another env" options are derived from the site-host
 * mapping that owns the *current* page's hostname:
 *   1. Look up `location.hostname` in `preferences.siteHosts`.
 *   2. Find every other env in that mapping that has a host configured.
 *   3. Each is offered as `Compare: {currentEnv} vs. {otherEnv}` and the
 *      right-side fetch uses the mapping's host for the chosen env.
 *
 * No global "default environment" config is involved — the only env
 * knowledge the extension has comes from the per-brand mapping the user
 * configured on the Options page. If the current host isn't in any
 * mapping, only the same-env "Published vs. Draft" option is available.
 */
export function DiffView() {
  const selected = useStore((s) => s.selected);
  const page = useStore((s) => s.page);
  const siteHosts = useStore((s) => s.preferences.siteHosts);
  const targetUri = selected?.uri ?? page?.pageUri ?? null;

  // Match the page's hostname to one of the user's site-host mappings.
  // `match` is non-null only when the user has configured a mapping that
  // includes the current host on at least one env.
  const currentHost = location.hostname;
  const match = useMemo(() => findMappingForHost(currentHost, siteHosts), [currentHost, siteHosts]);

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
    if (!match) return list;
    // Offer one cross-env option per OTHER env in the same mapping that
    // has a host configured. Skipping the current env keeps the dropdown
    // free of the trivially-equal "prod vs. prod" entry.
    for (const otherEnv of SITE_ENV_ORDER) {
      if (otherEnv === match.env) continue;
      const otherHost = match.mapping.hosts[otherEnv];
      if (!otherHost) continue;
      list.push({
        id: `env:${otherEnv}`,
        label: `${SITE_ENV_LABELS[match.env]} vs. ${SITE_ENV_LABELS[otherEnv]}`,
        leftLabel: SITE_ENV_LABELS[match.env],
        rightLabel: SITE_ENV_LABELS[otherEnv],
        available: !!targetUri,
        // buildUrl normalizeHost() expects a protocol-y string; the
        // mapping stores bare hostnames so we prefix https:// here.
        hostOverride: `https://${otherHost}`,
      });
    }
    return list;
  }, [targetUri, match]);

  const activeOption =
    options.find((o) => o.id === mode && o.available) ??
    options.find((o) => o.available) ??
    options[0]!;

  const currentKey = `${activeOption.id}::${targetUri ?? ''}`;
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

    // Left side always fetches from the URI's embedded host (the page's
    // current env). Right side either fetches the draft variant from
    // the same host OR the same URI's path from the cross-env host
    // pulled out of the site-host mapping.
    const leftUrl = buildUrl(targetUri, '.json');
    const rightUrl =
      activeOption.id === 'published-vs-draft'
        ? buildUrl(unpublishedUri(targetUri), '.json')
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
  }, [targetUri, activeOption.id, activeOption.available, activeOption.hostOverride]);

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
        {!match && (
          <p className="cs-help">
            Add this site&rsquo;s hostnames in <strong>Settings → Site host mappings</strong> to
            unlock cross-env comparisons.
          </p>
        )}
      </div>

      {!activeOption.available && (
        <div className="cs-empty">
          {activeOption.id === 'published-vs-draft'
            ? 'Diff is only available for published items. The current selection is a draft.'
            : `No host configured for ${activeOption.rightLabel}. Add it in Settings → Site host mappings.`}
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

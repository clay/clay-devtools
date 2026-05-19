import { useCallback, useEffect, useRef, useState } from 'react';
import { highlightJson } from '@/lib/json-highlight';
import { readGlobals, type ReadResult } from '@/content/window-globals-bridge';
import { useCopyAction } from '../hooks/useCopyAction';
import { useStore } from '../store';
import { failureMessage, summarizeValue } from './globals-format';
import { Icon } from './Icon';

/**
 * Each row in the Globals tab is one user-configured `window.<key>`.
 * The map is keyed by the normalized key (no `window.` prefix); the
 * value is `null` while loading and a {@link ReadResult} once the
 * page-bridge has responded (or timed out).
 */
type ResultMap = Readonly<Record<string, ReadResult | null>>;

/**
 * Pre-parse a successful read into the structured value once, so each
 * re-render of the card doesn't reparse the JSON string. Cached on the
 * row object alongside the raw `json` string the user can copy.
 */
interface ParsedSuccess {
  readonly raw: string;
  readonly parsed: unknown;
  readonly parseError: string | null;
}

function parseJson(raw: string): ParsedSuccess {
  try {
    return { raw, parsed: JSON.parse(raw), parseError: null };
  } catch (err) {
    // Should be impossible — the bridge calls JSON.stringify before sending,
    // so the round-trip is guaranteed valid. But cheap defense-in-depth in
    // case a future bridge change forgets to stringify.
    return { raw, parsed: null, parseError: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * One collapsible row for one configured global. Defaults to collapsed
 * even when data is available — the user opts in to the body to keep
 * the tab scannable when there are many globals configured.
 *
 * Reuses the same `.cs-jsonld-*` class family as the SEO tab's JSON-LD
 * viewer so the visual language is identical for "expandable JSON card".
 */
function GlobalRow({
  globalKey,
  result,
  onRefresh,
}: {
  globalKey: string;
  result: ReadResult | null;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { copy, copiedKey } = useCopyAction();
  const copied = copiedKey === 'default';

  const parsed: ParsedSuccess | null =
    result && result.ok ? parseJson(result.json) : null;

  // Mini-summary on the collapsed header so the user gets some signal
  // without having to expand. For success: "object · 14 keys" / "array
  // · 7 items" / "string". For failure: short reason text.
  const secondary = (() => {
    if (result === null) return 'Loading…';
    if (!result.ok) return failureMessage(result);
    if (!parsed || parsed.parseError) return '(bridge response unparseable)';
    return summarizeValue(parsed.parsed);
  })();

  const onCopy = (e: React.MouseEvent) => {
    // Prevent the <summary> click from also toggling the details element.
    e.preventDefault();
    e.stopPropagation();
    if (!result) return;
    if (!result.ok) {
      void copy(failureMessage(result), 'Status');
      return;
    }
    // Reformat the bridge's compact JSON.stringify output into the
    // pretty-printed form the user actually wants on their clipboard.
    // Falls back to the raw string if reparsing somehow fails.
    const text = parsed?.parseError ? result.json : JSON.stringify(parsed?.parsed, null, 2);
    void copy(text, globalKey);
  };

  const onRefreshClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRefresh();
  };

  const cardClasses = ['cs-jsonld-card'];
  if (result && !result.ok) {
    if (result.reason === 'undefined' || result.reason === 'bridge-unavailable') {
      // Neutral-ish failures (the page just doesn't have this global,
      // or the bridge couldn't run) get a warn-tinted border, not the
      // alarming error border — neither is actually a bug.
      cardClasses.push('cs-jsonld-card-has-warn');
    } else {
      cardClasses.push('cs-jsonld-card-has-error');
    }
  }

  return (
    <details
      className={cardClasses.join(' ')}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cs-jsonld-summary">
        <span className="cs-jsonld-chevron" aria-hidden="true">
          ▶
        </span>
        <span className="cs-jsonld-type" title={`window.${globalKey}`}>
          window.{globalKey}
        </span>
        <span className="cs-jsonld-secondary" title={secondary}>
          {secondary}
        </span>
        <button
          type="button"
          className="cs-icon-btn"
          onClick={onRefreshClick}
          aria-label={`Re-read window.${globalKey} from the page`}
          title="Re-read from the page"
        >
          <Icon name="refresh" />
        </button>
        <button
          type="button"
          className={`cs-icon-btn cs-jsonld-copy ${copied ? 'cs-icon-btn-copied' : ''}`}
          onClick={onCopy}
          aria-label={copied ? `${globalKey} copied` : `Copy ${globalKey} to clipboard`}
          title={
            copied
              ? 'Copied!'
              : result && result.ok
                ? 'Copy pretty-printed JSON'
                : 'Copy status message'
          }
        >
          <Icon name={copied ? 'check' : 'copy'} />
        </button>
      </summary>
      {/* Body is only mounted once expanded — defers the
          syntax-highlight regex pass on huge dataLayer payloads
          (10k+ entries on some analytics setups) until the user
          actually asks to see them. */}
      {open && (
        <>
          {result === null ? (
            <div className="cs-loading">
              <span className="cs-spinner" /> Reading window.{globalKey}…
            </div>
          ) : !result.ok ? (
            <div className="cs-jsonld-body">
              <p className="cs-jsonld-error">{failureMessage(result)}</p>
            </div>
          ) : parsed && parsed.parseError ? (
            <div className="cs-jsonld-body">
              <p className="cs-jsonld-error">
                Bridge returned unparseable JSON: <code>{parsed.parseError}</code>
              </p>
              <pre className="cs-jsonld-raw">{result.json}</pre>
            </div>
          ) : (
            <pre
              className="cs-json cs-jsonld-body"
              dangerouslySetInnerHTML={{ __html: highlightJson(parsed?.parsed) }}
            />
          )}
        </>
      )}
    </details>
  );
}

/**
 * Renders the list of configured globals (or an empty-state CTA if
 * none configured), plus a tab-level "Refresh all" button.
 *
 * Data flow:
 *   1. On mount, fire one `readGlobals(keys)` and seed `results`.
 *   2. On configured-keys change (the user adds/removes a global on
 *      the Options page), drop stale entries and re-fetch the new
 *      list. Existing entries that survived keep their cached value
 *      so the user doesn't see a spinner-of-everything on every edit.
 *   3. On per-row Refresh, re-fetch just that key.
 *   4. On tab-level "Refresh all", re-fetch all keys.
 *
 * No ambient polling — every read is user-triggered. Matches the
 * design contract documented in `docs/specs/2026-05-19-window-globals-tab.md`.
 */
export function GlobalsTab() {
  const configured = useStore((s) => s.preferences.windowGlobals);
  const pushToast = useStore((s) => s.pushToast);
  const [results, setResults] = useState<ResultMap>({});

  // Track which keys we've already fetched on this tab open, so the
  // configured-keys diff effect doesn't re-fetch the world every
  // time the prefs reference changes (e.g. after an unrelated
  // preference save elsewhere in the panel).
  const fetchedKeysRef = useRef<Set<string>>(new Set());

  const fetchKeys = useCallback(
    async (keys: readonly string[]) => {
      if (keys.length === 0) return;
      // Seed loading state for the keys we're about to fetch — keeps
      // siblings' cached values intact.
      setResults((prev) => {
        const next = { ...prev };
        for (const k of keys) next[k] = null;
        return next;
      });

      const r = await readGlobals(keys);
      setResults((prev) => ({ ...prev, ...r }));
      for (const k of keys) fetchedKeysRef.current.add(k);
    },
    []
  );

  // Configured-keys lifecycle. Effects fire on every `configured`
  // identity change; we de-dupe via fetchedKeysRef so unchanged keys
  // don't refetch.
  useEffect(() => {
    // Drop cached results for keys the user removed in Options.
    setResults((prev) => {
      const next: Record<string, ReadResult | null> = {};
      for (const k of configured) if (k in prev) next[k] = prev[k] as ReadResult | null;
      return next;
    });
    // Clean the seen-set too so a remove-then-readd refetches the
    // value (the user may have refreshed the page in between).
    const surviving = new Set<string>();
    for (const k of configured) if (fetchedKeysRef.current.has(k)) surviving.add(k);
    fetchedKeysRef.current = surviving;

    const toFetch = configured.filter((k) => !fetchedKeysRef.current.has(k));
    if (toFetch.length > 0) void fetchKeys(toFetch);
  }, [configured, fetchKeys]);

  const refreshOne = useCallback(
    (key: string) => {
      void fetchKeys([key]);
    },
    [fetchKeys]
  );

  const refreshAll = useCallback(() => {
    if (configured.length === 0) return;
    // Force re-read of everything: clear the seen-set so fetchKeys
    // re-seeds loading state for each row.
    fetchedKeysRef.current = new Set();
    void fetchKeys(configured);
    pushToast(`Re-read ${configured.length} global${configured.length === 1 ? '' : 's'}`, 'info');
  }, [configured, fetchKeys, pushToast]);

  if (configured.length === 0) {
    return (
      <div className="cs-empty">
        No window globals configured yet.
        <br />
        Open the extension <strong>Options</strong> page and add a key (e.g.{' '}
        <code>nymGtmPage</code>) to see its value here.
      </div>
    );
  }

  return (
    <section className="cs-section">
      <div className="cs-section-header">
        <h4 className="cs-section-title">
          Window globals <span className="cs-section-count">{configured.length}</span>
        </h4>
        <button
          type="button"
          className="cs-icon-btn"
          onClick={refreshAll}
          aria-label="Re-read all configured globals from the page"
          title="Re-read all"
        >
          <Icon name="refresh" />
        </button>
      </div>
      <div className="cs-jsonld-list">
        {configured.map((key) => (
          <GlobalRow
            key={key}
            globalKey={key}
            result={results[key] ?? null}
            onRefresh={() => refreshOne(key)}
          />
        ))}
      </div>
    </section>
  );
}

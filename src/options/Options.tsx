import { useEffect, useRef, useState } from 'react';
import clayIconUrl from '@/assets/clay-icon.png?inline';
import { loadPreferences, savePreferences } from '@/lib/storage';
import { clearRecents } from '@/lib/recents';
import { emptyMapping } from '@/lib/site-host';
import {
  DEFAULT_PREFERENCES,
  HIGHLIGHT_MODE_DESCRIPTIONS,
  HIGHLIGHT_MODE_LABELS,
  HIGHLIGHT_MODE_ORDER,
  SITE_ENV_LABELS,
  SITE_ENV_ORDER,
  type HighlightMode,
  type PanelPosition,
  type SiteEnv,
  type SiteHostMapping,
  type UserPreferences,
} from '@/lib/types';
import { parseResultMessage, parseWindowGlobal } from '@/lib/window-globals';

const PANEL_POSITIONS: Array<{ value: PanelPosition; label: string }> = [
  { value: 'bottom-right', label: 'Bottom right (corner)' },
  { value: 'bottom-left', label: 'Bottom left (corner)' },
  { value: 'top-right', label: 'Top right (corner)' },
  { value: 'top-left', label: 'Top left (corner)' },
  { value: 'left-side', label: 'Left side (full height)' },
  { value: 'right-side', label: 'Right side (full height)' },
];

export function Options() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPreferences().then((p) => {
      setPrefs(p);
      setPrefsLoaded(true);
    });
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const flashSaved = () => {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1200);
  };

  const update = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    void savePreferences({ [key]: value });
    flashSaved();
  };

  const updateSiteHosts = (next: readonly SiteHostMapping[]) => update('siteHosts', next);

  const addSiteMapping = () => updateSiteHosts([...prefs.siteHosts, emptyMapping()]);

  const removeSiteMapping = (id: string) =>
    updateSiteHosts(prefs.siteHosts.filter((m) => m.id !== id));

  const editSiteLabel = (id: string, label: string) =>
    updateSiteHosts(prefs.siteHosts.map((m) => (m.id === id ? { ...m, label } : m)));

  const editSiteHost = (id: string, env: SiteEnv, host: string) =>
    updateSiteHosts(
      prefs.siteHosts.map((m) => {
        if (m.id !== id) return m;
        const trimmed = host.trim();
        const nextHosts = { ...m.hosts };
        if (trimmed) {
          nextHosts[env] = trimmed;
        } else {
          delete nextHosts[env];
        }
        return { ...m, hosts: nextHosts };
      })
    );

  // Window globals editor state. We keep the raw string the user is
  // typing (`globalsDrafts`) separate from the persisted normalized
  // list so the input doesn't fight the user mid-keystroke and so
  // the inline validation message can update on every change without
  // a debounce.
  //
  // The persisted list (`prefs.windowGlobals`) only ever contains
  // normalized identifiers — never `window.foo` or whitespace. Invalid
  // drafts hold their editor slot but contribute nothing to storage,
  // so the user can fix a typo without re-typing siblings.
  //
  // Hydration is deliberately *single-shot* on the first `prefsLoaded`
  // transition — re-hydrating on every `prefs` change would clobber
  // the row the user is currently typing (each keystroke persists,
  // which mutates `prefs`, which would re-fire the effect). Cross-
  // window sync isn't wired in this Options page, so single-shot is
  // the right contract here.
  const [globalsDrafts, setGlobalsDrafts] = useState<string[]>(['']);

  useEffect(() => {
    if (!prefsLoaded) return;
    setGlobalsDrafts(prefs.windowGlobals.length > 0 ? [...prefs.windowGlobals] : ['']);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional single-shot on first load; see comment above.
  }, [prefsLoaded]);

  const persistGlobals = (drafts: readonly string[]) => {
    // Persist only the valid, deduped, normalized keys. The editor
    // can hold invalid rows indefinitely without polluting storage.
    const seen = new Set<string>();
    const out: string[] = [];
    for (const d of drafts) {
      const parsed = parseWindowGlobal(d);
      if (!parsed.ok) continue;
      if (seen.has(parsed.key)) continue;
      seen.add(parsed.key);
      out.push(parsed.key);
    }
    update('windowGlobals', out);
  };

  const editGlobalDraft = (index: number, value: string) => {
    const next = [...globalsDrafts];
    next[index] = value;
    setGlobalsDrafts(next);
    persistGlobals(next);
  };

  const removeGlobalDraft = (index: number) => {
    const next = globalsDrafts.filter((_, i) => i !== index);
    // Always keep at least one row in the editor so the "+ Add" button
    // isn't the only way back to data entry on a fresh wipe.
    setGlobalsDrafts(next.length > 0 ? next : ['']);
    persistGlobals(next);
  };

  const addGlobalDraft = () => {
    setGlobalsDrafts([...globalsDrafts, '']);
  };

  return (
    <div className="options">
      <header className="options-header">
        <img className="options-logo" src={clayIconUrl} alt="" aria-hidden="true" />
        <h1>Clay Slip Settings</h1>
        {saved && <span className="options-saved">Saved</span>}
      </header>

      <section className="options-section">
        <h2>Appearance</h2>

        <label className="options-row">
          <div className="options-label">
            <span>Theme</span>
            <span className="options-help">Match your system or pick a fixed palette.</span>
          </div>
          <select
            value={prefs.theme}
            onChange={(e) => update('theme', e.target.value as UserPreferences['theme'])}
          >
            <option value="auto">Auto (system)</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label className="options-row">
          <div className="options-label">
            <span>Panel position</span>
            <span className="options-help">
              Where the panel docks. Side modes go full-height like a sidebar; corner modes are
              draggable.
            </span>
          </div>
          <select
            value={prefs.panelPosition}
            onChange={(e) => update('panelPosition', e.target.value as PanelPosition)}
          >
            {PANEL_POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="options-row">
          <div className="options-label">
            <span>Panel width</span>
            <span className="options-help">
              Drag the inner vertical edge of the panel to resize live.
            </span>
          </div>
          <input
            type="range"
            min={280}
            max={720}
            step={20}
            value={prefs.panelWidth}
            onChange={(e) => update('panelWidth', Number(e.target.value))}
          />
        </label>

        <label className="options-row">
          <div className="options-label">
            <span>Panel height</span>
            <span className="options-help">
              Drag the inner horizontal edge or the inner corner to resize. (Side-dock modes are
              always full-height.)
            </span>
          </div>
          <input
            type="range"
            min={240}
            max={900}
            step={20}
            value={prefs.panelHeight}
            onChange={(e) => update('panelHeight', Number(e.target.value))}
          />
        </label>

        <label className="options-row">
          <div className="options-label">
            <span>Highlight mode</span>
            <span className="options-help">
              {HIGHLIGHT_MODE_DESCRIPTIONS[prefs.highlightMode]} You can also press <kbd>h</kbd> on
              any Clay page to cycle through modes.
            </span>
          </div>
          <select
            value={prefs.highlightMode}
            onChange={(e) => update('highlightMode', e.target.value as HighlightMode)}
          >
            {HIGHLIGHT_MODE_ORDER.map((m) => (
              <option key={m} value={m}>
                {HIGHLIGHT_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="options-row">
          <div className="options-label">
            <span>Highlight intensity</span>
            <span className="options-help">
              Master opacity multiplier for every outline. Useful for taming the &ldquo;all
              components&rdquo; mode on dense pages without changing the mode itself.
            </span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={prefs.highlightOpacity}
            onChange={(e) => update('highlightOpacity', Number(e.target.value))}
          />
        </label>
      </section>

      <section className="options-section">
        <h2>Site host mappings</h2>
        <p className="options-section-help">
          Per-brand hostnames for each environment. This is the <strong>only</strong> place the
          extension learns about your environments — there&rsquo;s no separate global env config.
          When configured, the panel shows a <strong>View on…</strong> pill row on every Clay page
          so you can jump to the equivalent URL on a different env in one click, and the{' '}
          <strong>Diff</strong> tab uses the same mapping to fetch and compare a component&rsquo;s
          data across envs. Enter bare hostnames (e.g. <code>www.thecut.com</code>, not{' '}
          <code>https://www.thecut.com</code>). Leave a cell blank if the brand isn&rsquo;t deployed
          in that env.
        </p>

        {prefs.siteHosts.length === 0 && (
          <p className="options-empty">
            No mappings configured yet. Add one to enable cross-env navigation.
          </p>
        )}

        {prefs.siteHosts.length > 0 && (
          <div className="options-mappings">
            <div className="options-mappings-header">
              <span>Label</span>
              {SITE_ENV_ORDER.map((env) => (
                <span key={env}>{SITE_ENV_LABELS[env]}</span>
              ))}
              <span aria-hidden="true" />
            </div>
            {prefs.siteHosts.map((mapping) => (
              <div key={mapping.id} className="options-mappings-row">
                <input
                  type="text"
                  placeholder="The Cut"
                  value={mapping.label}
                  onChange={(e) => editSiteLabel(mapping.id, e.target.value)}
                />
                {SITE_ENV_ORDER.map((env) => (
                  <input
                    key={env}
                    type="text"
                    placeholder={env === 'prod' ? 'www.example.com' : `${env}.example.com`}
                    value={mapping.hosts[env] ?? ''}
                    onChange={(e) => editSiteHost(mapping.id, env, e.target.value)}
                  />
                ))}
                <button
                  className="options-remove"
                  title="Remove mapping"
                  aria-label={`Remove ${mapping.label || 'mapping'}`}
                  onClick={() => removeSiteMapping(mapping.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="options-row">
          <div className="options-label">
            <span>Add mapping</span>
            <span className="options-help">Create a new brand row.</span>
          </div>
          <button className="options-secondary" onClick={addSiteMapping}>
            + Add
          </button>
        </div>
      </section>

      <section className="options-section">
        <h2>Window globals</h2>
        <p className="options-section-help">
          Top-level <code>window.*</code> values you want to inspect on every Clay page. Each entry
          gets its own collapsible card in the <strong>Globals</strong> panel tab, rendered as
          syntax-highlighted JSON. Useful for analytics payloads (e.g. <code>nymGtmPage</code>,{' '}
          <code>dataLayer</code>) or any object/array your site sets on <code>window</code> at boot.
          You can type either form &mdash; <code>nymGtmPage</code> or <code>window.nymGtmPage</code>{' '}
          &mdash; the extension normalizes them. Nested paths (<code>foo.bar</code>) and array
          indices (<code>dataLayer[0]</code>) aren&rsquo;t supported yet; only top-level globals.
          Functions and symbol values can&rsquo;t be JSON-serialized, so they show as{' '}
          <em>&ldquo;not serializable&rdquo;</em>.
        </p>

        <div className="options-globals">
          {globalsDrafts.map((draft, index) => {
            const parsed = parseWindowGlobal(draft);
            // Only show validation noise once the user has typed
            // something. An empty row should look "ready" not
            // "broken" — the placeholder already invites a value.
            const showError = !parsed.ok && draft.trim().length > 0;
            const errorMessage = showError ? parseResultMessage(parsed) : null;
            return (
              <div key={index} className="options-globals-entry">
                <div className="options-globals-row">
                  <input
                    type="text"
                    placeholder="nymGtmPage  or  window.dataLayer"
                    value={draft}
                    aria-invalid={showError || undefined}
                    onChange={(e) => editGlobalDraft(index, e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button
                    className="options-remove"
                    title="Remove global"
                    aria-label={`Remove global ${draft || index + 1}`}
                    onClick={() => removeGlobalDraft(index)}
                  >
                    ✕
                  </button>
                </div>
                {errorMessage && <p className="options-row-error">{errorMessage}</p>}
              </div>
            );
          })}
        </div>

        <div className="options-row">
          <div className="options-label">
            <span>Add global</span>
            <span className="options-help">Append a new row to the editor.</span>
          </div>
          <button className="options-secondary" onClick={addGlobalDraft}>
            + Add
          </button>
        </div>
      </section>

      <section className="options-section">
        <h2>Workflow</h2>

        <label className="options-row">
          <div className="options-label">
            <span>Keyboard shortcuts</span>
            <span className="options-help">
              Press <kbd>?</kbd> while inspecting to see the full list.
            </span>
          </div>
          <input
            type="checkbox"
            checked={prefs.enableShortcuts}
            onChange={(e) => update('enableShortcuts', e.target.checked)}
          />
        </label>

        <label className="options-row">
          <div className="options-label">
            <span>Recent components history</span>
            <span className="options-help">
              How many of your most recently inspected components Slip remembers across sessions.
            </span>
          </div>
          <input
            type="number"
            min={5}
            max={100}
            step={5}
            value={prefs.maxRecentComponents}
            onChange={(e) => update('maxRecentComponents', Number(e.target.value))}
          />
        </label>

        <div className="options-row">
          <div className="options-label">
            <span>Clear recents</span>
            <span className="options-help">Wipe the recent components list.</span>
          </div>
          <button
            className="options-secondary"
            onClick={async () => {
              await clearRecents();
              flashSaved();
            }}
          >
            Clear
          </button>
        </div>
      </section>

      <footer className="options-footer">
        <span>
          Clay Slip · open source · MIT ·{' '}
          <a href="https://github.com/clay/clay-devtools" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </span>
      </footer>
    </div>
  );
}

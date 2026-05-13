import { useEffect, useRef, useState } from 'react';
import clayIconUrl from '@/assets/clay-icon.png?inline';
import { loadPreferences, savePreferences } from '@/lib/storage';
import { clearRecents } from '@/lib/recents';
import { emptyMapping } from '@/lib/site-host';
import {
  DEFAULT_PREFERENCES,
  ENVIRONMENT_LABELS,
  ENVIRONMENT_ORDER,
  HIGHLIGHT_MODE_DESCRIPTIONS,
  HIGHLIGHT_MODE_LABELS,
  HIGHLIGHT_MODE_ORDER,
  SITE_ENV_LABELS,
  SITE_ENV_ORDER,
  type Environment,
  type EnvironmentHosts,
  type HighlightMode,
  type PanelPosition,
  type SiteEnv,
  type SiteHostMapping,
  type UserPreferences,
} from '@/lib/types';

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
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPreferences().then(setPrefs);
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

  const updateEnvHost = (env: Environment, host: string) => {
    const nextHosts: EnvironmentHosts = { ...prefs.environments, [env]: host };
    update('environments', nextHosts);
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
        <h2>Environments</h2>
        <p className="options-section-help">
          Configure each environment&rsquo;s host (e.g. <code>https://prod.example.com</code>).
          Leave blank to keep using the page&rsquo;s existing host. The env switcher pill in the
          panel cycles through these, and the Diff tab can compare any two configured envs.
        </p>

        <label className="options-row">
          <div className="options-label">
            <span>Active environment</span>
            <span className="options-help">
              Which configured host to route links + fetches through.
            </span>
          </div>
          <select
            value={prefs.defaultEnvironment}
            onChange={(e) =>
              update('defaultEnvironment', e.target.value as UserPreferences['defaultEnvironment'])
            }
          >
            {ENVIRONMENT_ORDER.map((env) => (
              <option key={env} value={env}>
                {ENVIRONMENT_LABELS[env]}
              </option>
            ))}
          </select>
        </label>

        {ENVIRONMENT_ORDER.map((env) => (
          <label className="options-row" key={env}>
            <div className="options-label">
              <span>{ENVIRONMENT_LABELS[env]} host</span>
              <span className="options-help">
                Used when <code>env: {env}</code> is selected.
              </span>
            </div>
            <input
              type="text"
              placeholder="https://"
              value={prefs.environments[env] ?? ''}
              onChange={(e) => updateEnvHost(env, e.target.value)}
            />
          </label>
        ))}
      </section>

      <section className="options-section">
        <h2>Site host mappings</h2>
        <p className="options-section-help">
          Per-brand hostnames for each environment. When configured, the panel shows a{' '}
          <strong>View on…</strong> pill row on every Clay page so you can jump to the equivalent
          URL on a different env in one click. Enter bare hostnames (e.g.{' '}
          <code>www.thecut.com</code>, not <code>https://www.thecut.com</code>). Leave a cell blank
          if the brand isn&rsquo;t deployed in that env.
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

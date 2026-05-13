import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clayIconUrl from '@/assets/clay-icon.png?inline';
import {
  isValidHost,
  listGrantedHosts,
  removeHostPermission,
  requestHostPermission,
  type Host,
} from '@/lib/permissions';
import { loadPreferences, savePreferences } from '@/lib/storage';
import { clearRecents } from '@/lib/recents';
import { emptyMapping } from '@/lib/site-host';
import {
  DEFAULT_PREFERENCES,
  ENVIRONMENT_LABELS,
  ENVIRONMENT_ORDER,
  SITE_ENV_LABELS,
  SITE_ENV_ORDER,
  type Environment,
  type EnvironmentHosts,
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
  const [grantedHosts, setGrantedHosts] = useState<readonly Host[]>([]);
  const [newHost, setNewHost] = useState('');
  const [grantBusy, setGrantBusy] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Async version for use in event handlers (where the lint rule about
  // calling setState inside useEffect doesn't apply). The useEffect below
  // uses the bare .then() form to mirror the loadPreferences pattern and
  // keep react-hooks/set-state-in-effect happy.
  const refreshGrantedHosts = useCallback(async () => {
    setGrantedHosts(await listGrantedHosts());
  }, []);

  useEffect(() => {
    loadPreferences().then(setPrefs);
    listGrantedHosts().then(setGrantedHosts);
    // Keep the list live if the user grants/revokes from the popup or
    // accepts a Chrome consent prompt while the page is open.
    const onChange = () => listGrantedHosts().then(setGrantedHosts);
    chrome.permissions?.onAdded.addListener(onChange);
    chrome.permissions?.onRemoved.addListener(onChange);
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      chrome.permissions?.onAdded.removeListener(onChange);
      chrome.permissions?.onRemoved.removeListener(onChange);
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

  // Hostnames the user has put into a site mapping but hasn't yet granted
  // permission for. Surfaced as a "Grant access" suggestion strip so the
  // two halves of the configuration stay in sync.
  const pendingMappingHosts = useMemo(() => {
    const granted = new Set(grantedHosts);
    const out = new Set<Host>();
    for (const m of prefs.siteHosts) {
      for (const env of SITE_ENV_ORDER) {
        const host = m.hosts[env];
        if (host && !granted.has(host)) out.add(host);
      }
    }
    return [...out].sort();
  }, [grantedHosts, prefs.siteHosts]);

  const grantHost = async (host: Host) => {
    if (!isValidHost(host)) return;
    setGrantBusy(true);
    try {
      const ok = await requestHostPermission(host);
      if (ok) await refreshGrantedHosts();
      setNewHost('');
    } finally {
      setGrantBusy(false);
    }
  };

  const revokeHost = async (host: Host) => {
    setGrantBusy(true);
    try {
      const ok = await removeHostPermission(host);
      if (ok) await refreshGrantedHosts();
    } finally {
      setGrantBusy(false);
    }
  };

  const grantAllPending = async () => {
    setGrantBusy(true);
    try {
      // Request one host at a time so the user sees a per-host prompt and
      // can decline individually. Stop on the first denial.
      for (const host of pendingMappingHosts) {
        const granted = await requestHostPermission(host);
        if (!granted) break;
      }
      await refreshGrantedHosts();
    } finally {
      setGrantBusy(false);
    }
  };

  return (
    <div className="options">
      <header className="options-header">
        <img className="options-logo" src={clayIconUrl} alt="" aria-hidden="true" />
        <h1>Clay Slip Settings</h1>
        {saved && <span className="options-saved">Saved</span>}
      </header>

      <section className="options-section">
        <h2>Allowed sites</h2>
        <p className="options-section-help">
          Clay Slip ships with <strong>no</strong> site access by default. Add the hostnames of your
          Clay deployments here — Chrome will show a native permission prompt for each one. The
          extension only runs on sites you&rsquo;ve explicitly granted.
        </p>

        {grantedHosts.length === 0 && (
          <p className="options-empty">
            No sites granted yet. Add one below or click the toolbar icon on a Clay page and grant
            access from there.
          </p>
        )}

        {grantedHosts.length > 0 && (
          <ul className="options-host-list">
            {grantedHosts.map((host) => (
              <li key={host} className="options-host-row">
                <code className="options-host-name">{host}</code>
                <button
                  type="button"
                  className="options-secondary"
                  onClick={() => void revokeHost(host)}
                  disabled={grantBusy}
                  title={`Revoke Clay Slip's access to ${host}`}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="options-row">
          <div className="options-label">
            <span>Add a site</span>
            <span className="options-help">
              Bare hostname like <code>www.thecut.com</code> (no <code>https://</code>, no path).
            </span>
          </div>
          <form
            className="options-add-host"
            onSubmit={(e) => {
              e.preventDefault();
              void grantHost(newHost.trim());
            }}
          >
            <input
              type="text"
              placeholder="www.example.com"
              value={newHost}
              onChange={(e) => setNewHost(e.target.value)}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <button
              type="submit"
              className="options-secondary"
              disabled={grantBusy || !isValidHost(newHost.trim())}
            >
              {grantBusy ? 'Working…' : 'Grant access'}
            </button>
          </form>
        </div>

        {pendingMappingHosts.length > 0 && (
          <div className="options-pending">
            <p className="options-pending-text">
              <strong>{pendingMappingHosts.length}</strong> host
              {pendingMappingHosts.length === 1 ? '' : 's'} from your site mappings below
              {pendingMappingHosts.length === 1 ? ' is' : ' are'} not granted yet:{' '}
              {pendingMappingHosts.map((h, i) => (
                <span key={h}>
                  {i > 0 && ', '}
                  <code>{h}</code>
                </span>
              ))}
            </p>
            <button
              type="button"
              className="options-secondary"
              onClick={() => void grantAllPending()}
              disabled={grantBusy}
            >
              Grant all
            </button>
          </div>
        )}
      </section>

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
            <span>Highlight intensity</span>
            <span className="options-help">
              Outline opacity for component boundaries on the page.
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

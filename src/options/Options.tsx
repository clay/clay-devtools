import { useEffect, useRef, useState } from 'react';
import { loadPreferences, savePreferences } from '@/lib/storage';
import {
  DEFAULT_PREFERENCES,
  ENVIRONMENT_LABELS,
  ENVIRONMENT_ORDER,
  type Environment,
  type EnvironmentHosts,
  type UserPreferences,
} from '@/lib/types';

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

  return (
    <div className="options">
      <header className="options-header">
        <div className="options-logo">S</div>
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
            <span>Default panel position</span>
            <span className="options-help">
              Where the panel appears when you open it. You can drag it from there.
            </span>
          </div>
          <select
            value={prefs.panelPosition}
            onChange={(e) =>
              update('panelPosition', e.target.value as UserPreferences['panelPosition'])
            }
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
            <option value="top-right">Top right</option>
            <option value="top-left">Top left</option>
          </select>
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
          panel cycles through these.
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

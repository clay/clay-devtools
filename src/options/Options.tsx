import { useEffect, useState } from 'react';
import { loadPreferences, savePreferences } from '@/lib/storage';
import { DEFAULT_PREFERENCES, type UserPreferences } from '@/lib/types';

export function Options() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadPreferences().then(setPrefs);
  }, []);

  const update = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    void savePreferences({ [key]: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
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
            min={0.3}
            max={1}
            step={0.05}
            value={prefs.highlightOpacity}
            onChange={(e) => update('highlightOpacity', Number(e.target.value))}
          />
        </label>
      </section>

      <section className="options-section">
        <h2>Workflow</h2>

        <label className="options-row">
          <div className="options-label">
            <span>Default environment</span>
            <span className="options-help">
              Used by the environment switcher and default link host.
            </span>
          </div>
          <select
            value={prefs.defaultEnvironment}
            onChange={(e) =>
              update('defaultEnvironment', e.target.value as UserPreferences['defaultEnvironment'])
            }
          >
            <option value="local">Local</option>
            <option value="dev">Dev</option>
            <option value="staging">Staging</option>
            <option value="prod">Production</option>
          </select>
        </label>

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

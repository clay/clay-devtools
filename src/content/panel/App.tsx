import { useEffect, useRef } from 'react';
import { loadPreferences, onPreferencesChanged } from '@/lib/storage';
import { setHighlightingEnabled, setHighlightOpacity } from '../highlighter';
import { useStore } from './store';
import { useDraggable } from './hooks/useDraggable';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useThemedRoot } from './hooks/useThemedRoot';
import { useElementSelection } from './hooks/useElementSelection';
import { Header } from './components/Header';
import { Tabs } from './components/Tabs';
import { PageInfo } from './components/PageInfo';
import { ComponentDetails } from './components/ComponentDetails';
import { ComponentTree } from './components/ComponentTree';
import { JsonPreview } from './components/JsonPreview';
import { DiffView } from './components/DiffView';
import { EnvironmentSwitcher } from './components/EnvironmentSwitcher';
import { ShortcutOverlay } from './components/ShortcutOverlay';
import { Toasts } from './components/Toasts';

export function App() {
  const headerRef = useRef<HTMLDivElement>(null);
  const collapsed = useStore((s) => s.collapsed);
  const activeTab = useStore((s) => s.activeTab);
  const corner = useStore((s) => s.preferences.panelPosition);
  const highlightOpacity = useStore((s) => s.preferences.highlightOpacity);
  const highlightEnabled = useStore((s) => s.highlightEnabled);
  const setPrefs = useStore((s) => s.setPreferences);

  const { style: themeStyle } = useThemedRoot();
  const { style: positionStyle } = useDraggable(headerRef, corner);

  useKeyboardShortcuts();
  useElementSelection();

  useEffect(() => {
    loadPreferences().then((prefs) => setPrefs(prefs));
    return onPreferencesChanged((prefs) => setPrefs(prefs));
  }, [setPrefs]);

  useEffect(() => {
    setHighlightOpacity(highlightOpacity);
  }, [highlightOpacity]);

  useEffect(() => {
    setHighlightingEnabled(highlightEnabled);
  }, [highlightEnabled]);

  return (
    <div
      className={`cs-panel ${collapsed ? 'cs-collapsed' : ''}`}
      style={{ ...themeStyle, ...positionStyle }}
    >
      <Header ref={headerRef} />
      {!collapsed && (
        <>
          <Tabs />
          <div className="cs-body">
            {activeTab === 'inspect' && (
              <>
                <PageInfo />
                <ComponentDetails />
                <div style={{ marginTop: 12 }}>
                  <EnvironmentSwitcher />
                </div>
              </>
            )}
            {activeTab === 'tree' && <ComponentTree />}
            {activeTab === 'json' && <JsonPreview />}
            {activeTab === 'diff' && <DiffView />}
          </div>
        </>
      )}
      <ShortcutOverlay />
      <Toasts />
    </div>
  );
}

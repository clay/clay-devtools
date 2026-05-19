import { useEffect, useRef } from 'react';
import { loadPreferences, onPreferencesChanged } from '@/lib/storage';
import { listAnnotations, onAnnotationsChanged } from '@/lib/annotations';
import { loadRecents, onRecentsChanged, pushRecent } from '@/lib/recents';
import { setAnnotatedUris, setHighlightMode, setHighlightOpacity } from '../highlighter';
import { useStore } from './store';
import { useDraggable } from './hooks/useDraggable';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useThemedRoot } from './hooks/useThemedRoot';
import { useElementSelection } from './hooks/useElementSelection';
import { Fab } from './components/Fab';
import { Header } from './components/Header';
import { Tabs } from './components/Tabs';
import { PageInfo } from './components/PageInfo';
import { ComponentDetails } from './components/ComponentDetails';
import { ComponentTree } from './components/ComponentTree';
import { JsonPreview } from './components/JsonPreview';
import { DiffView } from './components/DiffView';
import { ShortcutOverlay } from './components/ShortcutOverlay';
import { Toasts } from './components/Toasts';
import { ResizeHandle } from './components/ResizeHandle';
import { RecentList } from './components/RecentList';
import { NotesTab } from './components/NotesTab';
import { SeoTab } from './components/SeoTab';
import { GlobalsTab } from './components/GlobalsTab';

export function App() {
  const headerRef = useRef<HTMLDivElement>(null);
  const collapsed = useStore((s) => s.collapsed);
  const activeTab = useStore((s) => s.activeTab);
  const corner = useStore((s) => s.preferences.panelPosition);
  const panelWidth = useStore((s) => s.preferences.panelWidth);
  const panelHeight = useStore((s) => s.preferences.panelHeight);
  const highlightOpacity = useStore((s) => s.preferences.highlightOpacity);
  const highlightMode = useStore((s) => s.preferences.highlightMode);
  const setPrefs = useStore((s) => s.setPreferences);
  const setRecents = useStore((s) => s.setRecents);
  const setAnnotations = useStore((s) => s.setAnnotations);
  const selected = useStore((s) => s.selected);
  const annotatedUris = useStore((s) => s.annotatedUris);
  const components = useStore((s) => s.components);
  const maxRecent = useStore((s) => s.preferences.maxRecentComponents);

  const { style: themeStyle } = useThemedRoot();
  const { style: positionStyle } = useDraggable(headerRef, corner, panelWidth, panelHeight);
  const isSideDock = corner === 'left-side' || corner === 'right-side';

  useKeyboardShortcuts();
  useElementSelection();

  useEffect(() => {
    loadPreferences().then((prefs) => setPrefs(prefs));
    return onPreferencesChanged((prefs) => setPrefs(prefs));
  }, [setPrefs]);

  useEffect(() => {
    loadRecents().then(setRecents);
    return onRecentsChanged(setRecents);
  }, [setRecents]);

  useEffect(() => {
    listAnnotations().then(setAnnotations);
    return onAnnotationsChanged(setAnnotations);
  }, [setAnnotations]);

  useEffect(() => {
    setHighlightOpacity(highlightOpacity);
  }, [highlightOpacity]);

  useEffect(() => {
    setHighlightMode(highlightMode);
  }, [highlightMode]);

  // Sync the annotation dot indicators on the page whenever either set changes.
  useEffect(() => {
    setAnnotatedUris(
      components.map((c) => c.element),
      annotatedUris
    );
  }, [components, annotatedUris]);

  // Push every selection into the recents list (deduped + capped).
  useEffect(() => {
    if (!selected) return;
    void pushRecent(
      {
        uri: selected.uri,
        displayName: selected.displayName,
        instance: selected.instance,
        pageUrl: location.href,
        pageTitle: document.title,
        visitedAt: Date.now(),
      },
      maxRecent
    );
  }, [selected, maxRecent]);

  if (collapsed) {
    return (
      <div className="cs-root" style={themeStyle}>
        <Fab />
        <Toasts />
      </div>
    );
  }

  return (
    <div className={`cs-panel cs-pos-${corner}`} style={{ ...themeStyle, ...positionStyle }}>
      <Header ref={headerRef} />
      <Tabs />
      <div className="cs-body">
        {activeTab === 'inspect' && (
          <>
            <PageInfo />
            <ComponentDetails />
            <RecentList />
          </>
        )}
        {activeTab === 'tree' && <ComponentTree />}
        {activeTab === 'json' && <JsonPreview />}
        {activeTab === 'diff' && <DiffView />}
        {activeTab === 'seo' && <SeoTab />}
        {activeTab === 'notes' && <NotesTab />}
        {activeTab === 'globals' && <GlobalsTab />}
      </div>
      <ResizeHandle mode="width" />
      {!isSideDock && <ResizeHandle mode="height" />}
      {!isSideDock && <ResizeHandle mode="corner" />}
      <ShortcutOverlay />
      <Toasts />
    </div>
  );
}

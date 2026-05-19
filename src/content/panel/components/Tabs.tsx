import type { PanelTab } from '../store';
import { useStore } from '../store';

const TABS: ReadonlyArray<{ id: PanelTab; label: string }> = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'tree', label: 'Tree' },
  { id: 'json', label: 'JSON' },
  { id: 'diff', label: 'Diff' },
  { id: 'seo', label: 'SEO' },
  { id: 'notes', label: 'Notes' },
  // Globals is appended last per the spec — it's the most niche tab
  // (only useful once the user has configured at least one global on
  // the Options page) and putting it at the end keeps the daily-driver
  // tabs in their existing positions so muscle memory isn't disturbed.
  { id: 'globals', label: 'Globals' },
];

export function Tabs() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const annotationCount = useStore((s) => s.annotations.length);
  const globalsCount = useStore((s) => s.preferences.windowGlobals.length);

  return (
    <div className="cs-tabs" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`cs-tab ${activeTab === tab.id ? 'cs-active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
          {tab.id === 'notes' && annotationCount > 0 && (
            <span className="cs-tab-badge">{annotationCount}</span>
          )}
          {tab.id === 'globals' && globalsCount > 0 && (
            <span className="cs-tab-badge">{globalsCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

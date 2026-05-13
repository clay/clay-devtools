import type { PanelTab } from '../store';
import { useStore } from '../store';

const TABS: ReadonlyArray<{ id: PanelTab; label: string }> = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'tree', label: 'Tree' },
  { id: 'json', label: 'JSON' },
  { id: 'diff', label: 'Diff' },
  { id: 'seo', label: 'SEO' },
  { id: 'notes', label: 'Notes' },
];

export function Tabs() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const annotationCount = useStore((s) => s.annotations.length);

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
        </button>
      ))}
    </div>
  );
}

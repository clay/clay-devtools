import { forwardRef } from 'react';
import { Icon } from './Icon';
import { useStore } from '../store';

export const Header = forwardRef<HTMLDivElement>(function Header(_, ref) {
  const page = useStore((s) => s.page);
  const collapsed = useStore((s) => s.collapsed);
  const toggleCollapsed = useStore((s) => s.toggleCollapsed);
  const toggleShortcuts = useStore((s) => s.toggleShortcuts);
  const componentCount = useStore((s) => s.components.length);

  const openOptions = () => {
    chrome.runtime.openOptionsPage?.();
  };

  return (
    <div className="cs-header" ref={ref}>
      <div className="cs-logo">S</div>
      <div className="cs-title">
        Clay Slip{' '}
        <span style={{ color: 'var(--cs-text-subtle)', fontWeight: 400, fontSize: 11 }}>
          · {componentCount}
        </span>
      </div>
      {page && (
        <span className={`cs-status ${page.isPublished ? 'cs-published' : 'cs-draft'}`}>
          {page.isPublished ? 'Published' : 'Draft'}
        </span>
      )}
      <button
        className="cs-icon-btn"
        onClick={toggleShortcuts}
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
      >
        <Icon name="question" />
      </button>
      <button className="cs-icon-btn" onClick={openOptions} title="Settings" aria-label="Settings">
        <Icon name="settings" />
      </button>
      <button
        className="cs-icon-btn"
        onClick={toggleCollapsed}
        title={collapsed ? 'Expand' : 'Collapse'}
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        <Icon name={collapsed ? 'expand' : 'collapse'} />
      </button>
    </div>
  );
});

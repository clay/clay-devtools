import type { Ref } from 'react';
import type { RuntimeMessage } from '@/lib/types';
import { Icon } from './Icon';
import { useStore } from '../store';

interface HeaderProps {
  ref?: Ref<HTMLDivElement>;
}

export function Header({ ref }: HeaderProps) {
  const page = useStore((s) => s.page);
  const toggleCollapsed = useStore((s) => s.toggleCollapsed);
  const toggleShortcuts = useStore((s) => s.toggleShortcuts);
  const toggleHighlights = useStore((s) => s.toggleHighlights);
  const highlightEnabled = useStore((s) => s.highlightEnabled);
  const componentCount = useStore((s) => s.components.length);

  const openOptions = () => {
    chrome.runtime
      .sendMessage({ type: 'OPEN_OPTIONS' } satisfies RuntimeMessage)
      .catch(() => undefined);
  };

  return (
    <div className="cs-header" ref={ref}>
      <div className="cs-logo" title="Clay Slip">
        S
      </div>
      <div className="cs-title">
        <span className="cs-title-text">Clay Slip</span>
        <span className="cs-count" title={`${componentCount} components on this page`}>
          {componentCount}
        </span>
      </div>
      {page && (
        <span className={`cs-status ${page.isPublished ? 'cs-published' : 'cs-draft'}`}>
          {page.isPublished ? 'Published' : 'Draft'}
        </span>
      )}
      <button
        className={`cs-icon-btn ${highlightEnabled ? '' : 'cs-icon-btn-off'}`}
        onClick={toggleHighlights}
        title={highlightEnabled ? 'Hide outlines (h)' : 'Show outlines (h)'}
        aria-label={highlightEnabled ? 'Hide outlines' : 'Show outlines'}
        aria-pressed={!highlightEnabled}
      >
        <Icon name={highlightEnabled ? 'eye' : 'eyeOff'} />
      </button>
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
        title="Collapse to floating button ([)"
        aria-label="Collapse to floating button"
      >
        <Icon name="collapse" />
      </button>
    </div>
  );
}

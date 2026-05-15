import type { Ref } from 'react';
import browser from 'webextension-polyfill';
import clayIconUrl from '@/assets/clay-icon.png?inline';
import type { RuntimeMessage } from '@/lib/types';
import { Icon } from './Icon';
import { HighlightModeMenu } from './HighlightModeMenu';
import { useStore } from '../store';

interface HeaderProps {
  ref?: Ref<HTMLDivElement>;
}

export function Header({ ref }: HeaderProps) {
  const page = useStore((s) => s.page);
  const toggleCollapsed = useStore((s) => s.toggleCollapsed);
  const toggleShortcuts = useStore((s) => s.toggleShortcuts);
  const componentCount = useStore((s) => s.components.length);

  const openOptions = () => {
    browser.runtime
      .sendMessage({ type: 'OPEN_OPTIONS' } satisfies RuntimeMessage)
      .catch(() => undefined);
  };

  return (
    <div className="cs-header" ref={ref}>
      <img className="cs-logo" src={clayIconUrl} alt="" title="Clay Slip" />
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
      <HighlightModeMenu />
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

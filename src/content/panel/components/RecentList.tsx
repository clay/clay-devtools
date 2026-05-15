import browser from 'webextension-polyfill';
import type { RuntimeMessage } from '@/lib/types';
import { useStore } from '../store';
import { setSelected } from '../../highlighter';

const MAX_VISIBLE = 6;

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function RecentList() {
  const recents = useStore((s) => s.recents);
  const components = useStore((s) => s.components);
  const setSelectedStore = useStore((s) => s.setSelected);
  const selected = useStore((s) => s.selected);

  if (recents.length === 0) return null;

  const open = (url: string) => {
    browser.runtime.sendMessage({ type: 'OPEN_TAB', url } satisfies RuntimeMessage);
  };

  const visible = recents.slice(0, MAX_VISIBLE);

  return (
    <section className="cs-section">
      <h4 className="cs-section-title">Recently viewed</h4>
      <ul className="cs-recents">
        {visible.map((r) => {
          const onPage = components.find((c) => c.uri === r.uri);
          return (
            <li key={r.uri} className="cs-recents-item">
              <button
                className="cs-recents-name"
                title={onPage ? 'Select on this page' : 'Open page'}
                onClick={() => {
                  if (onPage) {
                    setSelected(selected?.element ?? null, onPage.element);
                    setSelectedStore(onPage);
                    onPage.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else {
                    open(r.pageUrl);
                  }
                }}
              >
                {r.displayName}
                {onPage && <span className="cs-recents-here"> · here</span>}
              </button>
              <span className="cs-recents-meta">
                {timeAgo(r.visitedAt)}
                {!onPage && <span title={r.pageTitle}> · {new URL(r.pageUrl).hostname}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

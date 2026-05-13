import { useMemo } from 'react';
import { getDisplayName } from '@/lib/clay-uri';
import { getNestingPath } from '../../page-info';
import { setSelected } from '../../highlighter';
import { useStore } from '../store';

export function Breadcrumb() {
  const selected = useStore((s) => s.selected);
  const components = useStore((s) => s.components);
  const setSelectedStore = useStore((s) => s.setSelected);

  const trail = useMemo(() => {
    if (!selected) return [];
    return getNestingPath(selected.element);
  }, [selected]);

  if (!selected || trail.length === 0) return null;

  return (
    <div className="cs-breadcrumb" aria-label="Component nesting">
      {trail.map((el, i) => {
        const uri = el.getAttribute('data-uri') ?? '';
        const info = components.find((c) => c.element === el);
        return (
          <span key={`${uri}-${i}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button
              className="cs-breadcrumb-item"
              onClick={() => {
                if (!info) return;
                setSelected(selected.element, info.element);
                setSelectedStore(info);
                info.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              {getDisplayName(uri)}
            </button>
            <span className="cs-breadcrumb-sep">/</span>
          </span>
        );
      })}
      <span style={{ color: 'var(--cs-text)' }}>{selected.displayName}</span>
    </div>
  );
}

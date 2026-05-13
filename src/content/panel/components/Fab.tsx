import type { CSSProperties } from 'react';
import type { PanelPosition } from '@/lib/types';
import { useStore } from '../store';

const MARGIN = 20;

/**
 * Maps the user's panel-position preference to a FAB anchor. Side-dock modes
 * (`left-side` / `right-side`) collapse to the bottom corner on the matching
 * side — full-height side panels can't meaningfully shrink to a horizontal
 * pill, so the bottom corner is the natural resting place.
 */
function fabAnchorFor(corner: PanelPosition): CSSProperties {
  const isRight = corner === 'bottom-right' || corner === 'top-right' || corner === 'right-side';
  const isTop = corner === 'top-right' || corner === 'top-left';
  return {
    position: 'fixed',
    [isRight ? 'right' : 'left']: MARGIN,
    [isTop ? 'top' : 'bottom']: MARGIN,
  };
}

/**
 * Floating action button that lives at the user's preferred corner whenever
 * the panel is collapsed. Click expands the panel; the panel's collapse
 * button returns to this state. Standard browser-extension chrome pattern.
 */
export function Fab() {
  const corner = useStore((s) => s.preferences.panelPosition);
  const componentCount = useStore((s) => s.components.length);
  const toggleCollapsed = useStore((s) => s.toggleCollapsed);
  const page = useStore((s) => s.page);

  const tooltip = page
    ? `Open Clay Slip — ${componentCount} component${componentCount === 1 ? '' : 's'} on this page`
    : 'Open Clay Slip';

  return (
    <button
      type="button"
      className="cs-fab"
      style={fabAnchorFor(corner)}
      onClick={toggleCollapsed}
      title={tooltip}
      aria-label={tooltip}
    >
      <span className="cs-fab-logo" aria-hidden="true">
        S
      </span>
      {componentCount > 0 && (
        <span className="cs-fab-badge" aria-hidden="true">
          {componentCount > 99 ? '99+' : componentCount}
        </span>
      )}
    </button>
  );
}

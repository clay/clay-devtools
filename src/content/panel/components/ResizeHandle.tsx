import { savePreferences } from '@/lib/storage';
import type { PanelPosition } from '@/lib/types';
import { useStore } from '../store';

const MIN_W = 280;
const MAX_W = 720;
const MIN_H = 240;

type Mode = 'width' | 'height' | 'corner';

interface Props {
  mode: Mode;
}

const isRightAnchor = (p: PanelPosition) =>
  p === 'bottom-right' || p === 'top-right' || p === 'right-side';
const isBottomAnchor = (p: PanelPosition) => p === 'bottom-right' || p === 'bottom-left';

function clamp(min: number, max: number, n: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * One handle, three flavors:
 *   - width:  vertical strip on the inner vertical edge
 *   - height: horizontal strip on the inner horizontal edge
 *   - corner: small grabber in the inner corner that does both at once
 *
 * "Inner" = the edge of the panel that faces the viewport interior, opposite
 * to the dock anchor. For a bottom-right panel that's the top + left edges
 * (and the top-left grabber), so the panel always grows toward the inside.
 */
export function ResizeHandle({ mode }: Props) {
  const corner = useStore((s) => s.preferences.panelPosition);
  const setPrefs = useStore((s) => s.setPreferences);

  const right = isRightAnchor(corner);
  const bottom = isBottomAnchor(corner);
  const widthDir = right ? -1 : 1;
  const heightDir = bottom ? -1 : 1;

  const onPointerDown = (e: React.PointerEvent) => {
    const startW = useStore.getState().preferences.panelWidth;
    const startH = useStore.getState().preferences.panelHeight;
    const startX = e.clientX;
    const startY = e.clientY;
    const maxH = window.innerHeight - 40;

    const onMove = (ev: PointerEvent) => {
      const next: { panelWidth?: number; panelHeight?: number } = {};
      if (mode === 'width' || mode === 'corner') {
        const dx = ev.clientX - startX;
        next.panelWidth = clamp(MIN_W, MAX_W, Math.round(startW + dx * widthDir));
      }
      if (mode === 'height' || mode === 'corner') {
        const dy = ev.clientY - startY;
        next.panelHeight = clamp(MIN_H, maxH, Math.round(startH + dy * heightDir));
      }
      setPrefs(next);
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const { panelWidth, panelHeight } = useStore.getState().preferences;
      void savePreferences({ panelWidth, panelHeight });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    e.preventDefault();
    e.stopPropagation();
  };

  // Position class — handle lives on the panel's inner edge(s).
  const xPos = right ? 'left' : 'right'; // inner vertical edge
  const yPos = bottom ? 'top' : 'bottom'; // inner horizontal edge

  let className = 'cs-resize';
  if (mode === 'width') className += ` cs-resize-width cs-resize-${xPos}`;
  else if (mode === 'height') className += ` cs-resize-height cs-resize-${yPos}`;
  else className += ` cs-resize-corner cs-resize-corner-${yPos}-${xPos}`;

  // Corner cursor: nwse when inner-corner is top-left or bottom-right (panel
  // anchored bottom-right or top-left). nesw otherwise.
  const cornerCursor = right === bottom ? 'nwse-resize' : 'nesw-resize';
  const cursor = mode === 'width' ? 'ew-resize' : mode === 'height' ? 'ns-resize' : cornerCursor;

  return (
    <div
      className={className}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      title={
        mode === 'corner'
          ? 'Drag to resize'
          : mode === 'width'
            ? 'Drag to resize width'
            : 'Drag to resize height'
      }
      role="separator"
      aria-label="Resize panel"
    />
  );
}

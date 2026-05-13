import { savePreferences } from '@/lib/storage';
import { useStore } from '../store';

const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

/**
 * Drag handle on the inner edge of the panel that resizes the panel width.
 * Position depends on dock side: handle sits on the left edge when docked to
 * the right (or right corner), right edge when docked to the left.
 */
export function ResizeHandle() {
  const corner = useStore((s) => s.preferences.panelPosition);
  const setPrefs = useStore((s) => s.setPreferences);

  const onPointerDown = (e: React.PointerEvent) => {
    const startWidth = useStore.getState().preferences.panelWidth;
    const startX = e.clientX;
    const direction = corner.endsWith('right') || corner === 'right-side' ? -1 : 1;

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const next = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, Math.round(startWidth + delta * direction))
      );
      setPrefs({ panelWidth: next });
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      void savePreferences({ panelWidth: useStore.getState().preferences.panelWidth });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    e.preventDefault();
    e.stopPropagation();
  };

  const side =
    corner.endsWith('right') || corner === 'right-side' ? 'cs-resize-left' : 'cs-resize-right';

  return (
    <div
      className={`cs-resize ${side}`}
      onPointerDown={onPointerDown}
      title="Drag to resize"
      aria-label="Resize panel"
      role="separator"
    />
  );
}

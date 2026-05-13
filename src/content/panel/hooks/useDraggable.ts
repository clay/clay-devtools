import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PanelPosition } from '@/lib/types';

interface Anchor {
  readonly x: number;
  readonly y: number;
}

const DEFAULT_MARGIN = 24;

function defaultAnchorFor(_corner: PanelPosition): Anchor {
  return { x: DEFAULT_MARGIN, y: DEFAULT_MARGIN };
}

function isSideDock(p: PanelPosition): boolean {
  return p === 'left-side' || p === 'right-side';
}

function isRightAnchored(p: PanelPosition): boolean {
  return p === 'bottom-right' || p === 'top-right' || p === 'right-side';
}

function isBottomAnchored(p: PanelPosition): boolean {
  return p === 'bottom-right' || p === 'bottom-left';
}

/**
 * Positions the panel using anchor-edge CSS (right/bottom for right/bottom-
 * anchored panels, left/top for the others). The anchor is the distance from
 * the panel's anchored corner to the corresponding screen edge — so resizing
 * width/height naturally grows the panel toward the screen interior, never
 * off-screen.
 *
 * For side docks the panel is full-height; only width matters.
 */
export function useDraggable(
  handleRef: React.RefObject<HTMLElement | null>,
  corner: PanelPosition,
  panelWidth: number,
  panelHeight: number
): { style: CSSProperties } {
  const [anchor, setAnchor] = useState<Anchor>(() => defaultAnchorFor(corner));
  const [prevCorner, setPrevCorner] = useState(corner);

  if (prevCorner !== corner) {
    setPrevCorner(corner);
    setAnchor(defaultAnchorFor(corner));
  }

  const sideDock = isSideDock(corner);
  const rightAnchor = isRightAnchored(corner);
  const bottomAnchor = isBottomAnchored(corner);

  useEffect(() => {
    if (sideDock) return;
    const handle = handleRef.current;
    if (!handle) return;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const startAnchor = anchor;
      const startX = e.clientX;
      const startY = e.clientY;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        // Panel anchored to right? Then dragging right (+dx) DECREASES the
        // distance from the right edge. Same for bottom.
        const nextX = rightAnchor ? startAnchor.x - dx : startAnchor.x + dx;
        const nextY = bottomAnchor ? startAnchor.y - dy : startAnchor.y + dy;
        const maxX = window.innerWidth - 200;
        const maxY = window.innerHeight - 80;
        setAnchor({
          x: Math.max(0, Math.min(maxX, nextX)),
          y: Math.max(0, Math.min(maxY, nextY)),
        });
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    };

    handle.addEventListener('mousedown', onMouseDown);
    return () => handle.removeEventListener('mousedown', onMouseDown);
  }, [handleRef, anchor, sideDock, rightAnchor, bottomAnchor]);

  if (sideDock) {
    return {
      style: {
        top: 0,
        bottom: 0,
        left: corner === 'left-side' ? 0 : 'auto',
        right: corner === 'right-side' ? 0 : 'auto',
        width: panelWidth,
        height: 'auto',
        maxHeight: '100vh',
      },
    };
  }

  return {
    style: {
      left: rightAnchor ? 'auto' : anchor.x,
      right: rightAnchor ? anchor.x : 'auto',
      top: bottomAnchor ? 'auto' : anchor.y,
      bottom: bottomAnchor ? anchor.y : 'auto',
      width: panelWidth,
      height: panelHeight,
      maxHeight: 'calc(100vh - 40px)',
    },
  };
}

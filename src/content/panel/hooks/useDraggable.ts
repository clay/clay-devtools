import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { UserPreferences } from '@/lib/types';

interface Position {
  readonly x: number;
  readonly y: number;
}

function defaultPositionFor(corner: UserPreferences['panelPosition']): Position {
  const margin = 24;
  const panelW = 380;
  const panelH = 480;
  switch (corner) {
    case 'bottom-right':
      return { x: window.innerWidth - panelW - margin, y: window.innerHeight - panelH - margin };
    case 'bottom-left':
      return { x: margin, y: window.innerHeight - panelH - margin };
    case 'top-right':
      return { x: window.innerWidth - panelW - margin, y: margin };
    case 'top-left':
      return { x: margin, y: margin };
  }
}

export function useDraggable(
  handleRef: React.RefObject<HTMLElement | null>,
  corner: UserPreferences['panelPosition']
): { position: Position; style: CSSProperties } {
  const [position, setPosition] = useState<Position>(() => defaultPositionFor(corner));
  const [prevCorner, setPrevCorner] = useState(corner);
  const dragOffset = useRef<Position | null>(null);

  if (prevCorner !== corner) {
    setPrevCorner(corner);
    setPosition(defaultPositionFor(corner));
  }

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragOffset.current) return;
      const next = {
        x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 80, e.clientY - dragOffset.current.y)),
      };
      setPosition(next);
    };

    const onMouseUp = () => {
      dragOffset.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
    return () => {
      handle.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleRef, position.x, position.y]);

  return {
    position,
    style: {
      left: position.x,
      top: position.y,
      right: 'auto',
      bottom: 'auto',
    },
  };
}

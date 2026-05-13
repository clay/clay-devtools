import { useEffect } from 'react';
import { setSelected, setHovered as setHoveredOutline } from '../../highlighter';
import { useStore } from '../store';
import type { ClayComponentInfo } from '@/lib/types';

export function useElementSelection(): void {
  const components = useStore((s) => s.components);
  const setSelectedStore = useStore((s) => s.setSelected);

  useEffect(() => {
    const byElement = new Map<HTMLElement, ClayComponentInfo>(
      components.map((c) => [c.element, c])
    );

    let hovered: HTMLElement | null = null;

    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('[data-uri]') as HTMLElement | null;
      if (!target) return;
      const info = byElement.get(target);
      if (!info) return;
      e.preventDefault();
      e.stopPropagation();
      const prev = useStore.getState().selected;
      setSelected(prev?.element ?? null, target);
      setSelectedStore(info);
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('[data-uri]') as HTMLElement | null;
      if (target === hovered) return;
      setHoveredOutline(hovered, target);
      hovered = target;
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('mouseover', onMouseOver, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('mouseover', onMouseOver, true);
      setHoveredOutline(hovered, null);
    };
  }, [components, setSelectedStore]);
}

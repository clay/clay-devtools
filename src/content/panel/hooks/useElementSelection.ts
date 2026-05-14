import { useEffect } from 'react';
import { isEditMode } from '@/lib/clay-uri';
import { setSelected, setHovered as setHoveredOutline } from '../../highlighter';
import { useStore } from '../store';
import type { ClayComponentInfo } from '@/lib/types';

const INTERACTIVE_TAGS = new Set([
  'A',
  'BUTTON',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'LABEL',
  'AUDIO',
  'VIDEO',
  'DETAILS',
  'SUMMARY',
]);

function clickIsOnInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  let node: HTMLElement | null = target;
  while (node && !node.hasAttribute('data-uri')) {
    if (INTERACTIVE_TAGS.has(node.tagName)) return true;
    if (node.isContentEditable) return true;
    node = node.parentElement;
  }
  return false;
}

/**
 * Wires document-level click + mouseover listeners that turn host-page
 * clicks into panel selections.
 *
 * **Skipped on `?edit=true` pages.** Clay's own editor chrome already
 * owns click and hover semantics on those pages — it picks the component
 * to edit, paints its own selection overlay, and would fight ours over
 * `e.preventDefault()` / `e.stopPropagation()`. In passive mode the user
 * picks components from the Tree tab in the panel instead, which goes
 * directly through the store and doesn't need these listeners at all.
 */
export function useElementSelection(): void {
  const components = useStore((s) => s.components);
  const setSelectedStore = useStore((s) => s.setSelected);

  useEffect(() => {
    if (isEditMode()) return;

    const byElement = new Map<HTMLElement, ClayComponentInfo>(
      components.map((c) => [c.element, c])
    );

    let hovered: HTMLElement | null = null;

    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('[data-uri]') as HTMLElement | null;
      if (!target) return;
      const info = byElement.get(target);
      if (!info) return;

      // Always update the selection, but only swallow the event if the user
      // didn't actually click a real interactive element (link, button, etc.).
      const onInteractive = clickIsOnInteractive(e.target);
      if (!onInteractive) {
        e.preventDefault();
        e.stopPropagation();
      }
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

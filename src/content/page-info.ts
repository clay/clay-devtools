import { getDisplayName, getInstance, getPageInstance, isPublished } from '@/lib/clay-uri';
import type { ClayComponentInfo, ClayPageInfo } from '@/lib/types';

export function readPageInfo(): ClayPageInfo | null {
  const html = document.documentElement;
  const pageUri = html.getAttribute('data-uri');
  if (!pageUri) return null;

  return {
    pageUri,
    layoutUri: html.getAttribute('data-layout-uri'),
    isPublished: isPublished(pageUri),
    pageInstance: getPageInstance(pageUri),
  };
}

export function readComponents(): ClayComponentInfo[] {
  const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-uri]')).filter(
    (el) => el !== document.documentElement
  );

  return elements.map((element) => {
    const uri = element.getAttribute('data-uri') ?? '';
    return {
      uri,
      name: getComponentNameFromUri(uri),
      displayName: getDisplayName(uri),
      instance: getInstance(uri),
      element,
      depth: computeDepth(element),
    };
  });
}

function getComponentNameFromUri(uri: string): string {
  const match = /_components\/([^/.]+)/.exec(uri);
  return match?.[1] ?? 'unknown';
}

function computeDepth(element: HTMLElement): number {
  let depth = 0;
  let parent = element.parentElement;
  while (parent && parent !== document.documentElement) {
    if (parent.hasAttribute('data-uri')) depth += 1;
    parent = parent.parentElement;
  }
  return depth;
}

export function getNestingPath(target: HTMLElement): HTMLElement[] {
  const path: HTMLElement[] = [];
  let current: HTMLElement | null = target;
  while (current && current !== document.documentElement) {
    if (current.hasAttribute('data-uri') && current !== target) {
      path.unshift(current);
    }
    current = current.parentElement;
  }
  return path;
}

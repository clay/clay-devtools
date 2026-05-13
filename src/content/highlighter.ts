/**
 * Manages outline highlighting for Clay components in the host page.
 * Uses a single style element scoped via data-attribute selectors so we never
 * mutate inline styles on host elements.
 */
const STYLE_ID = 'clay-slip-highlight-styles';
const HIGHLIGHT_ATTR = 'data-clay-slip-color';
const SELECTED_ATTR = 'data-clay-slip-selected';
const HOVER_ATTR = 'data-clay-slip-hover';

const PALETTE = [
  { color: '#dda1a1', style: 'solid', width: 2 },
  { color: '#dddda1', style: 'dashed', width: 3 },
  { color: '#b0dda1', style: 'dotted', width: 4 },
  { color: '#a1dddd', style: 'solid', width: 5 },
  { color: '#a1a1dd', style: 'dashed', width: 4 },
  { color: '#dda0dd', style: 'double', width: 4 },
];

export function installHighlightStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildStyleSheet();
  document.head.appendChild(style);
}

function buildStyleSheet(): string {
  const colorRules = PALETTE.map(
    (p, i) =>
      `[${HIGHLIGHT_ATTR}="${i}"]{outline:${p.width}px ${p.style} ${p.color} !important;outline-offset:-${p.width}px !important;}`
  ).join('\n');

  return `
    ${colorRules}
    [${HOVER_ATTR}]{outline:3px solid #ffaf3a !important;outline-offset:-3px !important;}
    [${SELECTED_ATTR}]{outline:5px solid #e22c2c !important;outline-offset:-5px !important;}
  `;
}

export function applyHighlights(elements: HTMLElement[]): void {
  let lastParent: ParentNode | null = null;
  let colorIdx = 0;
  for (const el of elements) {
    if (lastParent && el.parentNode !== lastParent) {
      colorIdx = (colorIdx + 1) % PALETTE.length;
    }
    el.setAttribute(HIGHLIGHT_ATTR, String(colorIdx));
    lastParent = el.parentNode;
  }
}

export function clearHighlights(elements: HTMLElement[]): void {
  for (const el of elements) {
    el.removeAttribute(HIGHLIGHT_ATTR);
    el.removeAttribute(SELECTED_ATTR);
    el.removeAttribute(HOVER_ATTR);
  }
}

export function setSelected(prev: HTMLElement | null, next: HTMLElement | null): void {
  if (prev) prev.removeAttribute(SELECTED_ATTR);
  if (next) next.setAttribute(SELECTED_ATTR, '');
}

export function setHovered(prev: HTMLElement | null, next: HTMLElement | null): void {
  if (prev) prev.removeAttribute(HOVER_ATTR);
  if (next) next.setAttribute(HOVER_ATTR, '');
}

export function setHighlightingEnabled(enabled: boolean): void {
  const style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) return;
  style.disabled = !enabled;
}

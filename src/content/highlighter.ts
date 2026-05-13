/**
 * Manages outline highlighting for Clay components in the host page.
 * Uses a single style element scoped via data-attribute selectors so we never
 * mutate inline styles on host elements.
 */
const STYLE_ID = 'clay-slip-highlight-styles';
const HIGHLIGHT_ATTR = 'data-clay-slip-color';
const SELECTED_ATTR = 'data-clay-slip-selected';
const HOVER_ATTR = 'data-clay-slip-hover';
const OPACITY_VAR = '--clay-slip-outline-opacity';
const DEFAULT_OPACITY = 0.85;

interface PaletteEntry {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly style: string;
  readonly width: number;
}

const PALETTE: ReadonlyArray<PaletteEntry> = [
  { r: 221, g: 161, b: 161, style: 'solid', width: 2 },
  { r: 221, g: 221, b: 161, style: 'dashed', width: 3 },
  { r: 176, g: 221, b: 161, style: 'dotted', width: 4 },
  { r: 161, g: 221, b: 221, style: 'solid', width: 5 },
  { r: 161, g: 161, b: 221, style: 'dashed', width: 4 },
  { r: 221, g: 160, b: 221, style: 'double', width: 4 },
];

export function installHighlightStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildStyleSheet();
  document.head.appendChild(style);
  setHighlightOpacity(DEFAULT_OPACITY);
}

function buildStyleSheet(): string {
  const colorRules = PALETTE.map(
    (p, i) =>
      `[${HIGHLIGHT_ATTR}="${i}"]{outline:${p.width}px ${p.style} rgba(${p.r},${p.g},${p.b},var(${OPACITY_VAR},${DEFAULT_OPACITY})) !important;outline-offset:-${p.width}px !important;}`
  ).join('\n');

  return `
    ${colorRules}
    [${HOVER_ATTR}]{outline:3px solid rgba(255,175,58,var(${OPACITY_VAR},${DEFAULT_OPACITY})) !important;outline-offset:-3px !important;}
    [${SELECTED_ATTR}]{outline:5px solid rgba(226,44,44,var(${OPACITY_VAR},${DEFAULT_OPACITY})) !important;outline-offset:-5px !important;}
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

export function setHighlightOpacity(opacity: number): void {
  const clamped = Math.max(0, Math.min(1, opacity));
  document.documentElement.style.setProperty(OPACITY_VAR, String(clamped));
}

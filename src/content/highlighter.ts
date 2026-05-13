/**
 * Manages the visual outlines Clay Slip paints over host-page components.
 *
 * Design rules — read first
 * -------------------------
 * 1. **Outline only.** We never set background, border, or position on host
 *    elements except via two pseudo-elements (annotation dot + selection
 *    label badge), each gated behind a tiny `position: relative` opt-in. CSS
 *    `outline` is layout-neutral and overrides cleanly with `!important`.
 *
 * 2. **One accent color.** Old versions used a six-color rainbow keyed off a
 *    component's sibling order. It looked busy and carried no real meaning
 *    (siblings aren't more or less important than each other). The only
 *    thing the highlight needs to communicate is **state**:
 *      ambient    – "this is a Clay component"
 *      hover      – "this is what you'd select right now"
 *      selected   – "this is what the panel is currently inspecting"
 *    State is encoded with width + opacity of a single accent, not with hue.
 *
 * 3. **Mode-gated ambient.** The "every component outlined all the time"
 *    look turns the page into caution-tape soup on busy layouts. We default
 *    to `selection` mode, where ambient outlines are off entirely. The user
 *    opts up to `editable` (only `[data-editable]`) or `all` (every
 *    component) when they want the bird's-eye view.
 *
 * 4. **Z-order budget.** All highlight effects live near the top of the
 *    z-axis (just below the panel itself). We use 2147483645/6 — one short
 *    of the int max — so panel UI can still sit on top with 2147483647.
 */
import type { HighlightMode } from '@/lib/types';

const STYLE_ID = 'clay-slip-highlight-styles';

const HIGHLIGHT_ATTR = 'data-clay-slip-color';
const SELECTED_ATTR = 'data-clay-slip-selected';
const HOVER_ATTR = 'data-clay-slip-hover';
const ANNOTATED_ATTR = 'data-clay-slip-annotated';
const MATCH_ATTR = 'data-clay-slip-match';
const FILTER_MODE_ATTR = 'data-clay-slip-filtering';
const LABEL_ATTR = 'data-clay-slip-label';
const MODE_ATTR = 'data-clay-slip-mode';

const OPACITY_VAR = '--clay-slip-outline-opacity';
const DEFAULT_OPACITY = 0.85;

/**
 * Single accent color for ambient/hover/selected outlines.
 * Picked to be readable against both light and dark editorial designs and
 * to *not* visually clash with typical brand reds, magentas, or oranges (the
 * colors most likely to appear in a Clay site's content). RGB triple is
 * inlined into rgba() expressions since CSS `outline` only takes a single
 * color and we vary opacity per state.
 */
const ACCENT_RGB = '37, 99, 235'; // tailwind blue-600

/** Element width/opacity tokens per state. Tweak these together. */
const TOKENS = {
  ambient: { width: 1, alpha: 0.18, offset: -1 },
  hover: { width: 2, alpha: 0.7, offset: -2 },
  selected: { width: 2, alpha: 1, offset: -2 },
  match: { width: 2, alpha: 0.95, offset: -2 },
} as const;

export function installHighlightStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildStyleSheet();
  document.head.appendChild(style);
  setHighlightOpacity(DEFAULT_OPACITY);
  // Keep the previously-active mode if one was set before mount; otherwise
  // start in 'selection' mode (also the prefs default), which keeps the page
  // pristine until the user opts up.
  if (!document.documentElement.hasAttribute(MODE_ATTR)) {
    setHighlightMode('selection');
  }
}

function buildStyleSheet(): string {
  // We use the var() for opacity so the user's "intensity" slider can scale
  // every outline at once without re-emitting the stylesheet.
  const o = (alpha: number) =>
    `rgba(${ACCENT_RGB}, calc(${alpha} * var(${OPACITY_VAR}, ${DEFAULT_OPACITY})))`;

  return `
    /* ── Ambient outlines: gated by html[data-clay-slip-mode] ────────────
       Mode 'all'      → every [data-uri] gets a 1px ghost outline.
       Mode 'editable' → only [data-editable] does.
       Mode 'selection' or 'off' → no rule matches; nothing painted. */
    html[${MODE_ATTR}="all"] [${HIGHLIGHT_ATTR}],
    html[${MODE_ATTR}="editable"] [${HIGHLIGHT_ATTR}][data-editable] {
      outline: ${TOKENS.ambient.width}px solid ${o(TOKENS.ambient.alpha)} !important;
      outline-offset: ${TOKENS.ambient.offset}px !important;
    }

    /* Hover and selection always render regardless of mode (otherwise
       click-to-inspect would be invisible in 'off'). */
    [${HOVER_ATTR}] {
      outline: ${TOKENS.hover.width}px solid ${o(TOKENS.hover.alpha)} !important;
      outline-offset: ${TOKENS.hover.offset}px !important;
    }

    [${SELECTED_ATTR}] {
      outline: ${TOKENS.selected.width}px solid ${o(TOKENS.selected.alpha)} !important;
      outline-offset: ${TOKENS.selected.offset}px !important;
      position: relative;
    }

    /* Selection label — a small pill in the top-left of the selected box
       reading the component name from the data-clay-slip-label attribute.
       Sits *outside* the box when there's room above it, otherwise tucks
       inside via translateY(0). The negative-then-clamp trick keeps the
       label visible at the very top of the page where translateY(-100%)
       would scroll out of view. */
    [${SELECTED_ATTR}][${LABEL_ATTR}]::before {
      content: attr(${LABEL_ATTR});
      position: absolute;
      top: 0;
      left: 0;
      transform: translateY(-100%);
      background: rgb(${ACCENT_RGB});
      color: #ffffff;
      font: 500 11px/1.4 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      padding: 2px 6px;
      border-radius: 3px 3px 3px 0;
      white-space: nowrap;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
      z-index: 2147483646;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    }

    /* Annotation dot — kept from the previous iteration, retuned to amber
       so it doesn't blend with the new blue accent. */
    [${ANNOTATED_ATTR}] { position: relative; }
    [${ANNOTATED_ATTR}]::after {
      content: "";
      position: absolute;
      top: 4px;
      right: 4px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(245, 158, 11, 0.95);
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85);
      pointer-events: none;
      z-index: 2147483646;
    }

    /* Find-on-page filter mode: dim non-matches, highlight matches. Match
       outline uses an emerald green so it reads as a *different signal*
       than the regular accent. */
    html[${FILTER_MODE_ATTR}] [data-uri]:not([${MATCH_ATTR}]) {
      opacity: 0.25 !important;
      transition: opacity 0.12s;
    }
    [${MATCH_ATTR}] {
      outline: ${TOKENS.match.width}px solid
        rgba(34, 197, 94, calc(${TOKENS.match.alpha} * var(${OPACITY_VAR}, ${DEFAULT_OPACITY}))) !important;
      outline-offset: ${TOKENS.match.offset}px !important;
    }
  `;
}

/**
 * Tag every component element so the ambient + state CSS selectors have
 * something to target. Also stashes a human-readable label on the element
 * so the selection badge can read it via `attr()`.
 *
 * The previous implementation also encoded a per-sibling color index here.
 * That was the source of the rainbow look and we drop it — `[data-clay-slip-color]`
 * is now just a presence flag.
 */
export function applyHighlights(
  elements: readonly HTMLElement[],
  labels?: readonly string[]
): void {
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el) continue;
    el.setAttribute(HIGHLIGHT_ATTR, '');
    const label = labels?.[i];
    if (label) el.setAttribute(LABEL_ATTR, label);
  }
}

export function clearHighlights(elements: readonly HTMLElement[]): void {
  for (const el of elements) {
    el.removeAttribute(HIGHLIGHT_ATTR);
    el.removeAttribute(SELECTED_ATTR);
    el.removeAttribute(HOVER_ATTR);
    el.removeAttribute(ANNOTATED_ATTR);
    el.removeAttribute(MATCH_ATTR);
    el.removeAttribute(LABEL_ATTR);
  }
  document.documentElement.removeAttribute(FILTER_MODE_ATTR);
}

export function setSelected(prev: HTMLElement | null, next: HTMLElement | null): void {
  if (prev) prev.removeAttribute(SELECTED_ATTR);
  if (next) next.setAttribute(SELECTED_ATTR, '');
}

export function setHovered(prev: HTMLElement | null, next: HTMLElement | null): void {
  if (prev) prev.removeAttribute(HOVER_ATTR);
  if (next) next.setAttribute(HOVER_ATTR, '');
}

/**
 * Switch the global ambient-outline mode by flipping a single attribute on
 * `<html>`. The attribute is the join key the stylesheet uses for its mode
 * gating, so this is the only function that needs to run when mode changes.
 *
 * `'off'` removes the attribute entirely so nothing matches the ambient
 * rule — slightly cheaper than carrying an explicit `[mode="off"]` selector
 * around, and means no ambient rule can ever fire by accident.
 */
export function setHighlightMode(mode: HighlightMode): void {
  if (mode === 'off') {
    document.documentElement.setAttribute(MODE_ATTR, 'off');
  } else {
    document.documentElement.setAttribute(MODE_ATTR, mode);
  }
}

export function getHighlightMode(): HighlightMode {
  const attr = document.documentElement.getAttribute(MODE_ATTR);
  if (attr === 'off' || attr === 'selection' || attr === 'editable' || attr === 'all') {
    return attr;
  }
  return 'selection';
}

export function setHighlightOpacity(opacity: number): void {
  const clamped = Math.max(0, Math.min(1, opacity));
  document.documentElement.style.setProperty(OPACITY_VAR, String(clamped));
}

export function setAnnotatedUris(allElements: HTMLElement[], annotatedUris: Set<string>): void {
  for (const el of allElements) {
    const uri = el.getAttribute('data-uri');
    if (uri && annotatedUris.has(uri)) el.setAttribute(ANNOTATED_ATTR, '');
    else el.removeAttribute(ANNOTATED_ATTR);
  }
}

export function setFindMatches(
  allElements: HTMLElement[],
  matchSet: Set<HTMLElement> | null
): void {
  if (!matchSet || matchSet.size === 0) {
    document.documentElement.removeAttribute(FILTER_MODE_ATTR);
    for (const el of allElements) el.removeAttribute(MATCH_ATTR);
    return;
  }
  document.documentElement.setAttribute(FILTER_MODE_ATTR, '');
  for (const el of allElements) {
    if (matchSet.has(el)) el.setAttribute(MATCH_ATTR, '');
    else el.removeAttribute(MATCH_ATTR);
  }
}

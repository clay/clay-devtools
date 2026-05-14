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
/**
 * Toggled on `<html>` while the user holds the reveal modifier (Alt/Option).
 * `mode='all'` is gated on this attribute so the page reads as pristine
 * during normal use and only "lights up" the full structure on demand.
 *
 * Naming is deliberately neutral (`reveal`, not `alt`) so we can later
 * support other triggers — a sticky toolbar toggle, a click on the mode
 * pill, etc. — without renaming attributes the stylesheet depends on.
 */
const REVEAL_ATTR = 'data-clay-slip-reveal';

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

/**
 * Element width/opacity tokens per state. Tweak these together.
 *
 * - `hover` / `selected` / `match` use CSS `outline` for full-perimeter
 *   prominence — these are *interaction* signals and need to read from
 *   across the page.
 * - `ambient.tick` is the length (CSS px) of each corner-accent arm
 *   used by the ambient (mode='all' / 'editable') rendering. Short
 *   enough to feel like a hint on large components, long enough to
 *   register on small ones.
 * - `ambient.alpha` is higher than the previous full-outline value
 *   (was 0.18) because there are far fewer pixels carrying the signal
 *   — four short L-shapes total, not a continuous border.
 */
const TOKENS = {
  ambient: { tick: 8, alpha: 0.55 },
  hover: { width: 2, alpha: 0.7, offset: -2 },
  // `fillAlpha` drives the inset blue tint that makes "selected" visually
  // distinct from "hovered" — hover is outline-only, selected is outline
  // + filled background. Tuned to 0.08 so it reads as "active item" without
  // overpowering the host page's content underneath.
  selected: { width: 2, alpha: 1, offset: -2, fillAlpha: 0.08 },
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

  // Ambient color (used inside the linear-gradient stops below).
  const ambient = o(TOKENS.ambient.alpha);
  const tick = `${TOKENS.ambient.tick}px`;

  return `
    /* ── Ambient corner ticks ────────────────────────────────────────────
       Four short L-shaped accents at each corner. Trade-offs:
       - Way less visual mass than a full perimeter outline: nested
         components no longer create stacks of parallel lines at shared
         edges; reads as "this is a discrete thing" without drawing a
         box around the content.
       - Hover (2px @ 70%) and selection (2px @ 100%) stay visually
         dominant by comparison — exactly what you want during inspection.

       Mode gating:
         'selection' → corner ticks ON DEMAND only, gated by the reveal
                       modifier (Alt/Option). Selection mode is the
                       daily-driver default: the page is pristine, hover
                       and click work normally, and ⌥ is the "peek at
                       all components for a moment" gesture.
         'all'       → corner ticks ALWAYS ON for every component. The
                       "give me the bird's-eye view" mode.
         'editable'  → corner ticks ALWAYS ON for [data-editable] only.
                       Explicit "show me what's editable" affordance.
         'off'       → no rule matches, nothing painted at all.

       The :not() chain keeps the corner ticks from competing with the
       richer hover/selected outlines: while you're inspecting, only the
       inspected element's outline lights up. */
    html[${MODE_ATTR}="selection"][${REVEAL_ATTR}] [${HIGHLIGHT_ATTR}]:not([${HOVER_ATTR}]):not([${SELECTED_ATTR}]),
    html[${MODE_ATTR}="all"] [${HIGHLIGHT_ATTR}]:not([${HOVER_ATTR}]):not([${SELECTED_ATTR}]),
    html[${MODE_ATTR}="editable"] [${HIGHLIGHT_ATTR}][data-editable]:not([${HOVER_ATTR}]):not([${SELECTED_ATTR}]) {
      /* Establish a positioning context for the ::before pseudo. We omit
         !important so we never fight a host's own positioning rule — if
         the host already has position: relative/absolute/fixed/sticky,
         the pseudo positions against that, which is exactly right. The
         only failure mode is: host uses position:static AND has an
         absolute-positioned descendant currently positioning against a
         farther ancestor (it would reparent to this component). For
         mode='selection' the rule is reveal-gated, so this only applies
         while ⌥ is held. */
      position: relative;
    }

    html[${MODE_ATTR}="selection"][${REVEAL_ATTR}] [${HIGHLIGHT_ATTR}]:not([${HOVER_ATTR}]):not([${SELECTED_ATTR}])::before,
    html[${MODE_ATTR}="all"] [${HIGHLIGHT_ATTR}]:not([${HOVER_ATTR}]):not([${SELECTED_ATTR}])::before,
    html[${MODE_ATTR}="editable"] [${HIGHLIGHT_ATTR}][data-editable]:not([${HOVER_ATTR}]):not([${SELECTED_ATTR}])::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      /* One below the selection label badge (2147483646) so the badge
         always wins when both might paint. */
      z-index: 2147483645;
      /* Eight tiny gradients, one per arm of each corner L. Each arm is
         ${tick} long × 1px thick. background-size + background-position
         keep them anchored at the four corners regardless of element size. */
      background:
        /* top-left horizontal */
        linear-gradient(${ambient}, ${ambient}) 0 0 / ${tick} 1px no-repeat,
        /* top-left vertical */
        linear-gradient(${ambient}, ${ambient}) 0 0 / 1px ${tick} no-repeat,
        /* top-right horizontal */
        linear-gradient(${ambient}, ${ambient}) 100% 0 / ${tick} 1px no-repeat,
        /* top-right vertical */
        linear-gradient(${ambient}, ${ambient}) 100% 0 / 1px ${tick} no-repeat,
        /* bottom-left horizontal */
        linear-gradient(${ambient}, ${ambient}) 0 100% / ${tick} 1px no-repeat,
        /* bottom-left vertical */
        linear-gradient(${ambient}, ${ambient}) 0 100% / 1px ${tick} no-repeat,
        /* bottom-right horizontal */
        linear-gradient(${ambient}, ${ambient}) 100% 100% / ${tick} 1px no-repeat,
        /* bottom-right vertical */
        linear-gradient(${ambient}, ${ambient}) 100% 100% / 1px ${tick} no-repeat;
    }

    /* Hover and selection always render regardless of mode (otherwise
       click-to-inspect would be invisible in 'off'). Both also need
       position: relative so the label-badge ::before can anchor. */
    [${HOVER_ATTR}] {
      outline: ${TOKENS.hover.width}px solid ${o(TOKENS.hover.alpha)} !important;
      outline-offset: ${TOKENS.hover.offset}px !important;
      position: relative;
    }

    /* Selected = hover's outline + a subtle accent-tinted fill. The
       fill is what gives the click "I clicked it" feedback that hover
       alone can't, since hover and selected outlines are otherwise
       visually similar (2px solid blue, 70% vs 100% opacity). The inset
       tint is implemented via box-shadow with a giant spread so it
       fills the box without affecting layout and without needing
       another pseudo-element (::before is the label badge, ::after is
       the annotation dot). 8% opacity is heavy enough to clearly read
       as "this is the active item" the way macOS Finder + GitHub file
       browser highlight rows, light enough that text/imagery underneath
       stays fully legible. */
    [${SELECTED_ATTR}] {
      outline: ${TOKENS.selected.width}px solid ${o(TOKENS.selected.alpha)} !important;
      outline-offset: ${TOKENS.selected.offset}px !important;
      position: relative;
      box-shadow: inset 0 0 0 9999px ${o(TOKENS.selected.fillAlpha)} !important;
    }

    /* Component-name label — a small pill in the top-left reading the
       component name from data-clay-slip-label. Renders for BOTH hover
       and selected so users always know what they're pointing at, not
       just what they've clicked. Both selectors target ::before (CSS
       only allows one); when an element is both hovered and selected
       they paint identically so there's no flicker.

       Sits *outside* the box when there's room above it, otherwise tucks
       inside via translateY(0). The negative-then-clamp trick keeps the
       label visible at the very top of the page where translateY(-100%)
       would scroll out of view. */
    [${HOVER_ATTR}][${LABEL_ATTR}]::before,
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

/**
 * Toggle the "reveal" attribute on `<html>`. When set, mode='all' lights up
 * every component's corner ticks; when removed, mode='all' is visually
 * identical to mode='selection' (pristine ambient).
 *
 * Idempotent so the keydown auto-repeat that fires while a key is held
 * doesn't churn the DOM.
 */
export function setReveal(on: boolean): void {
  const html = document.documentElement;
  if (on) {
    if (!html.hasAttribute(REVEAL_ATTR)) html.setAttribute(REVEAL_ATTR, '');
  } else {
    if (html.hasAttribute(REVEAL_ATTR)) html.removeAttribute(REVEAL_ATTR);
  }
}

export function getReveal(): boolean {
  return document.documentElement.hasAttribute(REVEAL_ATTR);
}

/**
 * Wire the reveal modifier (Alt / Option) to {@link setReveal}. Only takes
 * effect while the active highlight mode is 'selection' — that's the
 * daily-driver mode where the page is pristine and the user occasionally
 * wants a quick spatial overview of where every component lives. Other
 * modes have deterministic ambient behavior already (always-on for 'all'
 * and 'editable'; nothing for 'off'), so the modifier would be a no-op.
 *
 * We still install the listener once globally; the mode check happens
 * per-event so switching modes doesn't require teardown.
 *
 * Edge cases handled:
 * - **Auto-repeat** while ⌥ is held: `setReveal(true)` is idempotent, no
 *   DOM churn.
 * - **Window blur** (alt-tab, command-tab, focus to devtools) while ⌥ is
 *   held: `keyup` never fires in the original window, so the reveal would
 *   be stuck on. The blur handler clears it.
 * - **Page visibility change** (background tab woken up): clear, same
 *   reasoning as blur.
 * - **macOS Option for special characters**: typing in an input while
 *   holding ⌥ would briefly flash the reveal. We skip the reveal when
 *   the active element is editable to avoid the flash during typing.
 *
 * @returns Cleanup function that removes the listeners.
 */
export function installAltRevealListener(
  getMode: () => HighlightMode = getHighlightMode
): () => void {
  const isEditableTarget = (): boolean => {
    const ae = document.activeElement as HTMLElement | null;
    if (!ae) return false;
    if (ae.isContentEditable) return true;
    const tag = ae.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // `e.key === 'Alt'` covers both Windows/Linux Alt and macOS Option.
    // We *don't* trigger on `e.altKey` for arbitrary keys — that would
    // fire on every Alt+letter shortcut and feel jumpy.
    if (e.key !== 'Alt') return;
    if (getMode() !== 'selection') return;
    if (isEditableTarget()) return;
    setReveal(true);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key !== 'Alt') return;
    setReveal(false);
  };

  const onBlur = () => setReveal(false);
  const onVisibility = () => {
    if (document.hidden) setReveal(false);
  };

  // `capture: true` so the listener still sees the event even if a host
  // page calls stopPropagation on its own keyboard handlers. The reveal
  // is a peek, not an interaction — it should always work.
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibility);
    setReveal(false);
  };
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

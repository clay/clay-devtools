/**
 * Behavioral tests for the highlighter.
 *
 * The highlighter is mostly CSS, so most of these assertions check the
 * *attributes* it sets (which the stylesheet keys off of) rather than
 * computed style — happy-dom doesn't run our `!important` outline rules
 * through a real layout engine, so testing computed style would be flaky.
 *
 * What we DO test:
 *   - applyHighlights tags every element with the presence flag
 *   - applyHighlights stashes the label for the selection badge to read
 *   - clearHighlights wipes every highlight attribute we set
 *   - setHighlightMode flips the documentElement attribute the CSS keys on
 *   - setHovered / setSelected toggle exactly one element at a time
 *   - setAnnotatedUris syncs based on the URI set, not element identity
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyHighlights,
  clearHighlights,
  getHighlightMode,
  getReveal,
  installAltRevealListener,
  installHighlightStyles,
  setAnnotatedUris,
  setHighlightMode,
  setHighlightOpacity,
  setHovered,
  setReveal,
  setSelected,
} from '@/content/highlighter';

const HIGHLIGHT_ATTR = 'data-clay-slip-color';
const COLOR_IDX_ATTR = 'data-clay-slip-color-idx';
const SELECTED_ATTR = 'data-clay-slip-selected';
const HOVER_ATTR = 'data-clay-slip-hover';
const ANNOTATED_ATTR = 'data-clay-slip-annotated';
const LABEL_ATTR = 'data-clay-slip-label';
const MODE_ATTR = 'data-clay-slip-mode';
const REVEAL_ATTR = 'data-clay-slip-reveal';

function makeComponent(uri: string, opts: { editable?: boolean } = {}): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-uri', uri);
  if (opts.editable) el.setAttribute('data-editable', '');
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute(MODE_ATTR);
  document.documentElement.removeAttribute(REVEAL_ATTR);
  document.documentElement.style.cssText = '';
});

afterEach(() => {
  // Tear down any styles we installed so each test starts fresh.
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute(MODE_ATTR);
});

describe('installHighlightStyles', () => {
  it('inserts a single style tag and is idempotent', () => {
    installHighlightStyles();
    installHighlightStyles();
    installHighlightStyles();
    expect(document.querySelectorAll('#clay-slip-highlight-styles')).toHaveLength(1);
  });

  it('starts in selection mode when no mode was previously set', () => {
    installHighlightStyles();
    expect(document.documentElement.getAttribute(MODE_ATTR)).toBe('selection');
  });

  it('preserves a pre-existing mode (so reinstall does not stomp the user choice)', () => {
    setHighlightMode('all');
    installHighlightStyles();
    expect(document.documentElement.getAttribute(MODE_ATTR)).toBe('all');
  });
});

describe('applyHighlights', () => {
  // Every element-writing helper is gated on the stylesheet being installed
  // (see "passive mode" describe at the bottom of this file). Active-mode
  // tests therefore install up front so the helpers actually paint.
  beforeEach(() => {
    installHighlightStyles();
  });

  it('tags every element with the presence flag', () => {
    const a = makeComponent('a');
    const b = makeComponent('b');
    applyHighlights([a, b]);
    expect(a.hasAttribute(HIGHLIGHT_ATTR)).toBe(true);
    expect(b.hasAttribute(HIGHLIGHT_ATTR)).toBe(true);
  });

  it('cycles the color-index attribute by document position (drives the rainbow)', () => {
    // Seven elements verify: indices 0..5 are unique, then 6 wraps back
    // to 0. The rainbow CSS keys off this exact attribute, so cycling
    // is the contract — a regression here would break the bird's-eye
    // visual map in 'all' mode and the ⌥-peek in 'selection' mode.
    const els = Array.from({ length: 7 }, (_, i) => makeComponent(`c${i}`));
    applyHighlights(els);
    expect(els.map((e) => e.getAttribute(COLOR_IDX_ATTR))).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '0',
    ]);
  });

  it('writes labels in the same index as the element array', () => {
    const a = makeComponent('a');
    const b = makeComponent('b');
    applyHighlights([a, b], ['Header', 'Story Tile']);
    expect(a.getAttribute(LABEL_ATTR)).toBe('Header');
    expect(b.getAttribute(LABEL_ATTR)).toBe('Story Tile');
  });

  it('skips the label attribute when no label is given', () => {
    const a = makeComponent('a');
    applyHighlights([a]);
    expect(a.hasAttribute(LABEL_ATTR)).toBe(false);
  });

  it('does not write a label when the entry is empty string', () => {
    // Useful invariant — the CSS uses `[selected][label]` to gate the badge,
    // so an empty-string label would still match the selector and render
    // an empty pill. We require non-empty.
    const a = makeComponent('a');
    applyHighlights([a], ['']);
    expect(a.hasAttribute(LABEL_ATTR)).toBe(false);
  });
});

describe('clearHighlights', () => {
  beforeEach(() => {
    installHighlightStyles();
  });

  it('removes every highlight-related attribute', () => {
    const a = makeComponent('a');
    applyHighlights([a], ['Header']);
    setSelected(null, a);
    setHovered(null, a);
    a.setAttribute(ANNOTATED_ATTR, '');
    clearHighlights([a]);
    expect(a.hasAttribute(HIGHLIGHT_ATTR)).toBe(false);
    expect(a.hasAttribute(COLOR_IDX_ATTR)).toBe(false);
    expect(a.hasAttribute(SELECTED_ATTR)).toBe(false);
    expect(a.hasAttribute(HOVER_ATTR)).toBe(false);
    expect(a.hasAttribute(ANNOTATED_ATTR)).toBe(false);
    expect(a.hasAttribute(LABEL_ATTR)).toBe(false);
  });
});

describe('setHighlightMode / getHighlightMode', () => {
  it('round-trips each valid mode', () => {
    for (const m of ['off', 'selection', 'editable', 'all'] as const) {
      setHighlightMode(m);
      expect(getHighlightMode()).toBe(m);
    }
  });

  it('falls back to selection when the attribute is absent or garbage', () => {
    expect(getHighlightMode()).toBe('selection');
    document.documentElement.setAttribute(MODE_ATTR, 'wat');
    expect(getHighlightMode()).toBe('selection');
  });

  it('writes "off" as an explicit value (not removed) so the stylesheet can target it', () => {
    // The current CSS only matches positive modes ("all", "editable"), so an
    // absent attribute would also work — but writing "off" explicitly keeps
    // the option open to add an `[mode="off"]` rule later (e.g. for diagnostics).
    setHighlightMode('off');
    expect(document.documentElement.getAttribute(MODE_ATTR)).toBe('off');
  });
});

describe('setSelected / setHovered', () => {
  beforeEach(() => {
    installHighlightStyles();
  });

  it('moves the selected attribute from prev to next', () => {
    const a = makeComponent('a');
    const b = makeComponent('b');
    setSelected(null, a);
    expect(a.hasAttribute(SELECTED_ATTR)).toBe(true);
    setSelected(a, b);
    expect(a.hasAttribute(SELECTED_ATTR)).toBe(false);
    expect(b.hasAttribute(SELECTED_ATTR)).toBe(true);
  });

  it('moves the hover attribute from prev to next', () => {
    const a = makeComponent('a');
    const b = makeComponent('b');
    setHovered(null, a);
    setHovered(a, b);
    expect(a.hasAttribute(HOVER_ATTR)).toBe(false);
    expect(b.hasAttribute(HOVER_ATTR)).toBe(true);
  });

  it('clears with a null next value', () => {
    const a = makeComponent('a');
    setSelected(null, a);
    setSelected(a, null);
    expect(a.hasAttribute(SELECTED_ATTR)).toBe(false);
  });
});

describe('setAnnotatedUris', () => {
  beforeEach(() => {
    installHighlightStyles();
  });

  it('only flags elements whose URI is in the set', () => {
    const a = makeComponent('a');
    const b = makeComponent('b');
    const c = makeComponent('c');
    setAnnotatedUris([a, b, c], new Set(['a', 'c']));
    expect(a.hasAttribute(ANNOTATED_ATTR)).toBe(true);
    expect(b.hasAttribute(ANNOTATED_ATTR)).toBe(false);
    expect(c.hasAttribute(ANNOTATED_ATTR)).toBe(true);
  });

  it('removes the flag when the URI drops out of the set', () => {
    const a = makeComponent('a');
    setAnnotatedUris([a], new Set(['a']));
    setAnnotatedUris([a], new Set());
    expect(a.hasAttribute(ANNOTATED_ATTR)).toBe(false);
  });
});

describe('setHighlightOpacity', () => {
  it('clamps to [0, 1] so a slider bug cannot push outlines off-screen', () => {
    setHighlightOpacity(-5);
    expect(document.documentElement.style.getPropertyValue('--clay-slip-outline-opacity')).toBe(
      '0'
    );
    setHighlightOpacity(99);
    expect(document.documentElement.style.getPropertyValue('--clay-slip-outline-opacity')).toBe(
      '1'
    );
    setHighlightOpacity(0.42);
    expect(document.documentElement.style.getPropertyValue('--clay-slip-outline-opacity')).toBe(
      '0.42'
    );
  });
});

describe('ambient stylesheet (mode gating + rainbow contract)', () => {
  // The four modes map to three rendering behaviors now:
  //   - 'selection' → reveal-gated rainbow (pristine until ⌥ is held).
  //   - 'all'       → always-on rainbow on every component.
  //   - 'editable'  → always-on subtle corner accents on [data-editable].
  //   - 'off'       → no rule matches; nothing painted.
  // The rainbow is six per-color outline rules cycled by
  // [data-clay-slip-color-idx="0..5"]. The corner ticks (editable only)
  // still use a ::before pseudo. We lock both shapes in as separate
  // assertions so any future stylesheet edit that breaks the visual
  // handoff fails loudly.
  function getStylesheetText(): string {
    installHighlightStyles();
    return document.getElementById('clay-slip-highlight-styles')?.textContent ?? '';
  }

  it("renders rainbow outlines (one rule per palette color) for mode='all' and mode='selection'+reveal", () => {
    const css = getStylesheetText();
    // Six color buckets means six outline rules per active mode. Match
    // each [color-idx="N"] selector for both modes.
    for (let idx = 0; idx < 6; idx++) {
      const allRule = new RegExp(
        `html\\[data-clay-slip-mode="all"\\][^{]+\\[data-clay-slip-color-idx="${idx}"\\][^{]+\\{[^}]*outline:`
      );
      const selectionRule = new RegExp(
        `html\\[data-clay-slip-mode="selection"\\]\\[data-clay-slip-reveal\\][^{]+\\[data-clay-slip-color-idx="${idx}"\\][^{]+\\{[^}]*outline:`
      );
      expect(css).toMatch(allRule);
      expect(css).toMatch(selectionRule);
    }
  });

  it("gates mode='selection' rainbow on the reveal attribute (the ⌥-peek behavior)", () => {
    const css = getStylesheetText();
    // Every mode='selection' rainbow selector must require [data-clay-slip-reveal]
    // so the daily-driver mode stays pristine when the user isn't holding ⌥.
    const selectionRainbowRules = css.match(
      /html\[data-clay-slip-mode="selection"\][^{]+\[data-clay-slip-color-idx[^{]+\{/g
    );
    expect(selectionRainbowRules?.length).toBeGreaterThan(0);
    for (const rule of selectionRainbowRules ?? []) {
      expect(rule).toContain('[data-clay-slip-reveal]');
    }
  });

  it("does NOT gate mode='all' rainbow on the reveal attribute (always-on)", () => {
    const css = getStylesheetText();
    const allRainbowRules = css.match(
      /html\[data-clay-slip-mode="all"\][^{]+\[data-clay-slip-color-idx[^{]+\{/g
    );
    expect(allRainbowRules?.length).toBeGreaterThan(0);
    for (const rule of allRainbowRules ?? []) {
      expect(rule).not.toContain('[data-clay-slip-reveal]');
    }
  });

  it("keeps mode='editable' on the subtle corner-tick rendering (::before)", () => {
    const css = getStylesheetText();
    // Editable mode is a focused affordance ("show me what's editable"),
    // not an overview, so it stays on the corner-tick treatment. Verify
    // the ::before rule exists AND that editable does NOT participate
    // in the rainbow rules (those would require a [color-idx] selector).
    const editableCornerRule = css.match(
      /html\[data-clay-slip-mode="editable"\][^{]+\[data-editable\][^{]+::before/
    );
    expect(editableCornerRule).not.toBeNull();
    const editableRainbow = css.match(
      /html\[data-clay-slip-mode="editable"\][^{]+\[data-clay-slip-color-idx[^{]+\{/
    );
    expect(editableRainbow).toBeNull();
  });

  it('emits no ambient rule for off mode', () => {
    const css = getStylesheetText();
    expect(css).not.toMatch(/html\[data-clay-slip-mode="off"\][^{]*\{/);
  });

  it('excludes hovered + selected elements from every ambient rule', () => {
    const css = getStylesheetText();
    // Both the rainbow rules AND the editable corner-tick rule must
    // exclude :hover / :selected so the ambient layer fades out when
    // the user is inspecting an element. Without the exclusion, a
    // selected component would paint both the rainbow and the blue
    // selected outline on top of each other.
    const rainbowRules =
      css.match(
        /html\[data-clay-slip-mode="(?:selection|all)"\][^{]+\[data-clay-slip-color-idx[^{]+\{/g
      ) ?? [];
    const editableRules = css.match(/html\[data-clay-slip-mode="editable"\][^{]+::before/g) ?? [];
    const ambientRules = [...rainbowRules, ...editableRules];
    expect(ambientRules.length).toBeGreaterThan(0);
    for (const rule of ambientRules) {
      expect(rule).toContain(':not([data-clay-slip-hover])');
      expect(rule).toContain(':not([data-clay-slip-selected])');
    }
  });

  it('uses ::before for editable corner ticks so it stays independent of the annotation dot (::after)', () => {
    const css = getStylesheetText();
    expect(css).toContain('data-clay-slip-annotated]::after');
    const editableCornerRule = css.match(/html\[data-clay-slip-mode="editable"\][^{]+::before/);
    expect(editableCornerRule).not.toBeNull();
  });
});

describe('hover + selected stylesheet contract', () => {
  // Hover and selected are the inspection signals — they must always read
  // as "you're pointing at this" and "you clicked this", and the click
  // signal has to be visually distinct from hover. Those two requirements
  // are enforced in CSS, so we lock the contract here.
  function getStylesheetText(): string {
    installHighlightStyles();
    return document.getElementById('clay-slip-highlight-styles')?.textContent ?? '';
  }

  it('renders the component-name label on BOTH hover and selected', () => {
    const css = getStylesheetText();
    // The label badge ::before rule must include both selectors in its
    // selector list. Without the hover half, hovering a non-selected
    // component shows no name — regression we explicitly want to prevent.
    const labelRule = css.match(
      /\[data-clay-slip-(?:hover|selected)\]\[data-clay-slip-label\]::before[^{]*,\s*\[data-clay-slip-(?:hover|selected)\]\[data-clay-slip-label\]::before/
    );
    expect(labelRule).not.toBeNull();
  });

  it("gives 'selected' a distinct fill so it reads differently from 'hover'", () => {
    const css = getStylesheetText();
    // The inset box-shadow is what creates the "you clicked it" surface
    // tint. If somebody removes it, hover and selected become visually
    // near-identical (both 2px solid blue) and the click feedback
    // disappears. Lock the rule shape so that's a deliberate choice,
    // not an accidental edit.
    const selectedRule = css.match(/\[data-clay-slip-selected\]\s*\{[^}]+\}/);
    expect(selectedRule).not.toBeNull();
    expect(selectedRule?.[0]).toContain('box-shadow: inset');
  });

  it("does NOT add the inset fill to the 'hover' rule", () => {
    const css = getStylesheetText();
    // Hover stays outline-only; the inset fill is reserved for selected
    // so the two states stay visually distinct.
    const hoverRule = css.match(/\[data-clay-slip-hover\]\s*\{[^}]+\}/);
    expect(hoverRule).not.toBeNull();
    expect(hoverRule?.[0]).not.toContain('box-shadow: inset');
  });

  it('anchors position: relative on hover too (so the label badge can render)', () => {
    const css = getStylesheetText();
    // ::before with position: absolute needs a positioned ancestor.
    // Selected has had position: relative for ages; hover needs it too
    // now that the label badge follows hover.
    const hoverRule = css.match(/\[data-clay-slip-hover\]\s*\{[^}]+\}/);
    expect(hoverRule?.[0]).toContain('position: relative');
  });
});

describe('setReveal / getReveal', () => {
  it('round-trips the reveal attribute on <html>', () => {
    expect(getReveal()).toBe(false);
    setReveal(true);
    expect(getReveal()).toBe(true);
    expect(document.documentElement.hasAttribute(REVEAL_ATTR)).toBe(true);
    setReveal(false);
    expect(getReveal()).toBe(false);
    expect(document.documentElement.hasAttribute(REVEAL_ATTR)).toBe(false);
  });

  it('is idempotent so keydown auto-repeat does not churn the DOM', () => {
    // Spy on setAttribute. If setReveal(true) blindly set the attr every
    // call, an OS-repeating keydown would hit the DOM dozens of times per
    // second. We want exactly one mutation per state transition.
    const spy = vi.spyOn(document.documentElement, 'setAttribute');
    setReveal(true);
    setReveal(true);
    setReveal(true);
    const setCalls = spy.mock.calls.filter((c) => c[0] === REVEAL_ATTR).length;
    expect(setCalls).toBe(1);
    spy.mockRestore();
  });
});

describe('installAltRevealListener', () => {
  // The peek modifier lives on selection mode now (the daily-driver
  // default). Other modes either have always-on ambient ('all',
  // 'editable') or are intentionally silent ('off'), so the listener
  // must be a no-op outside selection.
  it("toggles reveal on Alt keydown / keyup while mode='selection'", () => {
    setHighlightMode('selection');
    const cleanup = installAltRevealListener();
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
      expect(getReveal()).toBe(true);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }));
      expect(getReveal()).toBe(false);
    } finally {
      cleanup();
    }
  });

  it("does not reveal on Alt while mode is anything other than 'selection'", () => {
    const cleanup = installAltRevealListener();
    try {
      for (const mode of ['off', 'editable', 'all'] as const) {
        setHighlightMode(mode);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
        expect(getReveal()).toBe(false);
      }
    } finally {
      cleanup();
    }
  });

  it('ignores keys other than Alt so Alt+letter shortcuts do not flicker', () => {
    setHighlightMode('selection');
    const cleanup = installAltRevealListener();
    try {
      // altKey true on a non-Alt key (e.g. user pressing Alt+Tab combo,
      // but the key event is for Tab itself). Our listener must key on
      // e.key === 'Alt' specifically.
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', altKey: true }));
      expect(getReveal()).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('clears reveal on window blur (Alt-tab leaves the window with ⌥ held)', () => {
    setHighlightMode('selection');
    const cleanup = installAltRevealListener();
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
      expect(getReveal()).toBe(true);
      window.dispatchEvent(new Event('blur'));
      expect(getReveal()).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('does not flash reveal while typing in an input (Option-letter on macOS)', () => {
    setHighlightMode('selection');
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const cleanup = installAltRevealListener();
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
      // Skipped because the active element is an input — Option-modified
      // typography (é, ø, etc.) shouldn't trigger a peek flash.
      expect(getReveal()).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('cleanup removes the listeners and clears reveal', () => {
    setHighlightMode('selection');
    const cleanup = installAltRevealListener();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
    expect(getReveal()).toBe(true);
    cleanup();
    // After cleanup, reveal is forced off (in case the user uninstalls
    // mid-press) and subsequent keydowns are no-ops.
    expect(getReveal()).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
    expect(getReveal()).toBe(false);
  });
});

describe('mode + editable interaction (CSS gating contract)', () => {
  // The actual visual gating happens in the stylesheet, but we can at least
  // verify the *contract* the CSS depends on:
  //   - 'all' mode: every component carries the presence attr
  //   - 'editable' mode: editable components carry the presence attr AND
  //     the data-editable attr (the CSS combines them)
  //   - 'selection'/'off' modes: the CSS doesn't match; we don't have to
  //     remove the presence flag.
  beforeEach(() => {
    installHighlightStyles();
  });

  it('preserves data-editable attribute through apply + clear cycles', () => {
    const editable = makeComponent('e', { editable: true });
    const plain = makeComponent('p');
    applyHighlights([editable, plain], ['Editable', 'Plain']);
    expect(editable.hasAttribute('data-editable')).toBe(true);
    expect(plain.hasAttribute('data-editable')).toBe(false);

    clearHighlights([editable, plain]);
    // We deliberately do NOT touch data-editable in clearHighlights — that
    // attribute is part of the host page's data contract, not ours.
    expect(editable.hasAttribute('data-editable')).toBe(true);
    expect(plain.hasAttribute('data-editable')).toBe(false);
  });
});

describe('passive mode (highlighter not installed)', () => {
  // Passive mode is the contract `?edit=true` pages depend on: the panel
  // mounts, components are detected, the user can browse the tree and
  // copy URIs — but we never paint on the host page or write any
  // `data-clay-slip-*` attribute to a host element. This is enforced by
  // gating every element-writing helper on the stylesheet's presence
  // (see `isHighlighterInstalled` in highlighter.ts).
  //
  // The global `beforeEach` already wipes the head, so the stylesheet
  // is NOT installed for any test in this block. That's intentional:
  // we want to assert "calling these helpers without installing first
  // is a silent no-op", which is exactly the bootstrap path edit-mode
  // pages take.

  it('applyHighlights writes nothing when the stylesheet is not installed', () => {
    const a = makeComponent('a');
    const b = makeComponent('b');
    applyHighlights([a, b], ['One', 'Two']);
    expect(a.hasAttribute(HIGHLIGHT_ATTR)).toBe(false);
    expect(a.hasAttribute(COLOR_IDX_ATTR)).toBe(false);
    expect(a.hasAttribute(LABEL_ATTR)).toBe(false);
    expect(b.hasAttribute(HIGHLIGHT_ATTR)).toBe(false);
  });

  it('setSelected and setHovered write nothing when the stylesheet is not installed', () => {
    const a = makeComponent('a');
    setSelected(null, a);
    setHovered(null, a);
    expect(a.hasAttribute(SELECTED_ATTR)).toBe(false);
    expect(a.hasAttribute(HOVER_ATTR)).toBe(false);
  });

  it('setAnnotatedUris writes nothing when the stylesheet is not installed', () => {
    const a = makeComponent('a');
    setAnnotatedUris([a], new Set(['a']));
    expect(a.hasAttribute(ANNOTATED_ATTR)).toBe(false);
  });

  it('clearHighlights is a safe no-op when the stylesheet is not installed', () => {
    const a = makeComponent('a');
    // Pre-set a stray attr the way a stale install might have left things;
    // clearHighlights without install must not touch it (we don't own the
    // host DOM in passive mode, even for cleanup).
    a.setAttribute('data-some-host-attr', '');
    expect(() => clearHighlights([a])).not.toThrow();
    expect(a.hasAttribute('data-some-host-attr')).toBe(true);
  });

  it('installing then uninstalling (removing the style tag) flips writes back to no-op', () => {
    // Mirrors what a future "unmount panel" path would do: install,
    // paint, then yank the style element and assert the helpers stop
    // writing. Currently nothing in production removes the stylesheet,
    // but the contract is symmetrical and worth pinning down so we
    // don't regress if/when we add hot-reload-style remounts.
    const a = makeComponent('a');
    installHighlightStyles();
    applyHighlights([a]);
    expect(a.hasAttribute(HIGHLIGHT_ATTR)).toBe(true);

    document.getElementById('clay-slip-highlight-styles')?.remove();
    const b = makeComponent('b');
    applyHighlights([b]);
    expect(b.hasAttribute(HIGHLIGHT_ATTR)).toBe(false);
  });
});

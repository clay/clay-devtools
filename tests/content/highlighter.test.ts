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
  it('tags every element with the presence flag', () => {
    const a = makeComponent('a');
    const b = makeComponent('b');
    applyHighlights([a, b]);
    expect(a.hasAttribute(HIGHLIGHT_ATTR)).toBe(true);
    expect(b.hasAttribute(HIGHLIGHT_ATTR)).toBe(true);
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
  it('removes every highlight-related attribute', () => {
    const a = makeComponent('a');
    applyHighlights([a], ['Header']);
    setSelected(null, a);
    setHovered(null, a);
    a.setAttribute(ANNOTATED_ATTR, '');
    clearHighlights([a]);
    expect(a.hasAttribute(HIGHLIGHT_ATTR)).toBe(false);
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

describe('ambient corner-tick stylesheet (mode=all / editable)', () => {
  // The actual rendering is CSS-only, but the *contract* between the
  // highlighter module and its stylesheet is testable:
  //   1. mode='all' is gated on BOTH the mode attr AND the reveal attr —
  //      the page is pristine until the user holds ⌥. mode='editable' is
  //      intentionally NOT reveal-gated (it's an explicit "show editables"
  //      affordance, not an on-demand peek).
  //   2. The rule must exclude :hover / :selected so the corner ticks don't
  //      compete with the richer hover/selected outlines.
  //   3. The pseudo-element must be ::before (the selection label badge
  //      uses ::before too, but we exclude :selected from the corner-tick
  //      rule so they never collide on the same element).
  // If any of these invariants change without intent, the test fails and
  // forces a deliberate update.
  function getStylesheetText(): string {
    installHighlightStyles();
    return document.getElementById('clay-slip-highlight-styles')?.textContent ?? '';
  }

  it("gates mode='all' corner ticks on the reveal attribute, not just the mode", () => {
    const css = getStylesheetText();
    // Every mode='all' corner-tick selector must require [data-clay-slip-reveal]
    // so the page is pristine when the user is not holding ⌥.
    const allModeRules = css.match(/html\[data-clay-slip-mode="all"\][^{]+::before/g);
    expect(allModeRules?.length).toBeGreaterThan(0);
    for (const rule of allModeRules ?? []) {
      expect(rule).toContain('[data-clay-slip-reveal]');
    }
    // A mode='all' rule without the reveal attr would defeat the whole
    // pristine-by-default behavior, so explicitly assert it never appears.
    expect(css).not.toMatch(/html\[data-clay-slip-mode="all"\] \[/);
  });

  it("does NOT gate mode='editable' on the reveal attribute (always-on for editables)", () => {
    const css = getStylesheetText();
    // The editable selector should NOT include the reveal attribute —
    // editable mode is the "show me what's editable" mode, ambient by design.
    const editableRules = css.match(/html\[data-clay-slip-mode="editable"\][^{]+::before/g);
    expect(editableRules?.length).toBeGreaterThan(0);
    for (const rule of editableRules ?? []) {
      expect(rule).not.toContain('[data-clay-slip-reveal]');
    }
  });

  it('emits no ambient rule for selection or off (regardless of reveal state)', () => {
    const css = getStylesheetText();
    expect(css).not.toMatch(/html\[data-clay-slip-mode="selection"\][^{]*::before/);
    expect(css).not.toMatch(/html\[data-clay-slip-mode="off"\][^{]*::before/);
  });

  it('excludes hovered + selected elements from the corner-tick rule', () => {
    const css = getStylesheetText();
    // Each corner-tick selector must carry both :not() exclusions so the
    // ambient ticks fade out when the user is actually inspecting an
    // element. This is the visual handoff to the hover/selected outlines.
    const cornerTickRules = css.match(
      /html\[data-clay-slip-mode="(?:all|editable)"\][^{]+::before/g
    );
    expect(cornerTickRules?.length).toBeGreaterThan(0);
    for (const rule of cornerTickRules ?? []) {
      expect(rule).toContain(':not([data-clay-slip-hover])');
      expect(rule).toContain(':not([data-clay-slip-selected])');
    }
  });

  it('uses ::before so it does not collide with the annotation dot (::after)', () => {
    const css = getStylesheetText();
    // Annotation dot uses ::after; corner ticks must use ::before. Verifying
    // the literal pseudo-element keeps the two independent in `all` mode
    // where the same element could be both annotated and ambient.
    expect(css).toContain('data-clay-slip-annotated]::after');
    const cornerTickRule = css.match(/html\[data-clay-slip-mode="all"\][^{]+::before/);
    expect(cornerTickRule).not.toBeNull();
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
  it("toggles reveal on Alt keydown / keyup while mode='all'", () => {
    setHighlightMode('all');
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

  it("does not reveal on Alt while mode is anything other than 'all'", () => {
    // The point of this listener is to be a no-op outside 'all' mode so we
    // don't have to install/uninstall it on every mode change. Assert the
    // per-event mode check actually skips work.
    const cleanup = installAltRevealListener();
    try {
      for (const mode of ['off', 'selection', 'editable'] as const) {
        setHighlightMode(mode);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
        expect(getReveal()).toBe(false);
      }
    } finally {
      cleanup();
    }
  });

  it('ignores keys other than Alt so Alt+letter shortcuts do not flicker', () => {
    setHighlightMode('all');
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
    setHighlightMode('all');
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
    setHighlightMode('all');
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
    setHighlightMode('all');
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

/**
 * Unit tests for the Window Globals path parser. The parser is the single
 * source of truth for what the Options page accepts and what the bridge
 * sees — both go through `parseWindowGlobal` / `normalizeWindowGlobals`.
 * Locking the contract down here means adding nested-path support later
 * is a single-file change with a single test file to update.
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeWindowGlobals,
  parseResultMessage,
  parseWindowGlobal,
} from '@/lib/window-globals';

describe('parseWindowGlobal', () => {
  it('accepts a bare identifier', () => {
    // The shape we want most users to discover by default — type the
    // name, no boilerplate.
    expect(parseWindowGlobal('nymGtmPage')).toEqual({ ok: true, key: 'nymGtmPage' });
  });

  it('accepts the explicit window. prefix and strips it once', () => {
    // Match the way the user phrased the request — both forms should
    // round-trip to the same canonical key so Options.tsx + the bridge
    // never have to special-case the prefix.
    expect(parseWindowGlobal('window.nymGtmPage')).toEqual({ ok: true, key: 'nymGtmPage' });
  });

  it('trims surrounding whitespace before parsing', () => {
    // Frequent paste hazard — copying from analytics docs often picks
    // up a trailing space or newline. Trim instead of reject so the
    // first-time setup feels forgiving.
    expect(parseWindowGlobal('  nymGtmPage  ')).toEqual({ ok: true, key: 'nymGtmPage' });
    expect(parseWindowGlobal('\twindow.dataLayer\n')).toEqual({ ok: true, key: 'dataLayer' });
  });

  it('accepts identifiers starting with $ or _', () => {
    // Some analytics libs ship globals like `_satellite` (Adobe Analytics)
    // or `$gtm` (custom wrappers). Both are valid JS identifiers, both
    // must round-trip.
    expect(parseWindowGlobal('_satellite')).toEqual({ ok: true, key: '_satellite' });
    expect(parseWindowGlobal('$gtm')).toEqual({ ok: true, key: '$gtm' });
  });

  it('rejects empty / whitespace-only input', () => {
    expect(parseWindowGlobal('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseWindowGlobal('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects an empty `window.` with nothing after', () => {
    // `window.` alone should error with the same "empty" code so the
    // Options page doesn't need a third "almost there" message —
    // the same hint covers both cases.
    expect(parseWindowGlobal('window.')).toEqual({ ok: false, reason: 'empty' });
    expect(parseWindowGlobal('  window.  ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects nested dot-paths with a specific reason', () => {
    // Dotted-path is the most likely mistake from someone who thinks
    // in JS expression syntax. We surface a dedicated reason code so
    // the Options page can show a "not supported yet" hint pointing
    // at the v1 limitation, rather than a generic "invalid".
    expect(parseWindowGlobal('window.foo.bar')).toEqual({ ok: false, reason: 'dotted-path' });
    expect(parseWindowGlobal('foo.bar.baz')).toEqual({ ok: false, reason: 'dotted-path' });
  });

  it('rejects bracketed access with a specific reason', () => {
    // Same idea as dotted-paths — different user intent ("I want
    // window.dataLayer[0]"), different inline hint.
    expect(parseWindowGlobal('dataLayer[0]')).toEqual({ ok: false, reason: 'bracketed' });
    expect(parseWindowGlobal("window['foo']")).toEqual({ ok: false, reason: 'bracketed' });
  });

  it('rejects identifiers that start with a digit', () => {
    // 1foo isn't a valid JS identifier; surfacing this as
    // invalid-identifier keeps the parser honest with the runtime
    // behavior (window[key] would still work, but we want users to
    // catch typos at config time, not on a "(not defined)" placeholder).
    expect(parseWindowGlobal('1foo')).toEqual({ ok: false, reason: 'invalid-identifier' });
    expect(parseWindowGlobal('123')).toEqual({ ok: false, reason: 'invalid-identifier' });
  });

  it('rejects identifiers containing spaces or hyphens', () => {
    // Common analytics-key typos: people sometimes paste `foo bar` or
    // `foo-bar`. Neither is a valid identifier; both should error
    // before they hit storage.
    expect(parseWindowGlobal('foo bar')).toEqual({ ok: false, reason: 'invalid-identifier' });
    expect(parseWindowGlobal('foo-bar')).toEqual({ ok: false, reason: 'invalid-identifier' });
  });

  it('only strips the first `window.` prefix (rejects double prefix)', () => {
    // `window.window.foo` is almost certainly a copy-paste mistake.
    // Stripping once leaves `window.foo`, which the dotted-path rule
    // then rejects with a clear reason rather than silently succeeding
    // on a key the user didn't actually mean.
    expect(parseWindowGlobal('window.window.foo')).toEqual({
      ok: false,
      reason: 'dotted-path',
    });
  });
});

describe('parseResultMessage', () => {
  it('returns null for successful results so callers can chain easily', () => {
    // Lets Options.tsx do `parseResultMessage(result) ?? ''` for the
    // inline-error slot without conditional logic.
    expect(parseResultMessage({ ok: true, key: 'foo' })).toBeNull();
  });

  it('returns a distinct message per failure reason', () => {
    // Each reason gets its own hint — we want users to know whether
    // they made a typo, hit a v1 limitation, or just need to fill the
    // field. Asserting distinctness here prevents a future refactor
    // from collapsing two reasons into one accidentally.
    const messages = new Set([
      parseResultMessage({ ok: false, reason: 'empty' }),
      parseResultMessage({ ok: false, reason: 'dotted-path' }),
      parseResultMessage({ ok: false, reason: 'bracketed' }),
      parseResultMessage({ ok: false, reason: 'invalid-identifier' }),
    ]);
    expect(messages.size).toBe(4);
    for (const m of messages) {
      expect(typeof m).toBe('string');
      expect((m as string).length).toBeGreaterThan(0);
    }
  });
});

describe('normalizeWindowGlobals', () => {
  it('strips invalid entries and dedups, preserving first-occurrence order', () => {
    // Mixed input: a bare key, a window-prefixed dup of it, a totally
    // bogus entry, and a second valid key. Expected: just the two
    // valid keys in input order.
    const input = ['nymGtmPage', 'window.nymGtmPage', 'foo.bar', 'dataLayer'];
    expect(normalizeWindowGlobals(input)).toEqual(['nymGtmPage', 'dataLayer']);
  });

  it('returns an empty array when nothing is valid', () => {
    // Defensive: hand-edited storage with garbage shouldn't surface as
    // ghost sections in the Globals tab.
    expect(normalizeWindowGlobals(['', '  ', 'window.', 'foo.bar', '1foo'])).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    // The defaults case. UserPreferences.windowGlobals starts as [],
    // and we want that to stay [] after a normalize round-trip.
    expect(normalizeWindowGlobals([])).toEqual([]);
  });
});

/**
 * Tests for the pure formatting helpers used by the Globals tab.
 *
 * These are extracted into their own module so we can lock in the
 * user-facing copy without rendering the React component. The tab
 * itself is JSX + useState plumbing on top of these helpers + the
 * already-tested page-bridge.
 */
import { describe, expect, it } from 'vitest';
import { failureMessage, summarizeValue } from '@/content/panel/components/globals-format';

describe('failureMessage', () => {
  // Each reason gets a distinct message: regressions that quietly
  // collapse two reasons into one would fail this test. We assert
  // distinctness as a set so the suite doesn't have to enumerate
  // exact strings (which would force a test edit on every copy tweak).
  it('returns a distinct message per reason', () => {
    const messages = new Set([
      failureMessage({ ok: false, reason: 'undefined' }),
      failureMessage({ ok: false, reason: 'not-serializable' }),
      failureMessage({ ok: false, reason: 'serialize-error', message: 'circular' }),
      failureMessage({ ok: false, reason: 'access-error', message: 'boom' }),
      failureMessage({ ok: false, reason: 'bridge-unavailable' }),
    ]);
    expect(messages.size).toBe(5);
  });

  it('embeds the underlying error in serialize-error / access-error', () => {
    // The error from the page bridge is the most actionable detail —
    // if the user sees "could not serialize" without the JS error
    // message, they can't tell if it's circular, BigInt, etc.
    expect(failureMessage({ ok: false, reason: 'serialize-error', message: 'circular' })).toContain(
      'circular'
    );
    expect(failureMessage({ ok: false, reason: 'access-error', message: 'boom' })).toContain(
      'boom'
    );
  });

  it('uses neutral wording for undefined / bridge-unavailable', () => {
    // Neither case is actually a bug — the page just doesn't have the
    // global, or the bridge couldn't run under a strict CSP. The
    // wording shouldn't sound alarming.
    const undef = failureMessage({ ok: false, reason: 'undefined' });
    const blocked = failureMessage({ ok: false, reason: 'bridge-unavailable' });
    for (const m of [undef, blocked]) {
      expect(m.toLowerCase()).not.toContain('error');
      expect(m.toLowerCase()).not.toContain('fail');
    }
  });
});

describe('summarizeValue', () => {
  it('formats null explicitly (not as "object · 0 keys")', () => {
    // `typeof null === 'object'` would otherwise route null to the
    // object branch and read "object · 0 keys" which is confusing.
    expect(summarizeValue(null)).toBe('null');
  });

  it('counts array items with correct pluralization', () => {
    expect(summarizeValue([])).toBe('array · 0 items');
    expect(summarizeValue([1])).toBe('array · 1 item');
    expect(summarizeValue([1, 2, 3])).toBe('array · 3 items');
  });

  it('counts object keys with correct pluralization', () => {
    expect(summarizeValue({})).toBe('object · 0 keys');
    expect(summarizeValue({ a: 1 })).toBe('object · 1 key');
    expect(summarizeValue({ a: 1, b: 2 })).toBe('object · 2 keys');
  });

  it('falls back to typeof for primitives', () => {
    // Top-level globals like `window.SOME_STRING = "hi"` are rare but
    // valid. They should still show *something* meaningful instead
    // of a blank summary.
    expect(summarizeValue('hi')).toBe('string');
    expect(summarizeValue(42)).toBe('number');
    expect(summarizeValue(true)).toBe('boolean');
  });
});

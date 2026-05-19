/**
 * Pure formatting helpers for the Globals tab. Extracted from
 * {@link GlobalsTab} so we can unit-test them without a React
 * Testing Library dependency — the rest of the tab is JSX +
 * useState plumbing on top of the bridge + these helpers.
 */
import type { ReadFailure } from '@/content/window-globals-bridge';

/**
 * Human-friendly message for a bridge failure. Locked in by tests so
 * future tweaks to either side (the bridge reason codes or the
 * user-facing copy) stay in lockstep.
 *
 * The Globals tab uses this both inline (as the collapsed-row
 * secondary text) and as the body text when the row is expanded,
 * which keeps the failure narrative consistent whether the user
 * looks at the summary or expands for details.
 */
export function failureMessage(failure: ReadFailure): string {
  switch (failure.reason) {
    case 'undefined':
      return '(not defined on this page)';
    case 'not-serializable':
      return '(value is not JSON-serializable — likely a function or Symbol)';
    case 'serialize-error':
      return `(could not serialize: ${failure.message})`;
    case 'access-error':
      return `(reading the global threw: ${failure.message})`;
    case 'bridge-unavailable':
      // Catches both the "CSP / Trusted Types blocked the page-bridge
      // injection" and "page-bridge timed out" cases. Users don't need
      // to distinguish; both render as a single "(could not read)"
      // hint with the underlying cause documented in the help text.
      return '(could not read from this page — strict CSP or page never responded)';
  }
}

/**
 * One-line shape description for a successfully-parsed value, used
 * as the collapsed-row secondary text so the user can scan the tab
 * without expanding every card.
 *
 *   array        → "array · 7 items"
 *   object       → "object · 14 keys"
 *   null         → "null"
 *   string/etc.  → typeof name (`"string"`, `"number"`, `"boolean"`)
 *
 * Pluralization is per-shape so the 1-item case isn't grammatically
 * jarring ("array · 1 item" not "array · 1 items").
 */
export function summarizeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    return `array · ${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as object);
    return `object · ${keys.length} key${keys.length === 1 ? '' : 's'}`;
  }
  return typeof value;
}

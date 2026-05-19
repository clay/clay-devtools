/**
 * Parse and normalize one user-configured Window Global path.
 *
 * The Options page lets the user type a global as either of:
 *
 *   nymGtmPage
 *   window.nymGtmPage
 *
 * Both forms are accepted; the leading `window.` (if present) is stripped
 * once. What remains must be a single JavaScript identifier — the v1
 * design intentionally does NOT support nested paths (`window.foo.bar`)
 * or array indices (`window.dataLayer[0]`). If someone needs that later,
 * the contract here is the only thing that has to change.
 *
 * Returns a result object instead of throwing so the Options page can
 * surface a per-row validation message inline without try/catch noise.
 *
 * @example
 *   parseWindowGlobal('window.nymGtmPage') // { ok: true, key: 'nymGtmPage' }
 *   parseWindowGlobal('  $foo  ')          // { ok: true, key: '$foo' }
 *   parseWindowGlobal('foo.bar')           // { ok: false, reason: 'dotted-path' }
 *   parseWindowGlobal('')                  // { ok: false, reason: 'empty' }
 */
export type ParseResult =
  | { readonly ok: true; readonly key: string }
  | {
      readonly ok: false;
      readonly reason: 'empty' | 'dotted-path' | 'bracketed' | 'invalid-identifier';
    };

// Standard JS identifier: starts with letter/_/$ then letters/digits/_/$.
// Deliberately NOT Unicode-aware — analytics globals are ASCII in practice
// and we want to surface typos like a stray non-ASCII space as errors.
const IDENT_RE = /^[$_a-zA-Z][$_a-zA-Z0-9]*$/;

export function parseWindowGlobal(input: string): ParseResult {
  // Defensive trim — users frequently paste with leading/trailing spaces
  // when copying from analytics docs or DevTools.
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  // Strip a *single* leading `window.` so `window.window.foo` rejects
  // (suggests a typo, not the user genuinely wanting `window.foo`
  // under a property named `window`).
  const withoutWindow = trimmed.startsWith('window.') ? trimmed.slice('window.'.length) : trimmed;

  // After the optional strip, an empty string means the user typed just
  // `window.` with nothing after. Treat as the same "empty" error so
  // the Options-page hint stays simple.
  if (!withoutWindow) return { ok: false, reason: 'empty' };

  // We classify the failure mode so the Options page can show the most
  // helpful hint. Dots and brackets are the two paths someone might
  // realistically try if they're thinking in JS expression syntax.
  if (withoutWindow.includes('.')) return { ok: false, reason: 'dotted-path' };
  if (withoutWindow.includes('[') || withoutWindow.includes(']')) {
    return { ok: false, reason: 'bracketed' };
  }
  if (!IDENT_RE.test(withoutWindow)) return { ok: false, reason: 'invalid-identifier' };

  return { ok: true, key: withoutWindow };
}

/**
 * Human-friendly explanation of a {@link ParseResult} failure, suitable
 * for inline display on the Options page. Returns `null` for successful
 * results so callers can use `parseResultMessage(result) ?? ''`-style
 * chains without extra branching.
 */
export function parseResultMessage(result: ParseResult): string | null {
  if (result.ok) return null;
  switch (result.reason) {
    case 'empty':
      return 'Enter a global name (e.g. nymGtmPage or window.dataLayer).';
    case 'dotted-path':
      return 'Nested paths are not supported yet — use the top-level global only.';
    case 'bracketed':
      return 'Array indices are not supported — use the top-level global only.';
    case 'invalid-identifier':
      return 'Must be a valid JavaScript identifier (letters, digits, _, $).';
  }
}

/**
 * Normalize a list of user-entered global paths into the canonical
 * keys-only form, deduped, preserving first-occurrence order.
 *
 * Used both at save time (to keep `chrome.storage.sync` clean) and at
 * read time (so the bridge never sees malformed entries — defense in
 * depth in case someone hand-edits storage).
 */
export function normalizeWindowGlobals(input: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const result = parseWindowGlobal(raw);
    if (!result.ok) continue;
    if (seen.has(result.key)) continue;
    seen.add(result.key);
    out.push(result.key);
  }
  return out;
}

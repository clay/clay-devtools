/**
 * Pretty-prints a value as syntax-highlighted HTML, suitable for use with
 * `dangerouslySetInnerHTML` inside a `<pre>`.
 *
 * Used by the JSON tab and the SEO tab's JSON-LD viewer; centralized here so
 * both surfaces look identical and pick up CSS theme tokens from a single
 * place (`.cs-json-key`, `.cs-json-string`, etc.).
 *
 * The HTML output is XSS-safe — every `&`, `<`, `>` in the source value is
 * escaped before the regex tags strings/numbers/booleans/null. The regex
 * never produces tags that aren't `<span class="cs-json-…">`.
 *
 * Note: the original implementation used a zero-width lookahead `(?=\s*:)`
 * to detect keys, then checked `match.endsWith(':')` in the callback —
 * which never fired because the colon was outside the match. As a result,
 * keys silently rendered with the same green as string values for the
 * lifetime of the JSON tab. This version captures the colon inside the
 * match, so keys now correctly pick up `.cs-json-key`.
 */
export function highlightJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  if (json === undefined) return '';
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"\s*:)|("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")|(\b(?:true|false)\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (match: string) => {
        if (match.endsWith(':')) {
          return `<span class="cs-json-key">${match}</span>`;
        }
        if (match.startsWith('"')) {
          return `<span class="cs-json-string">${match}</span>`;
        }
        if (match === 'true' || match === 'false') {
          return `<span class="cs-json-bool">${match}</span>`;
        }
        if (match === 'null') {
          return `<span class="cs-json-null">${match}</span>`;
        }
        return `<span class="cs-json-number">${match}</span>`;
      }
    );
}

/**
 * Pure functions for parsing and constructing Clay component URIs.
 *
 * A Clay URI looks like:
 *   {host}/_components/{component-name}/instances/{instance-id}@published
 *   {host}/_pages/{page-id}@published
 *   {host}/_layouts/{layout-name}/instances/{instance-id}@published
 */

const COMPONENT_RE = /_components\/([^/.]+?)(?:[/.@]|$)/;
const COMPONENT_INSTANCE_RE = /\/_components\/[^/]+?\/instances\/([^.@/]+)/;
const PAGE_INSTANCE_RE = /\/_pages\/([^./@]+)/;
const PUBLISHED_SUFFIX = '@published';
/** Path segments Clay uses as the boundary between host and resource path. */
const PATH_PREFIXES = ['/_pages/', '/_components/', '/_layouts/', '/_lists/', '/_users/'] as const;

export type UriSuffix = '' | '.json' | '.html' | '/meta';

export function isClayDocument(doc: Document = document): boolean {
  const html = doc.documentElement;
  return Boolean(html?.getAttribute('data-uri'));
}

/**
 * True when the current page is rendered in Clay's edit mode (URL carries
 * `?edit=true`). The extension switches to a "passive" mode on these
 * pages: the panel still mounts and every read-only feature stays
 * available, but we skip installing the highlighter stylesheet, the
 * host-page click/hover listeners, and the reveal-modifier listener — none of
 * which should compete with Clay's own click-to-select, selection
 * overlays, and editor toolbar.
 *
 * Implemented as a URL check rather than a DOM probe because Clay's
 * editor UI mounts asynchronously and we need the answer at content-
 * script bootstrap (before deciding whether to call
 * `installHighlightStyles`).
 *
 * Defaults to {@link location.search}; takes a string for testability.
 */
export function isEditMode(search: string = location.search): boolean {
  try {
    return new URLSearchParams(search).get('edit') === 'true';
  } catch {
    return false;
  }
}

export function getComponentName(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const match = COMPONENT_RE.exec(uri);
  return match?.[1] ?? null;
}

export function getInstance(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const match = COMPONENT_INSTANCE_RE.exec(uri);
  return match?.[1] ?? null;
}

export function getPageInstance(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const match = PAGE_INSTANCE_RE.exec(uri);
  return match?.[1] ?? null;
}

export function isPublished(uri: string | null | undefined): boolean {
  return Boolean(uri?.includes(PUBLISHED_SUFFIX));
}

export function unpublishedUri(uri: string): string {
  return uri.replace(PUBLISHED_SUFFIX, '');
}

export function toTitleCase(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/[-_]/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}

export function getDisplayName(uri: string | null | undefined): string {
  return toTitleCase(getComponentName(uri)) || 'Unknown';
}

/**
 * Splits a Clay URI into its host portion and Clay path portion.
 * Returns a path that always starts with one of the known Clay path prefixes
 * (e.g. `/_components/...`). Falls back to the input if no prefix is found.
 */
export function splitHostAndPath(uri: string): { host: string; path: string } {
  const cleaned = uri.replace(/^https?:\/\//, '');
  for (const prefix of PATH_PREFIXES) {
    const idx = cleaned.indexOf(prefix);
    if (idx > -1) {
      return { host: cleaned.slice(0, idx), path: cleaned.slice(idx) };
    }
  }
  return { host: '', path: '/' + cleaned };
}

/**
 * Prepend `https://` to a Clay URI when no protocol is present, so the
 * resulting string is paste-able into a browser, curl, or any other URL
 * consumer. URIs already carrying `http://` or `https://` are returned
 * unchanged so we never silently rewrite an explicitly-http reference.
 *
 * Empty / nullish input returns an empty string. Any leading `//` is
 * collapsed to keep the resulting URL well-formed in case a caller passes
 * a protocol-relative URI.
 */
export function ensureProtocol(uri: string | null | undefined): string {
  if (!uri) return '';
  const trimmed = uri.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

/**
 * Normalizes a user-provided host string into a `protocol://hostname` form
 * with no trailing slash. Returns an empty string when no host is set.
 */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return '';
  const trimmed = host.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Build the full URL for a Clay URI.
 * - When `hostOverride` is provided, the URI's host is replaced with it.
 * - When omitted (or empty), the URI's existing host is used with `https://`.
 */
export function buildUrl(uri: string, suffix: UriSuffix = '', hostOverride = ''): string {
  const normalizedOverride = normalizeHost(hostOverride);
  if (!normalizedOverride) {
    const cleaned = uri.replace(/^https?:\/\//, '');
    return `https://${cleaned}${suffix}`;
  }
  const { path } = splitHostAndPath(uri);
  return `${normalizedOverride}${path}${suffix}`;
}

/**
 * Builds the schema URL from a component URI.
 * Clay component schemas live at:
 *   {host}/_components/{name}/schema
 */
export function buildSchemaUrl(uri: string, hostOverride = ''): string | null {
  const name = getComponentName(uri);
  if (!name) return null;
  const normalizedOverride = normalizeHost(hostOverride);
  if (normalizedOverride) {
    return `${normalizedOverride}/_components/${name}/schema`;
  }
  const { host } = splitHostAndPath(uri);
  if (!host) return null;
  return `https://${host}/_components/${name}/schema`;
}

export function buildCurlCommand(
  uri: string,
  suffix: UriSuffix = '.json',
  hostOverride = ''
): string {
  const url = buildUrl(uri, suffix, hostOverride);
  return `curl -X GET "${url}" -H "Accept: application/json"`;
}

/**
 * Open the Clay page editor for a given page URI. Standard Amphora Clay
 * accepts `?edit=true` on the page URL to enter edit mode. When a component
 * instance is provided, it's appended as a hash anchor for editor focus.
 *
 * Note: the editor only operates on the *unpublished* version of a page, so
 * we always strip `@published` from the URI before building the URL.
 */
export function buildEditorUrl(
  pageUri: string,
  hostOverride = '',
  componentInstance: string | null = null
): string {
  const base = buildUrl(unpublishedUri(pageUri), '.html', hostOverride);
  const hash = componentInstance ? `#${componentInstance}` : '';
  return `${base}?edit=true${hash}`;
}

/**
 * Build a Clay-Slip deep link that, when opened, auto-selects the given
 * component URI on page load.
 */
export function buildShareLink(currentUrl: string, uri: string): string {
  try {
    const url = new URL(currentUrl);
    url.searchParams.set('clay-slip-select', uri);
    return url.toString();
  } catch {
    const sep = currentUrl.includes('?') ? '&' : '?';
    return `${currentUrl}${sep}clay-slip-select=${encodeURIComponent(uri)}`;
  }
}

export function parseShareTarget(currentUrl: string): string | null {
  try {
    const url = new URL(currentUrl);
    return url.searchParams.get('clay-slip-select');
  } catch {
    return null;
  }
}

export function copyAsFetchSnippet(uri: string, hostOverride = ''): string {
  const url = buildUrl(uri, '.json', hostOverride);
  return `await fetch(${JSON.stringify(url)}, { credentials: 'include' }).then((r) => r.json());`;
}

export function copyAsCssSelector(uri: string): string {
  const safe = uri.replace(/"/g, '\\"');
  return `[data-uri="${safe}"]`;
}

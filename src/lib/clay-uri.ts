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

export function isClayDocument(doc: Document = document): boolean {
  const html = doc.documentElement;
  return Boolean(html?.getAttribute('data-uri'));
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
 * Build the full HTTPS URL for a relative Clay URI (which omits the protocol).
 * Optionally appends a suffix like ".json" or ".html".
 */
export function buildUrl(uri: string, suffix: '' | '.json' | '.html' | '/meta' = ''): string {
  const cleaned = uri.replace(/^https?:\/\//, '');
  return `https://${cleaned}${suffix}`;
}

/**
 * Builds the schema URL from a component URI.
 * Clay component schemas live at:
 *   {host}/_components/{name}/schema
 */
export function buildSchemaUrl(uri: string): string | null {
  const name = getComponentName(uri);
  if (!name) return null;
  const cleaned = uri.replace(/^https?:\/\//, '');
  const host = cleaned.split('/_components/')[0];
  if (!host) return null;
  return `https://${host}/_components/${name}/schema`;
}

export function buildCurlCommand(uri: string, suffix: '' | '.json' = '.json'): string {
  const url = buildUrl(uri, suffix);
  return `curl -X GET "${url}" -H "Accept: application/json"`;
}

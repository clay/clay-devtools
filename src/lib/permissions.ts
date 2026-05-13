/**
 * User-controlled host-permission management.
 *
 * Clay Slip ships with **no** required host permissions. The user adds
 * specific Clay hostnames from the Options page; each addition triggers a
 * native Chrome consent prompt. Only the hosts they explicitly grant get
 * the content script registered against them.
 *
 * The chrome.permissions API works in `origin` patterns
 * (e.g. `https://www.example.com/*`); this module hides that detail and
 * exposes a clean bare-hostname API everywhere else in the codebase.
 */

const HOST_PATTERN = /^[a-z0-9.-]+(?::\d+)?$/i;

/** Bare hostname (e.g. `www.thecut.com` or `localhost:3001`). */
export type Host = string;

/**
 * Convert a list of bare hosts into the `chrome.permissions.origins` shape.
 * Each host expands to **both** http and https patterns so a localhost dev
 * box and an https prod site work without bespoke handling.
 */
export function originsFor(hosts: readonly Host[]): string[] {
  const out: string[] = [];
  for (const host of hosts) {
    if (!HOST_PATTERN.test(host)) continue;
    out.push(`https://${host}/*`, `http://${host}/*`);
  }
  return out;
}

/**
 * Inverse of {@link originsFor}. Pulls the bare hostname out of an
 * `https?://host/*` pattern. Returns `null` for patterns we don't recognize
 * (e.g. `<all_urls>`).
 */
export function hostFromOrigin(origin: string): Host | null {
  const m = origin.match(/^https?:\/\/([^/]+)\/\*?$/);
  return m && m[1] ? m[1] : null;
}

/**
 * The de-duplicated set of bare hosts the user has granted access to.
 * Returns `[]` if `chrome.permissions` is unavailable (test envs).
 */
export async function listGrantedHosts(): Promise<readonly Host[]> {
  if (!chrome?.permissions?.getAll) return [];
  const perms = await chrome.permissions.getAll();
  const hosts = new Set<Host>();
  for (const origin of perms.origins ?? []) {
    const host = hostFromOrigin(origin);
    if (host) hosts.add(host);
  }
  return [...hosts].sort();
}

/**
 * Prompt the user to grant access to `host`. Returns `true` only if Chrome
 * actually granted it (i.e. the user clicked Allow). Must be called from a
 * user-gesture context — typically a button click handler in the Options
 * page or popup.
 */
export async function requestHostPermission(host: Host): Promise<boolean> {
  if (!chrome?.permissions?.request) return false;
  const origins = originsFor([host]);
  if (origins.length === 0) return false;
  return chrome.permissions.request({ origins });
}

/** Revoke previously granted access to `host`. */
export async function removeHostPermission(host: Host): Promise<boolean> {
  if (!chrome?.permissions?.remove) return false;
  const origins = originsFor([host]);
  if (origins.length === 0) return false;
  return chrome.permissions.remove({ origins });
}

/** Check whether `host` is currently granted (cheap; no UI). */
export async function hasHostPermission(host: Host): Promise<boolean> {
  if (!chrome?.permissions?.contains) return false;
  const origins = originsFor([host]);
  if (origins.length === 0) return false;
  return chrome.permissions.contains({ origins });
}

/**
 * Pull the bare hostname out of a full URL string. Convenience for
 * popup/service-worker code that has a `tab.url` to work with.
 */
export function hostFromUrl(url: string | undefined): Host | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.host;
  } catch {
    return null;
  }
}

/**
 * Validate that a string looks like a bare hostname suitable for
 * {@link requestHostPermission}. Use in form validation before showing the
 * grant button.
 */
export function isValidHost(host: string): boolean {
  return HOST_PATTERN.test(host.trim());
}

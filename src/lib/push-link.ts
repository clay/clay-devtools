/**
 * Mobile-app push-notification deep links.
 *
 * NYMag's native iOS / Android apps register a custom `nymag://` URL
 * scheme. Editors paste a `nymag://{host}/_pages/{id}.html` link into a
 * push-notification payload so that tapping the notification opens the
 * article inside the native app instead of the mobile web view.
 *
 * This is a NYMag-specific affordance, so the "Push link" button is only
 * surfaced on pages served from a NYMag-owned domain (see
 * {@link isNymagPushHost}). On any other Clay deployment the button never
 * renders — a fork that doesn't ship the NYMag apps simply won't see it,
 * which keeps the rest of the extension brand-agnostic.
 */
import { splitHostAndPath, unpublishedUri } from './clay-uri';

/** The custom URL scheme registered by the NYMag native apps. */
export const PUSH_LINK_SCHEME = 'nymag://';

/**
 * Registrable domains owned by NYMag brands. A host matches when it equals
 * one of these exactly or is a subdomain of one (case-insensitive), so
 * every environment host — `www.`, `stg.`, `qa.`, and feature-branch
 * `*.dev.nymag.com` — resolves to the same brand without needing to be
 * enumerated here.
 *
 * The vertical brands **Intelligencer** and **The Strategist** are served
 * under `nymag.com`, so they're covered by that single entry. Sourced from
 * the canonical `host:` values in the `sites` repo
 * (`sites/<brand>/config.yaml`).
 */
export const NYMAG_PUSH_DOMAINS: readonly string[] = [
  'nymag.com', // New York Magazine + Intelligencer + The Strategist
  'vulture.com', // Vulture
  'thecut.com', // The Cut
  'grubstreet.com', // Grub Street
  'curbed.com', // Curbed
];

/**
 * True when `host` is a NYMag-owned domain (or a subdomain of one). Gates
 * the "Push link" button so it only appears where the resulting `nymag://`
 * link will actually resolve in the native app.
 *
 * Matching is exact-or-subdomain: `vulture.com` and `www.vulture.com` both
 * match, but `notvulture.com` and `vulture.com.evil.test` do not.
 */
export function isNymagPushHost(host: string | null | undefined): boolean {
  if (!host) return false;
  // Tolerate a `host:port` form even though `location.hostname` omits the
  // port — callers occasionally pass `location.host` instead.
  const needle = host.trim().toLowerCase().replace(/:\d+$/, '');
  if (!needle) return false;
  return NYMAG_PUSH_DOMAINS.some((domain) => needle === domain || needle.endsWith(`.${domain}`));
}

/**
 * Build the mobile push-notification deep link for a page URI, e.g.
 *   `www.vulture.com/_pages/cm4u9ht9400000ih1477u0hyj@published`
 * becomes
 *   `nymag://www.vulture.com/_pages/cm4u9ht9400000ih1477u0hyj.html`.
 *
 * `@published` is stripped (the apps resolve the canonical published
 * article from the bare `.html` path) and any leading `http(s)://` is
 * removed so the scheme is exactly `nymag://`.
 */
export function buildPushLink(pageUri: string): string {
  const cleaned = unpublishedUri(pageUri).replace(/^https?:\/\//, '');
  return `${PUSH_LINK_SCHEME}${cleaned}.html`;
}

/**
 * Build the push link for a page URI, but only when its embedded host is a
 * NYMag domain — otherwise return `null`. Centralizes the host gate so the
 * panel can decide whether to render the button (and what to copy) from a
 * single call, and ties the gate to the host that actually ends up in the
 * link.
 */
export function buildPushLinkForUri(pageUri: string | null | undefined): string | null {
  if (!pageUri) return null;
  const { host } = splitHostAndPath(pageUri);
  if (!isNymagPushHost(host)) return null;
  return buildPushLink(pageUri);
}

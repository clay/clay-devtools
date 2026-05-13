/**
 * Pure helpers for the per-instance site-host mapping feature.
 *
 * A {@link SiteHostMapping} declares one brand/site and the bare hostnames
 * it serves on per environment. These helpers answer three questions:
 *
 *   1. Which mapping/env owns the host I'm currently on?
 *   2. What's the equivalent URL on a different env?
 *   3. Which envs are available to switch to for this host?
 *
 * Matching is exact hostname comparison — no prefix stripping, no wildcards.
 * That keeps behaviour predictable and avoids accidental false matches when
 * a customer's mapping doesn't follow the "stg./qa." convention.
 */

import { SITE_ENV_ORDER, type SiteEnv, type SiteHostMapping } from './types';

export interface MappingMatch {
  readonly mapping: SiteHostMapping;
  readonly env: SiteEnv;
}

/**
 * Find the mapping + env that own a given hostname (case-insensitive).
 * Returns `null` when the hostname isn't configured anywhere.
 */
export function findMappingForHost(
  host: string,
  mappings: readonly SiteHostMapping[]
): MappingMatch | null {
  const needle = host.toLowerCase();
  for (const mapping of mappings) {
    for (const env of SITE_ENV_ORDER) {
      const candidate = mapping.hosts[env];
      if (candidate && candidate.toLowerCase() === needle) {
        return { mapping, env };
      }
    }
  }
  return null;
}

/**
 * Rewrite the hostname of `url` to the matching site-mapping's hostname
 * for `toEnv`. Returns `null` when:
 *   - `url` isn't a valid URL,
 *   - the URL's host isn't in any mapping, or
 *   - the matched mapping has no host configured for `toEnv`.
 *
 * The path, query, and hash are preserved verbatim.
 */
export function rewriteUrlToEnv(
  url: string,
  toEnv: SiteEnv,
  mappings: readonly SiteHostMapping[]
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const match = findMappingForHost(parsed.hostname, mappings);
  if (!match) return null;
  const target = match.mapping.hosts[toEnv];
  if (!target) return null;
  parsed.hostname = target;
  return parsed.toString();
}

/**
 * Which envs have a host configured for the mapping that owns `host`?
 * Returns an empty array when the host isn't in any mapping.
 */
export function availableEnvsFor(
  host: string,
  mappings: readonly SiteHostMapping[]
): readonly SiteEnv[] {
  const match = findMappingForHost(host, mappings);
  if (!match) return [];
  return SITE_ENV_ORDER.filter((env) => Boolean(match.mapping.hosts[env]));
}

/**
 * Generate a small unique id for a new mapping row. Not cryptographic — just
 * unique within a small array of user-managed rows.
 */
export function newMappingId(): string {
  return `m-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function emptyMapping(): SiteHostMapping {
  return { id: newMappingId(), label: '', hosts: {} };
}

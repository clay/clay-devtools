import { describe, expect, it } from 'vitest';
import { availableEnvsFor, findMappingForHost, rewriteUrlToEnv } from '@/lib/site-host';
import type { SiteHostMapping } from '@/lib/types';

const mappings: readonly SiteHostMapping[] = [
  {
    id: 'thecut',
    label: 'The Cut',
    hosts: {
      prod: 'www.thecut.com',
      staging: 'stg.thecut.com',
      qa: 'qa.thecut.com',
    },
  },
  {
    id: 'vulture',
    label: 'Vulture',
    hosts: {
      prod: 'www.vulture.com',
      staging: 'stg.vulture.com',
      // qa intentionally missing
    },
  },
];

describe('findMappingForHost', () => {
  it('matches the prod hostname of a mapping', () => {
    expect(findMappingForHost('www.thecut.com', mappings)).toEqual({
      mapping: mappings[0],
      env: 'prod',
    });
  });

  it('matches a staging hostname', () => {
    expect(findMappingForHost('stg.vulture.com', mappings)).toEqual({
      mapping: mappings[1],
      env: 'staging',
    });
  });

  it('is case insensitive', () => {
    expect(findMappingForHost('STG.THECUT.COM', mappings)).toEqual({
      mapping: mappings[0],
      env: 'staging',
    });
  });

  it('returns null for an unmapped hostname', () => {
    expect(findMappingForHost('example.com', mappings)).toBeNull();
  });

  it('returns null for an empty mappings list', () => {
    expect(findMappingForHost('www.thecut.com', [])).toBeNull();
  });
});

describe('rewriteUrlToEnv', () => {
  it('swaps the hostname while preserving path/query/hash', () => {
    expect(
      rewriteUrlToEnv('https://stg.thecut.com/article/123?ref=newsletter#share', 'prod', mappings)
    ).toBe('https://www.thecut.com/article/123?ref=newsletter#share');
  });

  it('rewrites between two non-prod envs', () => {
    expect(rewriteUrlToEnv('https://qa.thecut.com/foo', 'staging', mappings)).toBe(
      'https://stg.thecut.com/foo'
    );
  });

  it('returns null when the host is not in any mapping', () => {
    expect(rewriteUrlToEnv('https://other.example.com/foo', 'prod', mappings)).toBeNull();
  });

  it('returns null when the target env has no host configured', () => {
    expect(rewriteUrlToEnv('https://www.vulture.com/foo', 'qa', mappings)).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(rewriteUrlToEnv('::not a url::', 'prod', mappings)).toBeNull();
  });
});

describe('availableEnvsFor', () => {
  it('lists every env that has a host for the matched mapping', () => {
    expect(availableEnvsFor('www.thecut.com', mappings)).toEqual(['prod', 'staging', 'qa']);
  });

  it('omits envs that are not configured for the matched mapping', () => {
    expect(availableEnvsFor('www.vulture.com', mappings)).toEqual(['prod', 'staging']);
  });

  it('returns an empty array for an unmapped host', () => {
    expect(availableEnvsFor('example.com', mappings)).toEqual([]);
  });
});

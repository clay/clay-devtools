import { describe, expect, it } from 'vitest';
import {
  buildCurlCommand,
  buildEditorUrl,
  buildSchemaUrl,
  buildShareLink,
  buildUrl,
  copyAsCssSelector,
  copyAsFetchSnippet,
  copyAsPlaywrightLocator,
  getComponentName,
  getDisplayName,
  getInstance,
  getPageInstance,
  isClayDocument,
  isPublished,
  normalizeHost,
  parseShareTarget,
  splitHostAndPath,
  toTitleCase,
  unpublishedUri,
} from '@/lib/clay-uri';

describe('getComponentName', () => {
  it('extracts the component name from a standard component URI', () => {
    const uri = 'example.com/_components/article-header/instances/abc123';
    expect(getComponentName(uri)).toBe('article-header');
  });

  it('extracts the component name when followed by extension', () => {
    expect(getComponentName('site/_components/byline.json')).toBe('byline');
  });

  it('returns null for non-component URIs', () => {
    expect(getComponentName('example.com/_pages/abc')).toBeNull();
  });

  it('handles null and undefined inputs', () => {
    expect(getComponentName(null)).toBeNull();
    expect(getComponentName(undefined)).toBeNull();
    expect(getComponentName('')).toBeNull();
  });
});

describe('getInstance', () => {
  it('extracts the instance ID', () => {
    expect(getInstance('site/_components/foo/instances/xyz789')).toBe('xyz789');
  });

  it('handles published variants', () => {
    expect(getInstance('site/_components/foo/instances/xyz789@published')).toBe('xyz789');
  });

  it('returns null when there is no instance segment', () => {
    expect(getInstance('site/_components/foo')).toBeNull();
  });
});

describe('getPageInstance', () => {
  it('returns the page instance', () => {
    expect(getPageInstance('site/_pages/myPage')).toBe('myPage');
  });

  it('returns null for component URIs', () => {
    expect(getPageInstance('site/_components/foo/instances/xyz')).toBeNull();
  });

  it('does not throw on null or undefined', () => {
    expect(() => getPageInstance(null)).not.toThrow();
    expect(getPageInstance(null)).toBeNull();
  });
});

describe('isPublished', () => {
  it('detects @published suffix', () => {
    expect(isPublished('site/_pages/abc@published')).toBe(true);
    expect(isPublished('site/_pages/abc')).toBe(false);
  });
});

describe('unpublishedUri', () => {
  it('strips the @published suffix', () => {
    expect(unpublishedUri('site/_pages/abc@published')).toBe('site/_pages/abc');
  });

  it('returns the same string when not published', () => {
    expect(unpublishedUri('site/_pages/abc')).toBe('site/_pages/abc');
  });
});

describe('toTitleCase', () => {
  it('converts kebab-case to title case', () => {
    expect(toTitleCase('article-header')).toBe('Article Header');
  });

  it('converts snake_case to title case', () => {
    expect(toTitleCase('breaking_news')).toBe('Breaking News');
  });

  it('handles single words', () => {
    expect(toTitleCase('byline')).toBe('Byline');
  });

  it('returns empty string for null/undefined', () => {
    expect(toTitleCase(null)).toBe('');
    expect(toTitleCase(undefined)).toBe('');
    expect(toTitleCase('')).toBe('');
  });
});

describe('getDisplayName', () => {
  it('returns titlecase from a component URI', () => {
    expect(getDisplayName('site/_components/article-header/instances/x')).toBe('Article Header');
  });

  it('returns "Unknown" when no component name found', () => {
    expect(getDisplayName('site/_pages/abc')).toBe('Unknown');
  });
});

describe('buildUrl', () => {
  it('prepends https:// and optional suffix', () => {
    expect(buildUrl('site/_components/foo/instances/x')).toBe(
      'https://site/_components/foo/instances/x'
    );
    expect(buildUrl('site/_components/foo/instances/x', '.json')).toBe(
      'https://site/_components/foo/instances/x.json'
    );
  });

  it('strips an existing protocol', () => {
    expect(buildUrl('http://site/_components/foo')).toBe('https://site/_components/foo');
  });

  it('appends meta path correctly', () => {
    expect(buildUrl('site/_pages/abc', '/meta')).toBe('https://site/_pages/abc/meta');
  });

  it('rewrites the host when override is provided (bare hostname)', () => {
    expect(
      buildUrl('prod.example.com/_components/foo/instances/x', '.json', 'staging.example.com')
    ).toBe('https://staging.example.com/_components/foo/instances/x.json');
  });

  it('rewrites the host when override includes protocol', () => {
    expect(buildUrl('prod.example.com/_pages/x', '', 'http://localhost:3001')).toBe(
      'http://localhost:3001/_pages/x'
    );
  });

  it('strips trailing slash from host override', () => {
    expect(buildUrl('prod.example.com/_pages/x', '', 'https://staging.example.com/')).toBe(
      'https://staging.example.com/_pages/x'
    );
  });

  it('falls back to original host when override is empty', () => {
    expect(buildUrl('prod.example.com/_pages/x', '', '')).toBe('https://prod.example.com/_pages/x');
  });
});

describe('buildSchemaUrl', () => {
  it('builds the schema URL for a component', () => {
    expect(buildSchemaUrl('site/_components/byline/instances/x')).toBe(
      'https://site/_components/byline/schema'
    );
  });

  it('returns null for non-component URIs', () => {
    expect(buildSchemaUrl('site/_pages/abc')).toBeNull();
  });

  it('respects host override', () => {
    expect(buildSchemaUrl('prod.example.com/_components/byline/x', 'staging.example.com')).toBe(
      'https://staging.example.com/_components/byline/schema'
    );
  });
});

describe('buildCurlCommand', () => {
  it('emits a curl command targeting JSON', () => {
    const cmd = buildCurlCommand('site/_components/foo/instances/x');
    expect(cmd).toContain('curl -X GET');
    expect(cmd).toContain('https://site/_components/foo/instances/x.json');
    expect(cmd).toContain('Accept: application/json');
  });

  it('uses host override in URL', () => {
    const cmd = buildCurlCommand(
      'prod.example.com/_components/foo/instances/x',
      '.json',
      'staging.example.com'
    );
    expect(cmd).toContain('https://staging.example.com/_components/foo/instances/x.json');
  });
});

describe('splitHostAndPath', () => {
  it('separates host and path on a clean URI', () => {
    expect(splitHostAndPath('site.example.com/_components/byline/instances/x')).toEqual({
      host: 'site.example.com',
      path: '/_components/byline/instances/x',
    });
  });

  it('strips the protocol if present', () => {
    expect(splitHostAndPath('https://site.example.com/_pages/foo')).toEqual({
      host: 'site.example.com',
      path: '/_pages/foo',
    });
  });

  it('handles all known Clay path prefixes', () => {
    expect(splitHostAndPath('site/_layouts/main/instances/x').path).toBe(
      '/_layouts/main/instances/x'
    );
    expect(splitHostAndPath('site/_lists/x').path).toBe('/_lists/x');
    expect(splitHostAndPath('site/_users/x').path).toBe('/_users/x');
  });

  it('returns empty host when there is no Clay prefix', () => {
    expect(splitHostAndPath('not-a-clay-uri/whatever').host).toBe('');
  });
});

describe('normalizeHost', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeHost('')).toBe('');
    expect(normalizeHost(null)).toBe('');
    expect(normalizeHost(undefined)).toBe('');
  });

  it('prepends https:// to bare hostnames', () => {
    expect(normalizeHost('staging.example.com')).toBe('https://staging.example.com');
  });

  it('preserves http:// for local dev', () => {
    expect(normalizeHost('http://localhost:3001')).toBe('http://localhost:3001');
  });

  it('strips trailing slashes', () => {
    expect(normalizeHost('https://example.com/')).toBe('https://example.com');
    expect(normalizeHost('https://example.com///')).toBe('https://example.com');
  });
});

describe('buildEditorUrl', () => {
  it('appends ?edit=true to the page URL', () => {
    expect(buildEditorUrl('site/_pages/abc')).toBe('https://site/_pages/abc.html?edit=true');
  });

  it('respects host override', () => {
    expect(buildEditorUrl('prod.example.com/_pages/abc', 'staging.example.com')).toBe(
      'https://staging.example.com/_pages/abc.html?edit=true'
    );
  });

  it('appends instance hash when given', () => {
    expect(buildEditorUrl('site/_pages/abc', '', 'inst-123')).toBe(
      'https://site/_pages/abc.html?edit=true#inst-123'
    );
  });
});

describe('buildShareLink + parseShareTarget', () => {
  it('appends the clay-slip-select param to a URL', () => {
    const link = buildShareLink('https://example.com/page', 'site/_components/byline/instances/x');
    expect(link).toContain('clay-slip-select=site');
    expect(parseShareTarget(link)).toBe('site/_components/byline/instances/x');
  });

  it('replaces an existing clay-slip-select param rather than duplicating', () => {
    const link = buildShareLink('https://example.com/page?clay-slip-select=old', 'new');
    const url = new URL(link);
    expect(url.searchParams.getAll('clay-slip-select')).toEqual(['new']);
  });

  it('returns null when no param is present', () => {
    expect(parseShareTarget('https://example.com')).toBeNull();
  });
});

describe('copy helpers', () => {
  it('builds a fetch snippet against the env host', () => {
    const snip = copyAsFetchSnippet(
      'prod.example.com/_components/byline/instances/x',
      'staging.example.com'
    );
    expect(snip).toContain('await fetch(');
    expect(snip).toContain('staging.example.com');
    expect(snip).toContain('.json');
  });

  it('builds a Playwright locator', () => {
    expect(copyAsPlaywrightLocator('site/_components/x')).toBe(
      'page.locator(\'[data-uri="site/_components/x"]\')'
    );
  });

  it('builds a CSS selector with quote escaping', () => {
    expect(copyAsCssSelector('site/_components/x"y')).toBe('[data-uri="site/_components/x\\"y"]');
  });
});

describe('isClayDocument', () => {
  it('returns true when html has data-uri', () => {
    document.documentElement.setAttribute('data-uri', 'site/_pages/x');
    expect(isClayDocument()).toBe(true);
    document.documentElement.removeAttribute('data-uri');
  });

  it('returns false when html lacks data-uri', () => {
    document.documentElement.removeAttribute('data-uri');
    expect(isClayDocument()).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildCurlCommand,
  buildSchemaUrl,
  buildUrl,
  getComponentName,
  getDisplayName,
  getInstance,
  getPageInstance,
  isClayDocument,
  isPublished,
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
});

describe('buildCurlCommand', () => {
  it('emits a curl command targeting JSON', () => {
    const cmd = buildCurlCommand('site/_components/foo/instances/x');
    expect(cmd).toContain('curl -X GET');
    expect(cmd).toContain('https://site/_components/foo/instances/x.json');
    expect(cmd).toContain('Accept: application/json');
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

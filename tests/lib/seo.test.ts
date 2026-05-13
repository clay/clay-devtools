import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractSeoMeta, lintJsonLd, lintSeo, summarizeJsonLd } from '@/lib/seo';

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  const el = document.createElement('meta');
  el.setAttribute(attr, name);
  el.setAttribute('content', content);
  document.head.appendChild(el);
  return el;
}

describe('extractSeoMeta', () => {
  let added: HTMLElement[] = [];

  beforeEach(() => {
    document.title = 'Test Title';
    added = [
      setMeta('description', 'A description here'),
      setMeta('og:title', 'OG Title', 'property'),
      setMeta('og:image', 'https://example.com/img.jpg', 'property'),
      setMeta('twitter:card', 'summary_large_image'),
    ];
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = 'https://example.com/test';
    document.head.appendChild(link);
    added.push(link);
    const h1 = document.createElement('h1');
    h1.textContent = 'Heading';
    document.body.appendChild(h1);
    added.push(h1);
  });

  afterEach(() => {
    added.forEach((el) => el.remove());
    document.title = '';
  });

  it('reads title, description, canonical, og + twitter', () => {
    const meta = extractSeoMeta();
    expect(meta.title).toBe('Test Title');
    expect(meta.description).toBe('A description here');
    expect(meta.canonical).toBe('https://example.com/test');
    expect(meta.og['og:title']).toBe('OG Title');
    expect(meta.og['og:image']).toBe('https://example.com/img.jpg');
    expect(meta.twitter['twitter:card']).toBe('summary_large_image');
    expect(meta.h1Count).toBe(1);
  });
});

describe('lintSeo', () => {
  it('flags long titles + long descriptions', () => {
    const issues = lintSeo({
      title: 'a'.repeat(80),
      description: 'b'.repeat(200),
      canonical: '',
      robots: '',
      og: {},
      twitter: {},
      jsonLd: [],
      h1Count: 0,
    });
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('title-long');
    expect(ids).toContain('desc-long');
    expect(ids).toContain('og-image-missing');
    expect(ids).toContain('h1-missing');
  });

  it('reports nothing critical for a healthy page', () => {
    const issues = lintSeo({
      title: 'A perfectly normal title length',
      description: 'A '.repeat(40).trim(),
      canonical: 'https://example.com/x',
      robots: 'index, follow',
      og: {
        'og:title': 'x',
        'og:image': 'https://example.com/x.jpg',
        'og:description': 'x',
      },
      twitter: { 'twitter:card': 'summary' },
      jsonLd: [{ '@type': 'NewsArticle' }],
      h1Count: 1,
    });
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(issues.filter((i) => i.severity === 'warn')).toHaveLength(0);
  });
});

describe('summarizeJsonLd', () => {
  it('extracts a single @type with its headline', () => {
    const summary = summarizeJsonLd({
      '@type': 'NewsArticle',
      headline: 'Why the panel matters',
    });
    expect(summary).toEqual({
      typeLabel: 'NewsArticle',
      secondary: 'Why the panel matters',
      invalid: false,
      itemCount: null,
    });
  });

  it('joins multiple @type values with a slash', () => {
    const summary = summarizeJsonLd({
      '@type': ['Article', 'NewsArticle'],
      name: 'Multi-type article',
    });
    expect(summary.typeLabel).toBe('Article / NewsArticle');
    expect(summary.secondary).toBe('Multi-type article');
  });

  it('summarizes a Yoast-style @graph as a count + sorted unique types', () => {
    const summary = summarizeJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Site' },
        { '@type': 'Article', headline: 'Headline' },
        { '@type': 'BreadcrumbList' },
      ],
    });
    expect(summary.typeLabel).toBe('@graph (Article, BreadcrumbList, WebSite)');
    expect(summary.itemCount).toBe(3);
    expect(summary.invalid).toBe(false);
  });

  it('caps a long secondary string with an ellipsis', () => {
    const summary = summarizeJsonLd({
      '@type': 'Article',
      headline: 'a'.repeat(120),
    });
    expect(summary.secondary).toMatch(/…$/);
    expect(summary.secondary?.length).toBeLessThanOrEqual(80);
  });

  it('falls back to "Untyped object" when @type is missing', () => {
    const summary = summarizeJsonLd({ name: 'Just a name' });
    expect(summary.typeLabel).toBe('Untyped object');
    expect(summary.secondary).toBe('Just a name');
  });

  it('marks blocks the extractor flagged as invalid', () => {
    const summary = summarizeJsonLd({ __invalid: true, raw: 'this is not json' });
    expect(summary).toEqual({
      typeLabel: 'Invalid JSON',
      secondary: null,
      invalid: true,
      itemCount: null,
    });
  });

  it('handles a top-level array of entities', () => {
    const summary = summarizeJsonLd([
      { '@type': 'Person', name: 'Alice' },
      { '@type': 'Person', name: 'Bob' },
    ]);
    expect(summary.typeLabel).toBe('Array (Person)');
    expect(summary.itemCount).toBe(2);
  });
});

describe('lintJsonLd', () => {
  /** Build a "perfect" NewsArticle that should produce zero issues. */
  function goodArticle(overrides: Record<string, unknown> = {}) {
    return {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: 'A perfectly normal headline',
      image: 'https://example.com/img.jpg',
      datePublished: '2026-05-13T10:00:00Z',
      dateModified: '2026-05-13T11:00:00Z',
      author: { '@type': 'Person', name: 'Alice' },
      publisher: { '@type': 'Organization', name: 'NY Mag' },
      ...overrides,
    };
  }

  function codes(blocks: readonly unknown[]): string[] {
    return lintJsonLd(blocks).map((i) => i.code);
  }

  it('returns no issues for a healthy NewsArticle block', () => {
    expect(lintJsonLd([goodArticle()])).toEqual([]);
  });

  it('flags missing @context as an error', () => {
    const block = goodArticle();
    delete (block as { '@context'?: unknown })['@context'];
    expect(codes([block])).toContain('missing-context');
  });

  it('flags an @context that is not a schema.org URL', () => {
    const block = goodArticle({ '@context': 'https://shema.org' });
    const issues = lintJsonLd([block]);
    const ctx = issues.find((i) => i.code === 'invalid-context');
    expect(ctx?.severity).toBe('error');
    expect(ctx?.path).toBe('@context');
  });

  it('accepts http:// and trailing-slash variants of schema.org', () => {
    expect(codes([goodArticle({ '@context': 'http://schema.org' })])).not.toContain(
      'invalid-context'
    );
    expect(codes([goodArticle({ '@context': 'https://schema.org/' })])).not.toContain(
      'invalid-context'
    );
  });

  it('flags missing @type with a warning', () => {
    expect(codes([{ '@context': 'https://schema.org', name: 'Untyped' }])).toContain(
      'missing-type'
    );
  });

  it('reports every required Article field that is missing', () => {
    const block: Record<string, unknown> = { '@context': 'https://schema.org', '@type': 'Article' };
    const issues = codes([block]);
    expect(issues).toEqual(
      expect.arrayContaining([
        'article-missing-headline',
        'article-missing-image',
        'article-missing-date-published',
        'article-missing-author',
        'article-missing-publisher',
      ])
    );
  });

  it('warns when the headline exceeds the Google rich-result limit', () => {
    const block = goodArticle({ headline: 'a'.repeat(120) });
    const issues = lintJsonLd([block]);
    const long = issues.find((i) => i.code === 'article-headline-long');
    expect(long?.severity).toBe('warn');
    expect(long?.path).toBe('headline');
  });

  it('flags relative image URLs (string form and ImageObject form)', () => {
    const stringForm = lintJsonLd([goodArticle({ image: '/img.jpg' })]);
    expect(stringForm.map((i) => i.code)).toContain('article-image-relative');
    expect(stringForm.find((i) => i.code === 'article-image-relative')?.path).toBe('image');

    const objectForm = lintJsonLd([
      goodArticle({ image: { '@type': 'ImageObject', url: 'images/x.jpg' } }),
    ]);
    expect(objectForm.find((i) => i.code === 'article-image-relative')?.path).toBe('image.url');

    const arrayForm = lintJsonLd([
      goodArticle({
        image: ['https://example.com/ok.jpg', '/relative.jpg'],
      }),
    ]);
    const arrayIssue = arrayForm.find((i) => i.code === 'article-image-relative');
    expect(arrayIssue?.path).toBe('image[1]');
  });

  it('flags non-ISO datePublished and dateModified strings', () => {
    const block = goodArticle({ datePublished: 'May 13 2026', dateModified: 'tomorrow' });
    const issues = codes([block]);
    expect(issues).toContain('article-bad-date-published');
    expect(issues).toContain('article-bad-date-modified');
  });

  it('warns when dateModified is earlier than datePublished', () => {
    const block = goodArticle({
      datePublished: '2026-05-13T10:00:00Z',
      dateModified: '2026-05-12T10:00:00Z',
    });
    expect(codes([block])).toContain('article-modified-before-published');
  });

  it('walks into @graph and lints each inner entity', () => {
    const issues = lintJsonLd([
      {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Site' }, // OK (not Article-family)
          { '@type': 'Article', name: 'Inner' }, // missing required Article fields
        ],
      },
    ]);
    const articleIssues = issues.filter((i) => i.path.startsWith('@graph[1]'));
    expect(articleIssues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['article-missing-headline', 'article-missing-image'])
    );
  });

  it('flags BreadcrumbList items missing required fields', () => {
    const block = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/' },
        { '@type': 'ListItem', name: 'Section' }, // missing position + item
      ],
    };
    expect(codes([block])).toEqual(
      expect.arrayContaining(['breadcrumb-missing-position', 'breadcrumb-missing-item'])
    );
  });

  it('flags BreadcrumbList positions that are not 1, 2, … N', () => {
    const block = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/' },
        { '@type': 'ListItem', position: 2, name: 'Section', item: 'https://example.com/s' },
        { '@type': 'ListItem', position: 5, name: 'Page', item: 'https://example.com/x' }, // bad
      ],
    };
    expect(codes([block])).toContain('breadcrumb-bad-positions');
  });

  it('skips position contiguity check when any item is missing a position', () => {
    // We can't reliably tell if positions are contiguous if some are
    // missing — a single "breadcrumb-missing-position" warning is enough.
    const block = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/' },
        { '@type': 'ListItem', name: 'Gap', item: 'https://example.com/g' }, // no position
        { '@type': 'ListItem', position: 3, name: 'End', item: 'https://example.com/e' },
      ],
    };
    expect(codes([block])).not.toContain('breadcrumb-bad-positions');
  });

  it('flags an empty BreadcrumbList', () => {
    expect(
      codes([{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] }])
    ).toContain('breadcrumb-empty');
  });

  it('detects duplicate @id values across blocks (not within a single block)', () => {
    // Same @id in two separate blocks → flagged.
    const dup = lintJsonLd([
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': 'https://example.com/x',
        headline: 'h',
        image: 'i',
        datePublished: '2026-01-01',
        author: 'a',
        publisher: 'p',
      },
      { '@context': 'https://schema.org', '@type': 'WebSite', '@id': 'https://example.com/x' },
    ]);
    expect(dup.map((i) => i.code)).toContain('duplicate-id');

    // Same @id appearing twice in one block (graph self-reference) → not flagged.
    const single = lintJsonLd([
      {
        '@context': 'https://schema.org',
        '@id': 'https://example.com/x',
        '@graph': [{ '@type': 'WebSite', '@id': 'https://example.com/x' }],
      },
    ]);
    expect(single.map((i) => i.code)).not.toContain('duplicate-id');
  });

  it('skips blocks the extractor flagged as invalid', () => {
    expect(lintJsonLd([{ __invalid: true, raw: 'broken json' }])).toEqual([]);
  });

  it('attaches blockIndex so callers can group issues per card', () => {
    const issues = lintJsonLd([
      goodArticle(), // index 0 — clean
      { '@type': 'Article' }, // index 1 — many issues
    ]);
    expect(issues.every((i) => i.blockIndex === 1)).toBe(true);
  });
});

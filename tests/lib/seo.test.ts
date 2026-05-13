import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractSeoMeta, lintSeo, summarizeJsonLd } from '@/lib/seo';

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

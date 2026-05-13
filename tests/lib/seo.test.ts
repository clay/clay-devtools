import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractSeoMeta, lintSeo } from '@/lib/seo';

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

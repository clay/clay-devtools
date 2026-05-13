/**
 * Extracts SEO/social metadata from the host document and produces a list of
 * lint warnings about common issues.
 */

export interface SeoMeta {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly robots: string;
  readonly og: Record<string, string>;
  readonly twitter: Record<string, string>;
  readonly jsonLd: unknown[];
  readonly h1Count: number;
}

export interface SeoIssue {
  readonly id: string;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
}

const TITLE_MAX = 60;
const DESC_MIN = 50;
const DESC_MAX = 160;

function readMetaByName(doc: Document, names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of doc.querySelectorAll<HTMLMetaElement>('meta[property], meta[name]')) {
    const key = (m.getAttribute('property') ?? m.getAttribute('name') ?? '').toLowerCase();
    if (!key) continue;
    for (const prefix of names) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        out[key] = m.getAttribute('content') ?? '';
      }
    }
  }
  return out;
}

function readSimpleMeta(doc: Document, name: string): string {
  const el = doc.querySelector<HTMLMetaElement>(
    `meta[name="${name}" i], meta[property="${name}" i]`
  );
  return el?.getAttribute('content') ?? '';
}

function readJsonLd(doc: Document): unknown[] {
  const blocks: unknown[] = [];
  for (const s of doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) {
    try {
      blocks.push(JSON.parse(s.textContent ?? 'null'));
    } catch {
      blocks.push({ __invalid: true, raw: s.textContent });
    }
  }
  return blocks;
}

export function extractSeoMeta(doc: Document = document): SeoMeta {
  return {
    title: doc.title ?? '',
    description: readSimpleMeta(doc, 'description'),
    canonical: doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '',
    robots: readSimpleMeta(doc, 'robots'),
    og: readMetaByName(doc, ['og']),
    twitter: readMetaByName(doc, ['twitter']),
    jsonLd: readJsonLd(doc),
    h1Count: doc.querySelectorAll('h1').length,
  };
}

export function lintSeo(meta: SeoMeta): SeoIssue[] {
  const issues: SeoIssue[] = [];

  if (!meta.title) {
    issues.push({ id: 'title-missing', severity: 'error', message: 'Page is missing a <title>.' });
  } else if (meta.title.length > TITLE_MAX) {
    issues.push({
      id: 'title-long',
      severity: 'warn',
      message: `Title is ${meta.title.length} chars (recommended ≤ ${TITLE_MAX}).`,
    });
  }

  if (!meta.description) {
    issues.push({
      id: 'desc-missing',
      severity: 'warn',
      message: 'No meta description set.',
    });
  } else if (meta.description.length < DESC_MIN) {
    issues.push({
      id: 'desc-short',
      severity: 'info',
      message: `Description is ${meta.description.length} chars (try ${DESC_MIN}–${DESC_MAX}).`,
    });
  } else if (meta.description.length > DESC_MAX) {
    issues.push({
      id: 'desc-long',
      severity: 'warn',
      message: `Description is ${meta.description.length} chars (try ${DESC_MIN}–${DESC_MAX}).`,
    });
  }

  if (!meta.canonical) {
    issues.push({
      id: 'canonical-missing',
      severity: 'info',
      message: 'No canonical URL declared.',
    });
  }

  if (!meta.og['og:image']) {
    issues.push({
      id: 'og-image-missing',
      severity: 'warn',
      message: 'Missing og:image — link previews will fall back to the platform default.',
    });
  }
  if (!meta.og['og:title']) {
    issues.push({ id: 'og-title-missing', severity: 'info', message: 'No og:title set.' });
  }
  if (!meta.og['og:description']) {
    issues.push({
      id: 'og-desc-missing',
      severity: 'info',
      message: 'No og:description set.',
    });
  }
  if (!meta.twitter['twitter:card']) {
    issues.push({
      id: 'tw-card-missing',
      severity: 'info',
      message: 'No twitter:card type — Twitter will pick a default.',
    });
  }

  if (meta.h1Count === 0) {
    issues.push({ id: 'h1-missing', severity: 'warn', message: 'Page has no <h1>.' });
  } else if (meta.h1Count > 1) {
    issues.push({
      id: 'h1-multiple',
      severity: 'info',
      message: `Page has ${meta.h1Count} <h1> tags (one is usually enough).`,
    });
  }

  if (!meta.jsonLd.length) {
    issues.push({
      id: 'jsonld-missing',
      severity: 'info',
      message: 'No JSON-LD structured data found.',
    });
  }

  return issues;
}

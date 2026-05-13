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

/**
 * One-line description of a JSON-LD block, suitable for the collapsed
 * card header in the SEO tab. Tries hard to extract the most useful
 * signal — `@type` (or list of types in a `@graph`) plus a name/headline
 * if one is present — and falls back to a generic label when the block
 * doesn't follow the schema.org conventions.
 */
export interface JsonLdSummary {
  readonly typeLabel: string;
  readonly secondary: string | null;
  readonly invalid: boolean;
  readonly itemCount: number | null;
}

const MAX_SECONDARY = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Schema.org `@type` values can be a string, an array of strings, or
 * occasionally a nested array. Normalize into a clean string list.
 */
function readTypes(node: unknown): string[] {
  if (!isRecord(node)) return [];
  const raw = node['@type'];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  return [];
}

/**
 * Pick the best human-readable label out of the common name-ish fields.
 * `headline` is the standard for `Article`/`NewsArticle`; `name` is the
 * fallback for almost everything else; `url` is a last resort.
 */
function readSecondary(node: unknown): string | null {
  if (!isRecord(node)) return null;
  for (const field of ['headline', 'name', 'title', 'url'] as const) {
    const v = node[field];
    if (typeof v === 'string' && v.trim()) {
      const trimmed = v.trim();
      return trimmed.length > MAX_SECONDARY ? `${trimmed.slice(0, MAX_SECONDARY - 1)}…` : trimmed;
    }
  }
  return null;
}

export function summarizeJsonLd(block: unknown): JsonLdSummary {
  if (isRecord(block) && block.__invalid === true) {
    return { typeLabel: 'Invalid JSON', secondary: null, invalid: true, itemCount: null };
  }

  // `@graph` is the canonical "bag of multiple top-level entities" pattern
  // — Yoast and Rank Math both emit it. Show the count + the unique types
  // in the graph so the user knows what they're about to expand.
  if (isRecord(block) && Array.isArray(block['@graph'])) {
    const items = block['@graph'];
    const types = new Set<string>();
    for (const item of items) for (const t of readTypes(item)) types.add(t);
    const typeLabel =
      types.size === 0
        ? '@graph'
        : `@graph (${[...types].sort().slice(0, 4).join(', ')}${types.size > 4 ? '…' : ''})`;
    return { typeLabel, secondary: null, invalid: false, itemCount: items.length };
  }

  // A bare top-level array of entities — unusual but valid.
  if (Array.isArray(block)) {
    const types = new Set<string>();
    for (const item of block) for (const t of readTypes(item)) types.add(t);
    const typeLabel =
      types.size === 0 ? 'Array' : `Array (${[...types].sort().slice(0, 4).join(', ')})`;
    return { typeLabel, secondary: null, invalid: false, itemCount: block.length };
  }

  const types = readTypes(block);
  const typeLabel = types.length === 0 ? 'Untyped object' : types.join(' / ');
  return {
    typeLabel,
    secondary: readSecondary(block),
    invalid: false,
    itemCount: null,
  };
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

/* ============================================================
   JSON-LD validator
   ============================================================ */

export interface JsonLdIssue {
  /** Stable rule id, e.g. `missing-context`. Useful for tests + telemetry. */
  readonly code: string;
  readonly severity: 'info' | 'warn' | 'error';
  readonly message: string;
  /** Index into the `meta.jsonLd` array — i.e. which `<script>` tag. */
  readonly blockIndex: number;
  /** Dotted path inside the block, e.g. `@graph[1].author`. Empty = root. */
  readonly path: string;
}

const HEADLINE_MAX = 110; // Google's documented Article rich-result limit
const SCHEMA_HOSTS = new Set(['schema.org', 'www.schema.org']);
const ARTICLE_TYPES = new Set([
  'Article',
  'NewsArticle',
  'BlogPosting',
  'Report',
  'ReviewArticle',
  'AnalysisNewsArticle',
  'OpinionNewsArticle',
  'BackgroundNewsArticle',
]);

function isIsoDate(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  // Accept ISO 8601 with or without time/zone. Be lenient about the
  // separator + timezone shape; reject anything that isn't a valid Date.
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(value))
    return false;
  return !Number.isNaN(Date.parse(value));
}

function isAbsoluteUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isContextValueValid(ctx: unknown): boolean {
  // Schema.org allows strings (`"https://schema.org"`), arrays, or objects
  // (`{ "@vocab": "https://schema.org/" }`). We only validate the first
  // form deeply since 99% of real-world Article markup uses it.
  if (typeof ctx === 'string') {
    try {
      const u = new URL(ctx);
      return SCHEMA_HOSTS.has(u.hostname);
    } catch {
      return false;
    }
  }
  if (Array.isArray(ctx)) return ctx.some(isContextValueValid);
  return isRecord(ctx); // Trust object @context shapes.
}

function hasNonEmptyValue(node: Record<string, unknown>, ...keys: string[]): boolean {
  for (const k of keys) {
    const v = node[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    return true;
  }
  return false;
}

function joinPath(base: string, segment: string): string {
  if (!base) return segment;
  if (segment.startsWith('[')) return `${base}${segment}`;
  return `${base}.${segment}`;
}

/**
 * Inspect a single schema.org entity (no `@graph` recursion — that's
 * unwrapped by the caller). Pushes any issues found into `out`.
 */
function lintEntity(entity: unknown, blockIndex: number, path: string, out: JsonLdIssue[]): void {
  if (!isRecord(entity)) return;
  const types = readTypes(entity);

  if (types.length === 0) {
    out.push({
      code: 'missing-type',
      severity: 'warn',
      message: 'Entity has no @type — search engines will treat it as opaque data.',
      blockIndex,
      path,
    });
  }

  // ── Article-family checks ───────────────────────────────────────────────
  if (types.some((t) => ARTICLE_TYPES.has(t))) {
    if (!hasNonEmptyValue(entity, 'headline')) {
      out.push({
        code: 'article-missing-headline',
        severity: 'error',
        message: `${types[0]} is missing "headline" — required for Google rich results.`,
        blockIndex,
        path,
      });
    } else if (typeof entity.headline === 'string' && entity.headline.length > HEADLINE_MAX) {
      out.push({
        code: 'article-headline-long',
        severity: 'warn',
        message: `"headline" is ${entity.headline.length} chars (Google truncates above ${HEADLINE_MAX}).`,
        blockIndex,
        path: joinPath(path, 'headline'),
      });
    }

    if (!hasNonEmptyValue(entity, 'image')) {
      out.push({
        code: 'article-missing-image',
        severity: 'error',
        message: `${types[0]} is missing "image" — required for Google rich results.`,
        blockIndex,
        path,
      });
    } else {
      // The `image` field can be a string URL, an ImageObject, an array
      // of either, or a single object inside an array. Pull out every
      // candidate URL string and check it's absolute — relative paths
      // silently break Google's image fetch on the rich-result crawl.
      const imageUrls: { url: unknown; subPath: string }[] = [];
      const candidates = Array.isArray(entity.image) ? entity.image : [entity.image];
      candidates.forEach((c, i) => {
        const subPath = candidates.length > 1 ? `image[${i}]` : 'image';
        if (typeof c === 'string') imageUrls.push({ url: c, subPath });
        else if (isRecord(c) && 'url' in c)
          imageUrls.push({ url: c.url, subPath: `${subPath}.url` });
      });
      for (const { url, subPath } of imageUrls) {
        if (typeof url === 'string' && url && !isAbsoluteUrl(url)) {
          out.push({
            code: 'article-image-relative',
            severity: 'warn',
            message: `"image" must be an absolute URL — got ${JSON.stringify(url)}.`,
            blockIndex,
            path: joinPath(path, subPath),
          });
        }
      }
    }

    if (!hasNonEmptyValue(entity, 'datePublished')) {
      out.push({
        code: 'article-missing-date-published',
        severity: 'error',
        message: `${types[0]} is missing "datePublished" — required for Google rich results.`,
        blockIndex,
        path,
      });
    } else if (!isIsoDate(entity.datePublished)) {
      out.push({
        code: 'article-bad-date-published',
        severity: 'warn',
        message: `"datePublished" is not a valid ISO 8601 date (got ${JSON.stringify(entity.datePublished)}).`,
        blockIndex,
        path: joinPath(path, 'datePublished'),
      });
    }

    if (entity.dateModified !== undefined && !isIsoDate(entity.dateModified)) {
      out.push({
        code: 'article-bad-date-modified',
        severity: 'warn',
        message: `"dateModified" is not a valid ISO 8601 date (got ${JSON.stringify(entity.dateModified)}).`,
        blockIndex,
        path: joinPath(path, 'dateModified'),
      });
    }

    if (
      isIsoDate(entity.datePublished) &&
      isIsoDate(entity.dateModified) &&
      Date.parse(entity.dateModified as string) < Date.parse(entity.datePublished as string)
    ) {
      out.push({
        code: 'article-modified-before-published',
        severity: 'warn',
        message: '"dateModified" is earlier than "datePublished" — likely a copy-paste bug.',
        blockIndex,
        path,
      });
    }

    if (!hasNonEmptyValue(entity, 'author')) {
      out.push({
        code: 'article-missing-author',
        severity: 'warn',
        message: `${types[0]} is missing "author" — recommended for Google rich results.`,
        blockIndex,
        path,
      });
    }

    if (!hasNonEmptyValue(entity, 'publisher')) {
      out.push({
        code: 'article-missing-publisher',
        severity: 'info',
        message: `${types[0]} is missing "publisher".`,
        blockIndex,
        path,
      });
    }
  }

  // ── BreadcrumbList checks ───────────────────────────────────────────────
  if (types.includes('BreadcrumbList')) {
    const items = entity.itemListElement;
    if (!Array.isArray(items) || items.length === 0) {
      out.push({
        code: 'breadcrumb-empty',
        severity: 'warn',
        message: 'BreadcrumbList has no itemListElement entries.',
        blockIndex,
        path: joinPath(path, 'itemListElement'),
      });
    } else {
      const positions: number[] = [];
      items.forEach((item, i) => {
        const itemPath = joinPath(path, `itemListElement[${i}]`);
        if (!isRecord(item)) return;
        const pos = item.position;
        if (typeof pos !== 'number') {
          out.push({
            code: 'breadcrumb-missing-position',
            severity: 'warn',
            message: `Breadcrumb item ${i} is missing a numeric "position".`,
            blockIndex,
            path: itemPath,
          });
        } else {
          positions.push(pos);
        }
        if (!hasNonEmptyValue(item, 'name')) {
          out.push({
            code: 'breadcrumb-missing-name',
            severity: 'warn',
            message: `Breadcrumb item ${i} is missing "name".`,
            blockIndex,
            path: itemPath,
          });
        }
        if (!hasNonEmptyValue(item, 'item', '@id')) {
          out.push({
            code: 'breadcrumb-missing-item',
            severity: 'info',
            message: `Breadcrumb item ${i} has no "item" or "@id" URL — final crumb is allowed to omit this.`,
            blockIndex,
            path: itemPath,
          });
        }
      });
      // Positions should be 1, 2, 3, … contiguous. Catch the off-by-one
      // and "everyone uses 1" bugs.
      if (positions.length === items.length) {
        const sorted = [...positions].sort((a, b) => a - b);
        const expected = Array.from({ length: sorted.length }, (_, i) => i + 1);
        if (sorted.join(',') !== expected.join(',')) {
          out.push({
            code: 'breadcrumb-bad-positions',
            severity: 'warn',
            message: `Breadcrumb positions should be 1, 2, … ${items.length} (got [${sorted.join(', ')}]).`,
            blockIndex,
            path: joinPath(path, 'itemListElement'),
          });
        }
      }
    }
  }
}

/**
 * Validate every JSON-LD block on the page. Walks into `@graph` so each
 * inner entity is checked individually, and runs a cross-block pass to
 * catch duplicate `@id` values that would cause search engines to merge
 * entities.
 */
export function lintJsonLd(blocks: readonly unknown[]): JsonLdIssue[] {
  const issues: JsonLdIssue[] = [];
  const seenIds = new Map<string, number[]>();

  blocks.forEach((block, blockIndex) => {
    // Invalid blocks are surfaced by the card UI itself; skip them here.
    if (isRecord(block) && block.__invalid === true) return;

    // ── Universal: @context ───────────────────────────────────────────────
    if (isRecord(block)) {
      const ctx = block['@context'];
      if (ctx === undefined) {
        issues.push({
          code: 'missing-context',
          severity: 'error',
          message: 'Block is missing "@context" — required for JSON-LD.',
          blockIndex,
          path: '',
        });
      } else if (!isContextValueValid(ctx)) {
        issues.push({
          code: 'invalid-context',
          severity: 'error',
          message: `"@context" is not a recognized schema.org URL (got ${JSON.stringify(ctx)}).`,
          blockIndex,
          path: '@context',
        });
      }
    }

    // ── Walk @graph or just lint the root entity ─────────────────────────
    if (isRecord(block) && Array.isArray(block['@graph'])) {
      block['@graph'].forEach((entity, i) => {
        lintEntity(entity, blockIndex, `@graph[${i}]`, issues);
        collectIds(entity, blockIndex, `@graph[${i}]`, seenIds);
      });
    } else if (Array.isArray(block)) {
      block.forEach((entity, i) => {
        lintEntity(entity, blockIndex, `[${i}]`, issues);
        collectIds(entity, blockIndex, `[${i}]`, seenIds);
      });
    } else {
      lintEntity(block, blockIndex, '', issues);
      collectIds(block, blockIndex, '', seenIds);
    }
  });

  // ── Cross-block: duplicate @id ─────────────────────────────────────────
  for (const [id, occurrences] of seenIds) {
    if (occurrences.length > 1) {
      const uniqueBlocks = [...new Set(occurrences)].sort((a, b) => a - b);
      // Only flag duplicates that span multiple blocks; in-block dupes are
      // legal (e.g. an @id that's both a top-level entity and referenced
      // inside an @graph).
      if (uniqueBlocks.length > 1) {
        issues.push({
          code: 'duplicate-id',
          severity: 'warn',
          message: `@id ${JSON.stringify(id)} appears in blocks #${uniqueBlocks.map((i) => i + 1).join(', #')} — search engines may merge or drop entities.`,
          blockIndex: uniqueBlocks[0]!,
          path: '@id',
        });
      }
    }
  }

  return issues;
}

function collectIds(
  entity: unknown,
  blockIndex: number,
  _path: string,
  out: Map<string, number[]>
): void {
  if (!isRecord(entity)) return;
  const id = entity['@id'];
  if (typeof id === 'string' && id.trim()) {
    const list = out.get(id) ?? [];
    list.push(blockIndex);
    out.set(id, list);
  }
}

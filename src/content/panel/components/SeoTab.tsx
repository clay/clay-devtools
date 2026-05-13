import { useEffect, useMemo, useState } from 'react';
import { highlightJson } from '@/lib/json-highlight';
import {
  extractSeoMeta,
  lintJsonLd,
  lintSeo,
  summarizeJsonLd,
  type JsonLdIssue,
  type SeoIssue,
  type SeoMeta,
} from '@/lib/seo';
import { useCopyAction } from '../hooks/useCopyAction';
import { Icon } from './Icon';

const TONE: Record<SeoIssue['severity'], string> = {
  error: 'cs-seo-issue-error',
  warn: 'cs-seo-issue-warn',
  info: 'cs-seo-issue-info',
};

const SEVERITY_RANK: Record<SeoIssue['severity'], number> = { error: 0, warn: 1, info: 2 };

/** Pick the most important severity from a list of issues. */
function worstSeverity(
  issues: readonly { severity: SeoIssue['severity'] }[]
): SeoIssue['severity'] | null {
  if (issues.length === 0) return null;
  return issues.reduce<SeoIssue['severity']>(
    (worst, issue) =>
      SEVERITY_RANK[issue.severity] < SEVERITY_RANK[worst] ? issue.severity : worst,
    'info'
  );
}

function CardPreview({ meta, kind }: { meta: SeoMeta; kind: 'twitter' | 'facebook' }) {
  const title =
    (kind === 'twitter' && meta.twitter['twitter:title']) || meta.og['og:title'] || meta.title;
  const description =
    (kind === 'twitter' && meta.twitter['twitter:description']) ||
    meta.og['og:description'] ||
    meta.description;
  const image = (kind === 'twitter' && meta.twitter['twitter:image']) || meta.og['og:image'] || '';
  const host = (() => {
    try {
      return new URL(meta.canonical || location.href).hostname;
    } catch {
      return '';
    }
  })();

  return (
    <div className={`cs-seo-card cs-seo-card-${kind}`}>
      <div className="cs-seo-card-image">
        {image ? (
          <img src={image} alt="" />
        ) : (
          <div className="cs-seo-card-placeholder">No og:image</div>
        )}
      </div>
      <div className="cs-seo-card-body">
        <p className="cs-seo-card-host">{host}</p>
        <p className="cs-seo-card-title">{title || 'Untitled'}</p>
        <p className="cs-seo-card-desc">{description || 'No description set.'}</p>
      </div>
    </div>
  );
}

function JsonLdBlockCard({
  block,
  index,
  issues,
}: {
  block: unknown;
  index: number;
  issues: readonly JsonLdIssue[];
}) {
  // Open by default if the block has any errors so the user immediately
  // sees what's wrong without an extra click.
  const hasError = issues.some((i) => i.severity === 'error');
  const [open, setOpen] = useState(hasError);
  const summary = summarizeJsonLd(block);
  const headerSeverity = worstSeverity(issues);
  const { copy, copiedKey } = useCopyAction();
  const copied = copiedKey === 'default';

  const onCopy = (e: React.MouseEvent) => {
    // Prevent the click from toggling the <details> open state.
    e.preventDefault();
    e.stopPropagation();
    const text =
      summary.invalid && isInvalidBlock(block) ? (block.raw ?? '') : JSON.stringify(block, null, 2);
    void copy(text, `JSON-LD block #${index + 1}`);
  };

  const cardClasses = ['cs-jsonld-card'];
  if (summary.invalid) cardClasses.push('cs-jsonld-card-invalid');
  if (headerSeverity === 'error') cardClasses.push('cs-jsonld-card-has-error');
  else if (headerSeverity === 'warn') cardClasses.push('cs-jsonld-card-has-warn');

  return (
    <details
      className={cardClasses.join(' ')}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cs-jsonld-summary">
        <span className="cs-jsonld-chevron" aria-hidden="true">
          ▶
        </span>
        <span className="cs-jsonld-index">#{index + 1}</span>
        <span className="cs-jsonld-type" title={summary.typeLabel}>
          {summary.typeLabel}
          {summary.itemCount !== null && (
            <span className="cs-jsonld-count">
              {' '}
              · {summary.itemCount} item{summary.itemCount === 1 ? '' : 's'}
            </span>
          )}
        </span>
        {summary.secondary && (
          <span className="cs-jsonld-secondary" title={summary.secondary}>
            {summary.secondary}
          </span>
        )}
        {issues.length > 0 && (
          <span
            className={`cs-jsonld-badge cs-jsonld-badge-${headerSeverity}`}
            title={`${issues.length} ${headerSeverity === 'error' ? 'error' : headerSeverity === 'warn' ? 'warning' : 'note'}${issues.length === 1 ? '' : 's'}`}
          >
            {headerSeverity === 'error' ? '✕' : headerSeverity === 'warn' ? '!' : 'i'}{' '}
            {issues.length}
          </span>
        )}
        <button
          type="button"
          className={`cs-icon-btn cs-jsonld-copy ${copied ? 'cs-icon-btn-copied' : ''}`}
          onClick={onCopy}
          aria-label={
            copied ? `JSON-LD block ${index + 1} copied` : `Copy JSON-LD block ${index + 1}`
          }
          title={copied ? 'Copied!' : 'Copy JSON to clipboard'}
        >
          <Icon name={copied ? 'check' : 'copy'} />
        </button>
      </summary>
      {/* Body is only mounted once expanded — saves the syntax-highlight
          regex pass on big @graph payloads when the user never opens them. */}
      {open && (
        <>
          {issues.length > 0 && (
            <ul className="cs-jsonld-issues">
              {issues.map((issue, i) => (
                <li key={`${issue.code}-${i}`} className={`cs-seo-issue ${TONE[issue.severity]}`}>
                  <span className="cs-seo-issue-tag">{issue.severity}</span>
                  <span className="cs-jsonld-issue-body">
                    {issue.message}
                    {issue.path && (
                      <code className="cs-jsonld-issue-path" title={issue.path}>
                        {issue.path}
                      </code>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {summary.invalid && isInvalidBlock(block) ? (
            <div className="cs-jsonld-body">
              <p className="cs-jsonld-error">
                This block isn&rsquo;t valid JSON. Showing the raw script contents:
              </p>
              <pre className="cs-jsonld-raw">{block.raw ?? '(empty)'}</pre>
            </div>
          ) : (
            <pre
              className="cs-json cs-jsonld-body"
              dangerouslySetInnerHTML={{ __html: highlightJson(block) }}
            />
          )}
        </>
      )}
    </details>
  );
}

function isInvalidBlock(block: unknown): block is { __invalid: true; raw: string | null } {
  return (
    typeof block === 'object' &&
    block !== null &&
    (block as { __invalid?: unknown }).__invalid === true
  );
}

function JsonLdSection({ blocks }: { blocks: readonly unknown[] }) {
  // Lint once at the section level and group by blockIndex so each card
  // only re-renders when its own slice of issues changes. Issues for the
  // duplicate-@id check (which span multiple blocks) attach to the
  // earliest block by design — see lintJsonLd.
  const issuesByBlock = useMemo(() => {
    const all = lintJsonLd(blocks);
    const map = new Map<number, JsonLdIssue[]>();
    for (const issue of all) {
      const list = map.get(issue.blockIndex) ?? [];
      list.push(issue);
      map.set(issue.blockIndex, list);
    }
    return map;
  }, [blocks]);

  if (blocks.length === 0) return null;

  const errorCount = [...issuesByBlock.values()]
    .flat()
    .filter((i) => i.severity === 'error').length;
  const warnCount = [...issuesByBlock.values()].flat().filter((i) => i.severity === 'warn').length;

  return (
    <section className="cs-section">
      <h4 className="cs-section-title">
        Structured data (JSON-LD){' '}
        <span className="cs-section-count">
          · {blocks.length} block{blocks.length === 1 ? '' : 's'}
          {errorCount > 0 && (
            <span className="cs-jsonld-badge cs-jsonld-badge-error cs-jsonld-badge-inline">
              ✕ {errorCount} error{errorCount === 1 ? '' : 's'}
            </span>
          )}
          {warnCount > 0 && (
            <span className="cs-jsonld-badge cs-jsonld-badge-warn cs-jsonld-badge-inline">
              ! {warnCount} warning{warnCount === 1 ? '' : 's'}
            </span>
          )}
        </span>
      </h4>
      <div className="cs-jsonld-list">
        {blocks.map((block, i) => (
          <JsonLdBlockCard key={i} block={block} index={i} issues={issuesByBlock.get(i) ?? []} />
        ))}
      </div>
    </section>
  );
}

export function SeoTab() {
  const [meta, setMeta] = useState<SeoMeta>(() => extractSeoMeta());

  useEffect(() => {
    const observer = new MutationObserver(() => setMeta(extractSeoMeta()));
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  const issues = lintSeo(meta);

  return (
    <div className="cs-seo">
      <section className="cs-section">
        <h4 className="cs-section-title">Page basics</h4>
        <dl className="cs-seo-list">
          <div>
            <dt>Title</dt>
            <dd>
              {meta.title || <em>—</em>}
              <span className="cs-seo-len">({meta.title.length})</span>
            </dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>
              {meta.description || <em>—</em>}
              <span className="cs-seo-len">({meta.description.length})</span>
            </dd>
          </div>
          <div>
            <dt>Canonical</dt>
            <dd>{meta.canonical || <em>—</em>}</dd>
          </div>
          <div>
            <dt>Robots</dt>
            <dd>{meta.robots || <em>default</em>}</dd>
          </div>
          <div>
            <dt>JSON-LD</dt>
            <dd>
              {meta.jsonLd.length === 0 ? (
                <em>none</em>
              ) : (
                <>
                  {meta.jsonLd.length} block{meta.jsonLd.length === 1 ? '' : 's'}{' '}
                  <span className="cs-seo-len">(see below)</span>
                </>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="cs-section">
        <h4 className="cs-section-title">Twitter card preview</h4>
        <CardPreview meta={meta} kind="twitter" />
      </section>

      <section className="cs-section">
        <h4 className="cs-section-title">Facebook / Slack preview</h4>
        <CardPreview meta={meta} kind="facebook" />
      </section>

      <JsonLdSection blocks={meta.jsonLd} />

      {issues.length > 0 && (
        <section className="cs-section">
          <h4 className="cs-section-title">Issues ({issues.length})</h4>
          <ul className="cs-seo-issues">
            {issues.map((i) => (
              <li key={i.id} className={`cs-seo-issue ${TONE[i.severity]}`}>
                <span className="cs-seo-issue-tag">{i.severity}</span>
                {i.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

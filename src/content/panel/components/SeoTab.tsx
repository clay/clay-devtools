import { useEffect, useState } from 'react';
import { copyToClipboard } from '@/lib/clipboard';
import { highlightJson } from '@/lib/json-highlight';
import { extractSeoMeta, lintSeo, summarizeJsonLd, type SeoIssue, type SeoMeta } from '@/lib/seo';
import { useStore } from '../store';
import { Icon } from './Icon';

const TONE: Record<SeoIssue['severity'], string> = {
  error: 'cs-seo-issue-error',
  warn: 'cs-seo-issue-warn',
  info: 'cs-seo-issue-info',
};

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

function JsonLdBlockCard({ block, index }: { block: unknown; index: number }) {
  const pushToast = useStore((s) => s.pushToast);
  const [open, setOpen] = useState(false);
  const summary = summarizeJsonLd(block);

  const onCopy = async (e: React.MouseEvent) => {
    // Prevent the click from toggling the <details> open state.
    e.preventDefault();
    e.stopPropagation();
    const text =
      summary.invalid && isInvalidBlock(block) ? (block.raw ?? '') : JSON.stringify(block, null, 2);
    const ok = await copyToClipboard(text);
    pushToast(ok ? `Copied JSON-LD block #${index + 1}` : 'Copy failed', ok ? 'success' : 'error');
  };

  return (
    <details
      className={`cs-jsonld-card${summary.invalid ? ' cs-jsonld-card-invalid' : ''}`}
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
        <button
          type="button"
          className="cs-icon-btn cs-jsonld-copy"
          onClick={onCopy}
          aria-label={`Copy JSON-LD block ${index + 1}`}
          title="Copy JSON to clipboard"
        >
          <Icon name="copy" />
        </button>
      </summary>
      {/* Body is only mounted once expanded — saves the syntax-highlight
          regex pass on big @graph payloads when the user never opens them. */}
      {open &&
        (summary.invalid && isInvalidBlock(block) ? (
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
        ))}
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
  if (blocks.length === 0) return null;
  return (
    <section className="cs-section">
      <h4 className="cs-section-title">
        Structured data (JSON-LD){' '}
        <span className="cs-section-count">
          · {blocks.length} block{blocks.length === 1 ? '' : 's'}
        </span>
      </h4>
      <div className="cs-jsonld-list">
        {blocks.map((block, i) => (
          <JsonLdBlockCard key={i} block={block} index={i} />
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

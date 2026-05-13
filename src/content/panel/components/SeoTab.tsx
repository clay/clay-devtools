import { useEffect, useState } from 'react';
import { extractSeoMeta, lintSeo, type SeoIssue, type SeoMeta } from '@/lib/seo';

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
            <dd>{meta.jsonLd.length} block(s)</dd>
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

import { buildEditorUrl, buildUrl, unpublishedUri } from '@/lib/clay-uri';
import { findMappingForHost, rewriteUrlToEnv } from '@/lib/site-host';
import { SITE_ENV_LABELS, SITE_ENV_ORDER, type RuntimeMessage } from '@/lib/types';
import { useStore } from '../store';
import { CopyableUri } from './CopyableUri';
import { Icon } from './Icon';
import { ExportMenu } from './ExportMenu';

export function PageInfo() {
  const page = useStore((s) => s.page);
  const siteHosts = useStore((s) => s.preferences.siteHosts);
  if (!page) return null;

  const open = (url: string) => {
    chrome.runtime.sendMessage({ type: 'OPEN_TAB', url } satisfies RuntimeMessage);
  };

  // No envHost override: the helpers use the URI's embedded host, which
  // is the page's actual host. For cross-env links the user goes through
  // the "View on…" pills (siteHosts mapping) below — there's no longer a
  // global "default environment" that mass-rewrites every link.
  const currentHost = location.hostname;
  const match = findMappingForHost(currentHost, siteHosts);
  const viewOnTargets = match
    ? SITE_ENV_ORDER.filter((env) => env !== match.env && Boolean(match.mapping.hosts[env])).map(
        (env) => ({
          env,
          label: SITE_ENV_LABELS[env],
          url: rewriteUrlToEnv(location.href, env, siteHosts),
        })
      )
    : [];

  return (
    <section className="cs-section">
      <h4 className="cs-section-title">Page</h4>
      <p className="cs-name">{page.pageInstance ?? 'Unknown page'}</p>
      <CopyableUri uri={page.pageUri} label="Page URI" />
      <div className="cs-link-row">
        <button
          className="cs-link cs-link-primary"
          onClick={() => open(buildUrl(page.pageUri, ''))}
        >
          <Icon name="external" size={11} /> Page
        </button>
        <button
          className="cs-link cs-link-edit"
          onClick={() => open(buildEditorUrl(page.pageUri))}
          title="Open this page in Clay edit mode"
        >
          <Icon name="edit" size={11} /> Edit
        </button>
        <button className="cs-link" onClick={() => open(buildUrl(page.pageUri, '/meta'))}>
          Metadata
        </button>
        {page.layoutUri !== null && (
          <button className="cs-link" onClick={() => open(buildUrl(page.layoutUri!, ''))}>
            Layout
          </button>
        )}
        {page.isPublished && (
          <>
            <button
              className="cs-link"
              onClick={() => open(buildUrl(unpublishedUri(page.pageUri), ''))}
            >
              Unpublished Page
            </button>
            {page.layoutUri !== null && (
              <button
                className="cs-link"
                onClick={() => open(buildUrl(unpublishedUri(page.layoutUri!), ''))}
              >
                Unpublished Layout
              </button>
            )}
          </>
        )}
        <ExportMenu />
      </div>
      {match && viewOnTargets.length > 0 && (
        <div className="cs-view-on" title={`This page is on ${match.mapping.label || currentHost}`}>
          <span className="cs-view-on-label">View on:</span>
          {viewOnTargets.map(({ env, label, url }) => (
            <button
              key={env}
              className="cs-view-on-pill"
              disabled={!url}
              onClick={() => url && open(url)}
              title={url ?? `No host configured for ${label}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

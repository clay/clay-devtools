import { buildUrl, unpublishedUri } from '@/lib/clay-uri';
import type { RuntimeMessage } from '@/lib/types';
import { useStore } from '../store';
import { Icon } from './Icon';

export function PageInfo() {
  const page = useStore((s) => s.page);
  if (!page) return null;

  const open = (url: string) => {
    chrome.runtime.sendMessage({ type: 'OPEN_TAB', url } satisfies RuntimeMessage);
  };

  return (
    <section className="cs-section">
      <h4 className="cs-section-title">Page</h4>
      <p className="cs-name">{page.pageInstance ?? 'Unknown page'}</p>
      <p className="cs-instance">{page.pageUri}</p>
      <div className="cs-link-row">
        <button className="cs-link cs-link-primary" onClick={() => open(buildUrl(page.pageUri))}>
          <Icon name="external" size={11} /> Page
        </button>
        <button className="cs-link" onClick={() => open(buildUrl(page.pageUri, '/meta'))}>
          Metadata
        </button>
        {page.layoutUri !== null && (
          <button className="cs-link" onClick={() => open(buildUrl(page.layoutUri!))}>
            Layout
          </button>
        )}
        {page.isPublished && (
          <>
            <button
              className="cs-link"
              onClick={() => open(buildUrl(unpublishedUri(page.pageUri)))}
            >
              Unpublished Page
            </button>
            {page.layoutUri !== null && (
              <button
                className="cs-link"
                onClick={() => open(buildUrl(unpublishedUri(page.layoutUri!)))}
              >
                Unpublished Layout
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

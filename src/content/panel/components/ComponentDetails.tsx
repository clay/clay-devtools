import { buildCurlCommand, buildSchemaUrl, buildUrl, unpublishedUri } from '@/lib/clay-uri';
import { copyToClipboard } from '@/lib/clipboard';
import type { RuntimeMessage } from '@/lib/types';
import { useStore } from '../store';
import { Icon } from './Icon';
import { Breadcrumb } from './Breadcrumb';

export function ComponentDetails() {
  const selected = useStore((s) => s.selected);
  const pushToast = useStore((s) => s.pushToast);

  if (!selected) {
    return (
      <section className="cs-section">
        <div className="cs-empty">Click any component on the page to inspect it.</div>
      </section>
    );
  }

  const open = (url: string) => {
    chrome.runtime.sendMessage({ type: 'OPEN_TAB', url } satisfies RuntimeMessage);
  };

  const copy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    pushToast(ok ? `${label} copied` : 'Copy failed', ok ? 'success' : 'error');
  };

  const isPublished = selected.uri.includes('@published');
  const schemaUrl = buildSchemaUrl(selected.uri);

  return (
    <section className="cs-section">
      <h4 className="cs-section-title">Component</h4>
      <Breadcrumb />
      <p className="cs-name">{selected.displayName}</p>
      {selected.instance && <p className="cs-instance">{selected.instance}</p>}
      <div className="cs-link-row">
        <button className="cs-link cs-link-primary" onClick={() => open(buildUrl(selected.uri))}>
          <Icon name="external" size={11} /> Data
        </button>
        <button className="cs-link" onClick={() => open(buildUrl(selected.uri, '.json'))}>
          .json
        </button>
        <button className="cs-link" onClick={() => open(buildUrl(selected.uri, '.html'))}>
          .html
        </button>
        {schemaUrl && (
          <button className="cs-link" onClick={() => open(schemaUrl)}>
            Schema
          </button>
        )}
        {isPublished && (
          <button className="cs-link" onClick={() => open(buildUrl(unpublishedUri(selected.uri)))}>
            Unpublished
          </button>
        )}
        <button className="cs-link" onClick={() => copy(selected.uri, 'URI')} title="Copy URI">
          <Icon name="copy" size={11} /> Copy URI
        </button>
        <button
          className="cs-link"
          onClick={() => copy(buildCurlCommand(selected.uri), 'cURL command')}
          title="Copy as cURL"
        >
          cURL
        </button>
      </div>
    </section>
  );
}

import {
  buildCurlCommand,
  buildSchemaUrl,
  buildUrl,
  copyAsCssSelector,
  copyAsFetchSnippet,
  unpublishedUri,
} from '@/lib/clay-uri';
import { copyToClipboard } from '@/lib/clipboard';
import { captureElementToClipboard } from '@/lib/screenshot';
import type { RuntimeMessage } from '@/lib/types';
import { getPanelHost } from '../../shadow-host';
import { useEnvHost, useStore } from '../store';
import { Icon } from './Icon';
import { Breadcrumb } from './Breadcrumb';
import { AnnotationEditor } from './AnnotationEditor';
import { ShareMenu } from './ShareMenu';

export function ComponentDetails() {
  const selected = useStore((s) => s.selected);
  const pushToast = useStore((s) => s.pushToast);
  const envHost = useEnvHost();

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

  const screenshot = async () => {
    try {
      const ok = await captureElementToClipboard(selected.element, getPanelHost());
      pushToast(
        ok ? 'Screenshot copied to clipboard' : 'Screenshot failed',
        ok ? 'success' : 'error'
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Screenshot failed', 'error');
    }
  };

  const isPublished = selected.uri.includes('@published');
  const schemaUrl = buildSchemaUrl(selected.uri, envHost);

  return (
    <section className="cs-section">
      <h4 className="cs-section-title">Component</h4>
      <Breadcrumb />
      <p className="cs-name">{selected.displayName}</p>
      {selected.instance && <p className="cs-instance">{selected.instance}</p>}
      <div className="cs-link-row">
        <button
          className="cs-link cs-link-primary"
          onClick={() => open(buildUrl(selected.uri, '', envHost))}
        >
          <Icon name="external" size={11} /> Data
        </button>
        <button className="cs-link" onClick={() => open(buildUrl(selected.uri, '.json', envHost))}>
          .json
        </button>
        <button className="cs-link" onClick={() => open(buildUrl(selected.uri, '.html', envHost))}>
          .html
        </button>
        {schemaUrl && (
          <button className="cs-link" onClick={() => open(schemaUrl)}>
            Schema
          </button>
        )}
        {isPublished && (
          <button
            className="cs-link"
            onClick={() => open(buildUrl(unpublishedUri(selected.uri), '', envHost))}
          >
            Unpublished
          </button>
        )}
        <ShareMenu uri={selected.uri} />
        <button className="cs-link" onClick={screenshot} title="Copy a PNG of this component">
          <Icon name="camera" size={11} /> Screenshot
        </button>
      </div>

      <details className="cs-copy-as">
        <summary>Copy as…</summary>
        <div className="cs-link-row">
          <button className="cs-link" onClick={() => copy(selected.uri, 'URI')}>
            <Icon name="copy" size={11} /> URI
          </button>
          <button
            className="cs-link"
            onClick={() => copy(buildCurlCommand(selected.uri, '.json', envHost), 'cURL command')}
          >
            cURL
          </button>
          <button
            className="cs-link"
            onClick={() => copy(copyAsFetchSnippet(selected.uri, envHost), 'fetch() snippet')}
          >
            fetch()
          </button>
          <button
            className="cs-link"
            onClick={() => copy(copyAsCssSelector(selected.uri), 'CSS selector')}
          >
            CSS
          </button>
        </div>
      </details>

      <AnnotationEditor uri={selected.uri} displayName={selected.displayName} />
    </section>
  );
}

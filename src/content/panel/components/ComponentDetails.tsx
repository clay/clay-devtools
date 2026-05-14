import {
  buildCurlCommand,
  buildSchemaUrl,
  buildUrl,
  copyAsCssSelector,
  copyAsFetchSnippet,
  ensureProtocol,
  isEditMode,
  unpublishedUri,
} from '@/lib/clay-uri';
import { captureElementToClipboard } from '@/lib/screenshot';
import type { RuntimeMessage } from '@/lib/types';
import { getPanelHost } from '../../shadow-host';
import { useCopyAction } from '../hooks/useCopyAction';
import { useStore } from '../store';
import { CopyableUri } from './CopyableUri';
import { Icon } from './Icon';
import { Breadcrumb } from './Breadcrumb';
import { AnnotationEditor } from './AnnotationEditor';
import { ShareMenu } from './ShareMenu';

export function ComponentDetails() {
  const selected = useStore((s) => s.selected);
  const pushToast = useStore((s) => s.pushToast);
  // Each "Copy as…" button needs its own inline-feedback signal so a click
  // on cURL doesn't make every button flash "Copied". The hook tracks the
  // most-recently-used key; siblings compare against it.
  const { copy, copiedKey } = useCopyAction();

  if (!selected) {
    // On edit-mode pages we don't install host-page click listeners (Clay's
    // own editor owns clicks there), so the usual "click any component on
    // the page" hint would be misleading. Point users at the Tree tab,
    // which still works in passive mode.
    const hint = isEditMode()
      ? 'Page is in Clay edit mode — pick a component from the Tree tab to inspect it.'
      : 'Click any component on the page to inspect it.';
    return (
      <section className="cs-section">
        <div className="cs-empty">{hint}</div>
      </section>
    );
  }

  const open = (url: string) => {
    chrome.runtime.sendMessage({ type: 'OPEN_TAB', url } satisfies RuntimeMessage);
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
  // No host override: helpers use the URI's embedded host. For
  // cross-env switching the user goes through the Diff tab or the
  // Share menu's site-host-mapping pills — we no longer have a global
  // "default environment" that mass-rewrites every link.
  const schemaUrl = buildSchemaUrl(selected.uri);

  return (
    <section className="cs-section">
      <h4 className="cs-section-title">Component</h4>
      <Breadcrumb />
      <p className="cs-name">{selected.displayName}</p>
      {/* Copy yields the *full* URI even though the displayed text is the
          shorter instance id — most consumers (Clay tools, fetch URLs, etc.)
          want the URI, not just the suffix. The full URI surfaces in the
          tooltip on hover so it's still discoverable. */}
      <CopyableUri
        uri={selected.uri}
        displayText={selected.instance ?? selected.uri}
        label="Component URI"
      />
      <div className="cs-link-row">
        <button
          className="cs-link cs-link-primary"
          onClick={() => open(buildUrl(selected.uri, ''))}
        >
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
          <button
            className="cs-link"
            onClick={() => open(buildUrl(unpublishedUri(selected.uri), ''))}
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
          <button
            className={`cs-link ${copiedKey === 'uri' ? 'cs-link-copied' : ''}`}
            onClick={() => copy(ensureProtocol(selected.uri), 'URI', 'uri')}
          >
            <Icon name={copiedKey === 'uri' ? 'check' : 'copy'} size={11} />{' '}
            {copiedKey === 'uri' ? 'Copied' : 'URI'}
          </button>
          <button
            className={`cs-link ${copiedKey === 'curl' ? 'cs-link-copied' : ''}`}
            onClick={() => copy(buildCurlCommand(selected.uri, '.json'), 'cURL command', 'curl')}
          >
            {copiedKey === 'curl' ? (
              <>
                <Icon name="check" size={11} /> Copied
              </>
            ) : (
              'cURL'
            )}
          </button>
          <button
            className={`cs-link ${copiedKey === 'fetch' ? 'cs-link-copied' : ''}`}
            onClick={() => copy(copyAsFetchSnippet(selected.uri), 'fetch() snippet', 'fetch')}
          >
            {copiedKey === 'fetch' ? (
              <>
                <Icon name="check" size={11} /> Copied
              </>
            ) : (
              'fetch()'
            )}
          </button>
          <button
            className={`cs-link ${copiedKey === 'css' ? 'cs-link-copied' : ''}`}
            onClick={() => copy(copyAsCssSelector(selected.uri), 'CSS selector', 'css')}
          >
            {copiedKey === 'css' ? (
              <>
                <Icon name="check" size={11} /> Copied
              </>
            ) : (
              'CSS'
            )}
          </button>
        </div>
      </details>

      <AnnotationEditor uri={selected.uri} displayName={selected.displayName} />
    </section>
  );
}

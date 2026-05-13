import { copyToClipboard } from '@/lib/clipboard';
import { useStore } from '../store';
import { Icon } from './Icon';

interface CopyableUriProps {
  /** The string actually written to the clipboard. */
  readonly uri: string;
  /**
   * Optional shorter text to display in the row. Defaults to `uri`. Useful
   * for component rows where the visible label is the instance ID but the
   * value worth copying is the full URI.
   */
  readonly displayText?: string;
  /** Used in the toast + accessible label, e.g. "Page URI" or "Component URI". */
  readonly label: string;
}

/**
 * A URI rendered in muted monospace with a copy-icon button on the right
 * of the same row. Hover (and keyboard focus) brightens the button so the
 * affordance is discoverable but not visually noisy at rest.
 */
export function CopyableUri({ uri, displayText, label }: CopyableUriProps) {
  const pushToast = useStore((s) => s.pushToast);

  const onCopy = async () => {
    const ok = await copyToClipboard(uri);
    pushToast(ok ? `${label} copied` : 'Copy failed', ok ? 'success' : 'error');
  };

  // When the displayed text differs from the value being copied (component
  // rows show the instance id, copy yields the full URI), surface the full
  // URI in the tooltip so it's still discoverable.
  const tooltip =
    displayText && displayText !== uri
      ? `Copy ${label} to clipboard\n${uri}`
      : `Copy ${label} to clipboard`;

  return (
    <div className="cs-uri-row">
      <p className="cs-instance cs-uri-row-text">{displayText ?? uri}</p>
      <button
        type="button"
        className="cs-icon-btn cs-uri-row-copy"
        onClick={onCopy}
        title={tooltip}
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        <Icon name="copy" size={12} />
      </button>
    </div>
  );
}

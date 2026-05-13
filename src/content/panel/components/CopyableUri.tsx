import { ensureProtocol } from '@/lib/clay-uri';
import { useCopyAction } from '../hooks/useCopyAction';
import { Icon } from './Icon';

interface CopyableUriProps {
  /**
   * The Clay URI being represented. The actual string written to the
   * clipboard is `ensureProtocol(uri)` so the user always pastes a
   * fully-qualified URL — bare URIs aren't useful in a browser bar,
   * curl, or chat tool.
   */
  readonly uri: string;
  /**
   * Optional shorter text to display in the row. Defaults to `uri`.
   * Useful for component rows where the visible label is the instance ID
   * but the value worth copying is the full URI.
   */
  readonly displayText?: string;
  /** Used in the toast + accessible label, e.g. "Page URI" or "Component URI". */
  readonly label: string;
}

/**
 * A URI rendered in muted monospace with a copy-icon button on the right
 * of the same row. Hover (and keyboard focus) brightens the button so the
 * affordance is discoverable but not visually noisy at rest.
 *
 * After a successful copy the icon swaps to a checkmark and the button
 * picks up the `cs-uri-row-copy-copied` modifier class for ~1.5s, giving
 * the user co-located confirmation without forcing them to hunt for the
 * toast at the bottom of the panel.
 */
export function CopyableUri({ uri, displayText, label }: CopyableUriProps) {
  const { copy, copiedKey } = useCopyAction();
  const copied = copiedKey === 'default';

  const onCopy = () => {
    void copy(ensureProtocol(uri), label);
  };

  // The display text in the row stays as-is (short, clean, no scheme). The
  // tooltip surfaces the *exact* string that will be copied so power users
  // can verify the URL form before pasting.
  const copiedText = ensureProtocol(uri);
  const tooltip = copied
    ? 'Copied!'
    : displayText && displayText !== copiedText
      ? `Copy ${label} to clipboard\n${copiedText}`
      : `Copy ${label} to clipboard`;

  return (
    <div className="cs-uri-row">
      <p className="cs-instance cs-uri-row-text">{displayText ?? uri}</p>
      <button
        type="button"
        className={`cs-icon-btn cs-uri-row-copy ${copied ? 'cs-uri-row-copy-copied' : ''}`}
        onClick={onCopy}
        title={tooltip}
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      >
        <Icon name={copied ? 'check' : 'copy'} size={12} />
      </button>
    </div>
  );
}

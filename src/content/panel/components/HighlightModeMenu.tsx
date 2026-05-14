import { useEffect, useRef } from 'react';
import {
  HIGHLIGHT_MODE_DESCRIPTIONS,
  HIGHLIGHT_MODE_LABELS,
  HIGHLIGHT_MODE_ORDER,
  type HighlightMode,
} from '@/lib/types';
import { Icon } from './Icon';
import { useStore } from '../store';

/**
 * Header control that surfaces the four highlight modes
 * (off / selection / editable / all). Uses a native `<details>` disclosure
 * so we get click-outside-to-close, keyboard activation, and accessibility
 * for free without a focus-trap library.
 *
 * The icon swaps based on the active mode:
 *   off       → eyeOff (clear "nothing is being shown" affordance)
 *   selection → eye    (default-state vibe)
 *   editable  → eye    (also "watching", just narrower)
 *   all       → eye    (full visibility)
 *
 * The mode label sits next to the icon so the active state is glanceable
 * without opening the menu.
 */
export function HighlightModeMenu() {
  const mode = useStore((s) => s.preferences.highlightMode);
  const setHighlightMode = useStore((s) => s.setHighlightMode);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Close the menu when the user clicks anywhere outside of it. Without
  // this, the disclosure happily stays open until the next click on the
  // summary itself, which feels like a bug compared to every other
  // popover in the app.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = detailsRef.current;
      if (!el || !el.open) return;
      const path = e.composedPath();
      if (path.includes(el)) return;
      el.open = false;
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const onPick = (next: HighlightMode) => {
    setHighlightMode(next);
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details className="cs-mode-menu" ref={detailsRef}>
      <summary
        className={`cs-icon-btn cs-mode-trigger ${mode === 'off' ? 'cs-icon-btn-off' : ''}`}
        title={`Highlight: ${HIGHLIGHT_MODE_LABELS[mode]} (h to cycle)`}
        aria-label={`Highlight mode: ${HIGHLIGHT_MODE_LABELS[mode]}`}
      >
        <Icon name={mode === 'off' ? 'eyeOff' : 'eye'} />
        <span className="cs-mode-trigger-label">{compactLabel(mode)}</span>
      </summary>
      <div className="cs-mode-popover" role="menu">
        <div className="cs-mode-popover-header">Highlight mode</div>
        {HIGHLIGHT_MODE_ORDER.map((m) => (
          <button
            key={m}
            type="button"
            role="menuitemradio"
            aria-checked={mode === m}
            className={`cs-mode-option ${mode === m ? 'cs-mode-option-active' : ''}`}
            onClick={() => onPick(m)}
          >
            <span className="cs-mode-option-bullet" aria-hidden="true">
              {mode === m ? '●' : '○'}
            </span>
            <span className="cs-mode-option-text">
              <span className="cs-mode-option-label">{HIGHLIGHT_MODE_LABELS[m]}</span>
              <span className="cs-mode-option-help">{HIGHLIGHT_MODE_DESCRIPTIONS[m]}</span>
            </span>
          </button>
        ))}
      </div>
    </details>
  );
}

/**
 * Header real estate is tight, so we abbreviate the label next to the icon.
 *
 * `selection` shows `Sel ⌥` (with the keycap glyph) so the modifier-gated
 * "peek at all components" gesture is glanceable from the header without
 * needing to open the popover. The symbol works on every modern browser
 * font without an icon font.
 */
function compactLabel(mode: HighlightMode): string {
  switch (mode) {
    case 'off':
      return 'Off';
    case 'selection':
      return 'Sel ⌥';
    case 'editable':
      return 'Edit';
    case 'all':
      return 'All';
  }
}

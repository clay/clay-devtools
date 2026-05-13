import { Icon } from './Icon';
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts';
import { useStore } from '../store';

export function ShortcutOverlay() {
  const visible = useStore((s) => s.showShortcuts);
  const close = useStore((s) => s.toggleShortcuts);

  if (!visible) return null;

  return (
    <div
      className="cs-shortcut-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="cs-shortcut-card">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, flex: 1, fontWeight: 600 }}>Keyboard Shortcuts</h3>
          <button className="cs-icon-btn" onClick={close} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {SHORTCUTS.map((s) => (
          <div className="cs-shortcut-row" key={s.description}>
            <span style={{ color: 'var(--cs-text-muted)' }}>{s.description}</span>
            <span style={{ display: 'flex', gap: 4 }}>
              {s.keys.map((k, i) => (
                <span key={`${k}-${i}`} className="cs-kbd">
                  {k}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

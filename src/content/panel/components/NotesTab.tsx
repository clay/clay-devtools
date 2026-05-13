import type { RuntimeMessage } from '@/lib/types';
import { deleteAnnotation } from '@/lib/annotations';
import { useStore } from '../store';
import { setSelected } from '../../highlighter';

export function NotesTab() {
  const annotations = useStore((s) => s.annotations);
  const components = useStore((s) => s.components);
  const setSelectedStore = useStore((s) => s.setSelected);
  const selected = useStore((s) => s.selected);
  const pushToast = useStore((s) => s.pushToast);

  if (!annotations.length) {
    return (
      <div className="cs-empty">
        No notes yet. Select a component on the Inspect tab and add a sticky note — it will appear
        here, with an orange dot on the component itself when Slip is open.
      </div>
    );
  }

  const open = (url: string) => {
    chrome.runtime.sendMessage({ type: 'OPEN_TAB', url } satisfies RuntimeMessage);
  };

  return (
    <section className="cs-section">
      <h4 className="cs-section-title">Notes ({annotations.length})</h4>
      <ul className="cs-notes">
        {annotations.map((a) => {
          const onPage = components.find((c) => c.uri === a.uri);
          return (
            <li key={a.uri} className="cs-notes-item">
              <div className="cs-notes-header">
                <button
                  className="cs-notes-title"
                  onClick={() => {
                    if (onPage) {
                      setSelected(selected?.element ?? null, onPage.element);
                      setSelectedStore(onPage);
                      onPage.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                      open(a.pageUrl);
                    }
                  }}
                  title={onPage ? 'Select on this page' : 'Open the page where it lives'}
                >
                  {a.displayName}
                  {onPage && <span className="cs-recents-here"> · here</span>}
                </button>
                <button
                  className="cs-link"
                  onClick={async () => {
                    await deleteAnnotation(a.uri);
                    pushToast('Note deleted', 'info');
                  }}
                >
                  Delete
                </button>
              </div>
              <p className="cs-notes-body">{a.note}</p>
              <p className="cs-notes-meta">
                {a.pageTitle || a.pageUrl} · {new Date(a.updatedAt).toLocaleString()}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

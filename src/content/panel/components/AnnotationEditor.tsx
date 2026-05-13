import { useEffect, useState } from 'react';
import { deleteAnnotation, getAnnotation, upsertAnnotation } from '@/lib/annotations';
import { useStore } from '../store';

interface Props {
  uri: string;
  displayName: string;
}

export function AnnotationEditor({ uri, displayName }: Props) {
  const [draft, setDraft] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [prevUri, setPrevUri] = useState(uri);
  const pushToast = useStore((s) => s.pushToast);

  if (prevUri !== uri) {
    setPrevUri(uri);
    setDraft('');
    setSavedNote('');
    setSavedAt(null);
  }

  useEffect(() => {
    let cancelled = false;
    getAnnotation(uri).then((a) => {
      if (cancelled) return;
      setSavedNote(a?.note ?? '');
      setDraft(a?.note ?? '');
      setSavedAt(a?.updatedAt ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const dirty = draft !== savedNote;

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      await deleteAnnotation(uri);
      setSavedNote('');
      setSavedAt(null);
      pushToast('Note deleted', 'info');
      return;
    }
    const a = await upsertAnnotation({
      uri,
      note: trimmed,
      displayName,
      pageUrl: location.href,
      pageTitle: document.title,
    });
    setSavedNote(a.note);
    setSavedAt(a.updatedAt);
    pushToast('Note saved', 'success');
  };

  return (
    <div className="cs-annotation">
      <h4 className="cs-section-title">
        Note
        {savedAt && (
          <span className="cs-annotation-meta">saved {new Date(savedAt).toLocaleString()}</span>
        )}
      </h4>
      <textarea
        className="cs-annotation-input"
        placeholder="Leave a note pinned to this component (visible on every page that contains it)…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
      />
      <div className="cs-annotation-actions">
        <button className="cs-link cs-link-primary" onClick={save} disabled={!dirty}>
          {savedNote ? 'Update note' : 'Save note'}
        </button>
        {savedNote && (
          <button
            className="cs-link"
            onClick={async () => {
              await deleteAnnotation(uri);
              setSavedNote('');
              setDraft('');
              setSavedAt(null);
              pushToast('Note deleted', 'info');
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { useStore } from '../store';

const DISMISS_AFTER_MS = 2200;

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), DISMISS_AFTER_MS));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="cs-toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`cs-toast cs-toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

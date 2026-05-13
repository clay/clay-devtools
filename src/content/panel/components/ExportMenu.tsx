import { useEffect, useRef, useState } from 'react';
import { buildManifest, downloadManifest } from '@/lib/exporter';
import type { ExportFormat } from '@/lib/types';
import { useStore } from '../store';

const OPTIONS: Array<{ format: ExportFormat; label: string; help: string }> = [
  { format: 'json', label: 'JSON', help: 'Full structured data' },
  { format: 'csv', label: 'CSV', help: 'Spreadsheet-friendly' },
  { format: 'markdown', label: 'Markdown', help: 'Pasteable into a ticket' },
];

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const page = useStore((s) => s.page);
  const components = useStore((s) => s.components);
  const pushToast = useStore((s) => s.pushToast);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const exportAs = (format: ExportFormat) => {
    try {
      downloadManifest(buildManifest(page, components), format);
      pushToast(`Manifest exported as ${format.toUpperCase()}`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="cs-export" ref={wrapper}>
      <button
        className="cs-link"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Export ▾
      </button>
      {open && (
        <div className="cs-export-menu" role="menu">
          {OPTIONS.map((opt) => (
            <button
              key={opt.format}
              role="menuitem"
              onClick={() => exportAs(opt.format)}
              className="cs-export-item"
            >
              <span className="cs-export-label">{opt.label}</span>
              <span className="cs-export-help">{opt.help}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

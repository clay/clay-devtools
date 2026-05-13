import { useEffect, useRef, useState } from 'react';
import { buildManifest, formatManifest } from '@/lib/exporter';
import type { ExportFormat } from '@/lib/types';
import { useCopyAction } from '../hooks/useCopyAction';
import { useStore } from '../store';
import { Icon } from './Icon';

const OPTIONS: Array<{ format: ExportFormat; label: string; help: string }> = [
  { format: 'json', label: 'JSON', help: 'Full structured data' },
  { format: 'csv', label: 'CSV', help: 'Spreadsheet-friendly' },
  { format: 'markdown', label: 'Markdown', help: 'Pasteable into a ticket' },
];

const ESTIMATED_MENU_HEIGHT = 140;

interface MenuCoords {
  readonly top: number;
  readonly right: number;
}

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const page = useStore((s) => s.page);
  const components = useStore((s) => s.components);
  const pushToast = useStore((s) => s.pushToast);
  // Each format gets its own copy key so a click on JSON doesn't briefly
  // tag CSV as "Copied". The menu auto-closes a beat *after* the copy
  // succeeds so the user sees the inline confirmation before it goes away.
  const { copy, copiedKey } = useCopyAction();

  useEffect(() => {
    if (!open) return;

    // Use composedPath() so we correctly see clicks inside the shadow tree
    // (default e.target gets retargeted to the shadow host at document level).
    const onPointerDown = (e: Event) => {
      const path = e.composedPath();
      if (wrapperRef.current && !path.includes(wrapperRef.current)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onResize = () => setOpen(false);

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const flipUp = rect.bottom + ESTIMATED_MENU_HEIGHT + 8 > window.innerHeight;
    setCoords({
      top: flipUp ? rect.top - ESTIMATED_MENU_HEIGHT - 4 : rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    });
    setOpen(true);
  };

  const exportAs = async (format: ExportFormat) => {
    try {
      const text = formatManifest(buildManifest(page, components), format);
      const ok = await copy(text, `${format.toUpperCase()} manifest`, format);
      if (ok) {
        // Hold the menu open briefly so the user can see the inline "Copied"
        // affordance light up before we collapse it.
        setTimeout(() => setOpen(false), 900);
      } else {
        setOpen(false);
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Export failed', 'error');
      setOpen(false);
    }
  };

  return (
    <div className="cs-export" ref={wrapperRef}>
      <button
        ref={triggerRef}
        className="cs-link"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Export ▾
      </button>
      {open && coords && (
        <div
          className="cs-export-menu"
          role="menu"
          style={{ top: coords.top, right: coords.right }}
        >
          {OPTIONS.map((opt) => {
            const copied = copiedKey === opt.format;
            return (
              <button
                key={opt.format}
                role="menuitem"
                onClick={() => void exportAs(opt.format)}
                className={`cs-export-item ${copied ? 'cs-export-item-copied' : ''}`}
              >
                <span className="cs-export-label">
                  {copied ? (
                    <>
                      <Icon name="check" size={12} /> Copied
                    </>
                  ) : (
                    <>Copy as {opt.label}</>
                  )}
                </span>
                <span className="cs-export-help">{opt.help}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

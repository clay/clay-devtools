import { useEffect, useMemo, useRef, useState } from 'react';
import { buildShareLink } from '@/lib/clay-uri';
import { copyToClipboard } from '@/lib/clipboard';
import { availableEnvsFor, findMappingForHost, rewriteUrlToEnv } from '@/lib/site-host';
import { SITE_ENV_LABELS, SITE_ENV_ORDER, type SiteEnv } from '@/lib/types';
import { useStore } from '../store';
import { Icon } from './Icon';

interface Props {
  readonly uri: string;
}

interface MenuCoords {
  readonly top: number;
  readonly right: number;
}

const ESTIMATED_MENU_HEIGHT = 160;

interface Target {
  readonly key: string;
  readonly label: string;
  readonly url: string;
  readonly env: SiteEnv | 'current';
}

/**
 * Split share button. The main face copies a share link for the *current*
 * page (existing behaviour). The trailing ▾ opens a tiny menu that adds one
 * row per cross-env target — uses {@link rewriteUrlToEnv} to swap the host
 * before generating the share link.
 */
export function ShareMenu({ uri }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const siteHosts = useStore((s) => s.preferences.siteHosts);
  const pushToast = useStore((s) => s.pushToast);

  const targets = useMemo<Target[]>(() => {
    const currentHref = location.href;
    const currentMatch = findMappingForHost(location.hostname, siteHosts);
    const currentEnvLabel = currentMatch ? SITE_ENV_LABELS[currentMatch.env] : '';

    const list: Target[] = [
      {
        key: 'current',
        label: currentEnvLabel ? `Current page (${currentEnvLabel})` : 'Current page',
        url: buildShareLink(currentHref, uri),
        env: 'current',
      },
    ];

    if (!currentMatch) return list;

    const envs = availableEnvsFor(location.hostname, siteHosts);
    for (const env of SITE_ENV_ORDER) {
      if (env === currentMatch.env || !envs.includes(env)) continue;
      const rewritten = rewriteUrlToEnv(currentHref, env, siteHosts);
      if (!rewritten) continue;
      list.push({
        key: env,
        label: SITE_ENV_LABELS[env],
        url: buildShareLink(rewritten, uri),
        env,
      });
    }
    return list;
  }, [siteHosts, uri]);

  const hasMenu = targets.length > 1;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: Event) => {
      const path = e.composedPath();
      if (wrapperRef.current && !path.includes(wrapperRef.current)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const close = () => setOpen(false);

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const copy = async (target: Target) => {
    setOpen(false);
    const ok = await copyToClipboard(target.url);
    pushToast(ok ? `Share link copied (${target.label})` : 'Copy failed', ok ? 'success' : 'error');
  };

  const onShareClick = () => {
    const current = targets[0];
    if (current) void copy(current);
  };

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

  return (
    <div className="cs-share-split" ref={wrapperRef}>
      <button
        className="cs-link cs-share-main"
        onClick={onShareClick}
        title="Copy a link that auto-selects this component when opened"
      >
        <Icon name="share" size={11} /> Share
      </button>
      {hasMenu && (
        <button
          ref={triggerRef}
          className="cs-link cs-share-toggle"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Share for a different environment"
        >
          ▾
        </button>
      )}
      {open && coords && hasMenu && (
        <div
          className="cs-export-menu"
          role="menu"
          style={{ top: coords.top, right: coords.right }}
        >
          {targets.map((t) => (
            <button
              key={t.key}
              role="menuitem"
              className="cs-export-item"
              onClick={() => void copy(t)}
            >
              <span className="cs-export-label">{t.label}</span>
              <span className="cs-export-help">{t.url}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

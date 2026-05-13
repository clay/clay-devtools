import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildShareLink } from '@/lib/clay-uri';
import { availableEnvsFor, findMappingForHost, rewriteUrlToEnv } from '@/lib/site-host';
import { SITE_ENV_LABELS, SITE_ENV_ORDER, type SiteEnv } from '@/lib/types';
import { useCopyAction } from '../hooks/useCopyAction';
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

interface MenuTarget {
  readonly key: string;
  readonly label: string;
  readonly env: SiteEnv;
}

/**
 * Split share button. The main face copies a share link for the *current*
 * page (always reading {@link Window.location.href} at click time so it can
 * never go stale). The trailing ▾ — only rendered when site-host mappings
 * are configured — opens a menu that adds one row per cross-env target,
 * using {@link rewriteUrlToEnv} to swap the host before generating the
 * share link.
 */
export function ShareMenu({ uri }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const siteHosts = useStore((s) => s.preferences.siteHosts);
  const pushToast = useStore((s) => s.pushToast);
  // Two visible buttons can each be the trigger ("Share" main + per-env
  // menu items), so we use the keyed form of the hook.
  const { copy, copiedKey } = useCopyAction();
  const mainCopied = copiedKey === 'main';

  // Cross-env targets are derived from configuration only — the URL itself
  // is computed at click time so SPA navigation can never produce a stale
  // share link.
  const menuTargets = useMemo<MenuTarget[]>(() => {
    if (siteHosts.length === 0) return [];
    const currentMatch = findMappingForHost(location.hostname, siteHosts);
    if (!currentMatch) return [];
    const envs = availableEnvsFor(location.hostname, siteHosts);
    const list: MenuTarget[] = [];
    for (const env of SITE_ENV_ORDER) {
      if (env === currentMatch.env || !envs.includes(env)) continue;
      list.push({ key: env, label: SITE_ENV_LABELS[env], env });
    }
    return list;
  }, [siteHosts]);

  const hasMenu = menuTargets.length > 0;

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

  const onShareClick = useCallback(() => {
    const currentMatch = findMappingForHost(location.hostname, siteHosts);
    const label = currentMatch ? `Share link (${SITE_ENV_LABELS[currentMatch.env]})` : 'Share link';
    void copy(buildShareLink(location.href, uri), label, 'main');
  }, [copy, siteHosts, uri]);

  const onMenuClick = useCallback(
    async (target: MenuTarget) => {
      const rewritten = rewriteUrlToEnv(location.href, target.env, siteHosts);
      if (!rewritten) {
        pushToast(`No ${target.label} host configured for this site`, 'error');
        setOpen(false);
        return;
      }
      const ok = await copy(
        buildShareLink(rewritten, uri),
        `Share link (${target.label})`,
        target.key
      );
      if (ok) {
        // Hold the menu open briefly so the inline "Copied" affordance is visible.
        setTimeout(() => setOpen(false), 900);
      } else {
        setOpen(false);
      }
    },
    [copy, pushToast, siteHosts, uri]
  );

  const toggle = useCallback(() => {
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
  }, [open]);

  // Without a menu, render a normal pill button (full radius, full border)
  // so it doesn't look visually broken / half-cut next to nothing.
  if (!hasMenu) {
    return (
      <button
        type="button"
        className={`cs-link ${mainCopied ? 'cs-link-copied' : ''}`}
        onClick={onShareClick}
        title={mainCopied ? 'Copied!' : 'Copy a link that auto-selects this component when opened'}
      >
        <Icon name={mainCopied ? 'check' : 'share'} size={11} /> {mainCopied ? 'Copied' : 'Share'}
      </button>
    );
  }

  return (
    <div className="cs-share-split" ref={wrapperRef}>
      <button
        type="button"
        className={`cs-link cs-share-main ${mainCopied ? 'cs-link-copied' : ''}`}
        onClick={onShareClick}
        title={mainCopied ? 'Copied!' : 'Copy a link that auto-selects this component when opened'}
      >
        <Icon name={mainCopied ? 'check' : 'share'} size={11} /> {mainCopied ? 'Copied' : 'Share'}
      </button>
      <button
        type="button"
        ref={triggerRef}
        className="cs-link cs-share-toggle"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Share for a different environment"
      >
        ▾
      </button>
      {open && coords && (
        <div
          className="cs-export-menu"
          role="menu"
          style={{ top: coords.top, right: coords.right }}
        >
          {menuTargets.map((t) => {
            const copied = copiedKey === t.key;
            return (
              <button
                type="button"
                key={t.key}
                role="menuitem"
                className={`cs-export-item ${copied ? 'cs-export-item-copied' : ''}`}
                onClick={() => void onMenuClick(t)}
              >
                <span className="cs-export-label">
                  {copied ? (
                    <>
                      <Icon name="check" size={12} /> Copied
                    </>
                  ) : (
                    <>Copy share link · {t.label}</>
                  )}
                </span>
                <span className="cs-export-help">Rewrites the host for {t.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

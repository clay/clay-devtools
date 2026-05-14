export interface ClayPageInfo {
  readonly pageUri: string;
  readonly layoutUri: string | null;
  readonly isPublished: boolean;
  readonly pageInstance: string | null;
}

export interface ClayComponentInfo {
  readonly uri: string;
  readonly name: string;
  readonly displayName: string;
  readonly instance: string | null;
  readonly element: HTMLElement;
  readonly depth: number;
}

export type PanelPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'left-side'
  | 'right-side';

/**
 * Controls *which* components show an ambient outline on the page.
 * Hover and selection always render their own highlight regardless of mode
 * (otherwise click-to-inspect would be invisible).
 *
 * - `off`        – no ambient outlines at all. Hover + selection still highlight.
 * - `selection`  – the daily-driver default: pristine page; hover and click
 *                  still highlight individual components, **and holding ⌥
 *                  (Alt/Option) reveals corner accents on every component**
 *                  for a quick spatial overview. Closest to Chrome DevTools'
 *                  inspector with a "show all" peek gesture layered on.
 * - `editable`   – always-on corner accents on `[data-editable]` components.
 *                  Useful for editorial / PM workflows.
 * - `all`        – always-on corner accents on every Clay component. The
 *                  "give me the bird's-eye view of structure" mode.
 */
export type HighlightMode = 'off' | 'selection' | 'editable' | 'all';

export const HIGHLIGHT_MODE_ORDER: readonly HighlightMode[] = [
  'off',
  'selection',
  'editable',
  'all',
];

export const HIGHLIGHT_MODE_LABELS: Readonly<Record<HighlightMode, string>> = {
  off: 'Off',
  selection: 'Selection',
  editable: 'Editable only',
  all: 'All components',
};

export const HIGHLIGHT_MODE_DESCRIPTIONS: Readonly<Record<HighlightMode, string>> = {
  off: 'No outlines anywhere. The panel still works for inspection.',
  selection:
    'Hover or click to highlight a component. Hold ⌥ to reveal every component on the page.',
  editable: 'Subtle corner accents on every editable component.',
  all: 'Subtle corner accents on every Clay component, all the time.',
};

export interface UserPreferences {
  readonly theme: 'auto' | 'light' | 'dark';
  readonly panelPosition: PanelPosition;
  readonly panelWidth: number;
  readonly panelHeight: number;
  readonly highlightMode: HighlightMode;
  readonly highlightOpacity: number;
  readonly enableShortcuts: boolean;
  readonly maxRecentComponents: number;
  readonly siteHosts: readonly SiteHostMapping[];
}

/**
 * Environments supported by the site-host mapping feature. The mapping
 * is the *only* place the extension learns about envs — there's no
 * separate global env config. Local/dev are intentionally excluded:
 * mappings are per-brand hostname lookups for stable shared envs, and
 * "localhost" / single-developer hosts don't fit that shape.
 */
export type SiteEnv = 'prod' | 'staging' | 'qa';

export const SITE_ENV_ORDER: readonly SiteEnv[] = ['prod', 'staging', 'qa'];

export const SITE_ENV_LABELS: Readonly<Record<SiteEnv, string>> = {
  prod: 'Production',
  staging: 'Staging',
  qa: 'QA',
};

/**
 * One brand/site, with the hostname it serves on under each supported env.
 * Hostnames are bare (`www.thecut.com`, not a full URL). Missing entries
 * mean "this site isn't deployed in that env" and the corresponding
 * "View on…" pill will not appear.
 */
export interface SiteHostMapping {
  readonly id: string;
  readonly label: string;
  readonly hosts: Partial<Record<SiteEnv, string>>;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'auto',
  panelPosition: 'bottom-right',
  panelWidth: 380,
  panelHeight: 540,
  highlightMode: 'selection',
  highlightOpacity: 0.85,
  enableShortcuts: true,
  maxRecentComponents: 20,
  siteHosts: [],
};

/** Minimal serializable info we keep about a component for recents/annotations. */
export interface RecentComponent {
  readonly uri: string;
  readonly displayName: string;
  readonly instance: string | null;
  readonly pageUrl: string;
  readonly pageTitle: string;
  readonly visitedAt: number;
}

export interface Annotation {
  readonly uri: string;
  readonly note: string;
  readonly displayName: string;
  readonly pageUrl: string;
  readonly pageTitle: string;
  readonly updatedAt: number;
}

export type ExportFormat = 'json' | 'csv' | 'markdown';

export type RuntimeMessage =
  | { type: 'OPEN_TAB'; url: string }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'UPDATE_BADGE'; count: number; tabId?: number }
  | { type: 'CLAY_DETECTED' }
  | { type: 'PANEL_TOGGLE' }
  | { type: 'CAPTURE_TAB' };

export interface CaptureResponse {
  readonly ok: boolean;
  readonly dataUrl?: string;
  readonly error?: string;
}

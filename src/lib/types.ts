export type Environment = 'local' | 'dev' | 'staging' | 'prod';

export interface EnvironmentConfig {
  readonly id: Environment;
  readonly label: string;
  readonly host: string;
}

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

export type EnvironmentHosts = Readonly<Record<Environment, string>>;

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
 * - `selection`  – ambient is off; only the hovered/selected element is outlined.
 *                  This is the default — feels closest to Chrome DevTools.
 * - `editable`   – ambient outlines on `[data-editable]` components only.
 *                  Useful for editorial / PM workflows.
 * - `all`        – pristine page by default; **hold ⌥ (Alt/Option)** to reveal
 *                  every component's corner accents on demand. Hover and click
 *                  still work normally without the modifier. The "I want to
 *                  peek at the structure occasionally" mode.
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
  selection: 'Selection only',
  editable: 'Editable only',
  all: 'All on ⌥',
};

export const HIGHLIGHT_MODE_DESCRIPTIONS: Readonly<Record<HighlightMode, string>> = {
  off: 'No outlines anywhere. The panel still works for inspection.',
  selection: 'Only the component you hover or click gets an outline.',
  editable: 'Subtle corner accents on every editable component.',
  all: 'Pristine by default. Hold ⌥ (Alt/Option) to reveal every component.',
};

export interface UserPreferences {
  readonly theme: 'auto' | 'light' | 'dark';
  readonly panelPosition: PanelPosition;
  readonly panelWidth: number;
  readonly panelHeight: number;
  readonly defaultEnvironment: Environment;
  readonly environments: EnvironmentHosts;
  readonly highlightMode: HighlightMode;
  readonly highlightOpacity: number;
  readonly enableShortcuts: boolean;
  readonly maxRecentComponents: number;
  readonly siteHosts: readonly SiteHostMapping[];
}

/**
 * Environments supported by the site-host mapping feature. Intentionally
 * narrower than {@link Environment} (no `local`/`dev`) — site-host mappings
 * are a per-brand lookup that only makes sense for stable shared envs.
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

export const DEFAULT_ENVIRONMENT_HOSTS: EnvironmentHosts = {
  local: 'http://localhost:3001',
  dev: '',
  staging: '',
  prod: '',
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'auto',
  panelPosition: 'bottom-right',
  panelWidth: 380,
  panelHeight: 540,
  defaultEnvironment: 'prod',
  environments: DEFAULT_ENVIRONMENT_HOSTS,
  highlightMode: 'selection',
  highlightOpacity: 0.85,
  enableShortcuts: true,
  maxRecentComponents: 20,
  siteHosts: [],
};

export const ENVIRONMENT_ORDER: readonly Environment[] = ['local', 'dev', 'staging', 'prod'];

export const ENVIRONMENT_LABELS: Readonly<Record<Environment, string>> = {
  local: 'Local',
  dev: 'Dev',
  staging: 'Staging',
  prod: 'Production',
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

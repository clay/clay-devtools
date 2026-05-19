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
 * Controls every visual signal Clay Slip paints on the host page.
 *
 * The mode owns BOTH the ambient layer (which/whether components carry
 * an always-on outline) AND the interaction layer (whether hover and
 * click paint a blue selection outline). That coupling exists so the
 * four modes are visually distinct in practice — earlier iterations
 * only mode-gated the ambient layer, which meant hover always flashed
 * blue and users reported that the mode dropdown felt inert ("the
 * options to edit the highlight mode don't seem to do anything — I'm
 * seeing the same blue outline on hover regardless of which I select").
 *
 * - `off`        – **fully silent on the page.** No ambient outlines,
 *                  no hover highlight, no selection highlight, no
 *                  component name badge. The panel still works in full
 *                  — pick components from the Tree tab — but the host
 *                  page is pristine. This is the "I want the extension
 *                  to leave my page alone but still be available" mode.
 *                  (For "stop running entirely until I say so", see
 *                  {@link UserPreferences.enabled}.)
 * - `selection`  – the daily-driver default: pristine page; hover and
 *                  click paint blue so click-to-inspect feels obvious,
 *                  **and holding ⌃ (Control) reveals the rainbow over
 *                  every component** for a quick spatial overview.
 *                  Closest to Chrome DevTools' inspector with a "show
 *                  all" peek gesture layered on.
 * - `editable`   – always-on corner accents on `[data-editable]`
 *                  components; hover + click still paint blue on top.
 *                  Useful for editorial / PM workflows.
 * - `all`        – always-on rainbow over every Clay component; hover
 *                  + click still paint blue on top. The "give me the
 *                  bird's-eye view of structure" mode.
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
  off: 'Pristine page — no outlines on hover, click, or anywhere else. The panel still works; pick components from the Tree tab.',
  selection:
    'Hover or click to highlight a component in blue. Hold ⌃ Control to reveal every component on the page.',
  editable: 'Subtle corner accents on editable components, plus blue hover + click highlights.',
  all: 'Rainbow outlines on every Clay component, plus blue hover + click highlights.',
};

export interface UserPreferences {
  /**
   * Master kill-switch for the entire extension. When `false`, the content
   * script detects this at bootstrap and **never** mounts the panel, never
   * installs the highlighter stylesheet, never touches the host DOM.
   * The toolbar popup is force-shown so the user can flip it back to
   * `true` from any tab (the popup's enable/disable toggle writes to the
   * same `chrome.storage.sync` key, which propagates to every tab via
   * the `onPreferencesChanged` listener and lazy-mounts the panel on the
   * next render).
   *
   * Distinct from {@link HighlightMode}'s `'off'`: `enabled: false` is
   * "the extension is dormant, full stop"; `highlightMode: 'off'` is
   * "the extension is running and the panel is available, but don't
   * paint anything on the host page". Both options exist because users
   * asked for both:
   *   > a way to turn it off entirely and persist the change until they
   *   > turn it back on
   * which is this flag, vs.
   *   > i'd rather it not automatically highlight each component on hover
   * which is `highlightMode: 'off'`.
   *
   * Stored in `chrome.storage.sync`, so the choice follows the user
   * across browser profiles signed into the same account on both
   * Chromium and Firefox.
   */
  readonly enabled: boolean;
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
  // Default to ON: the extension is sideloaded by users who deliberately
  // installed it, so the first-run experience should be "it just works".
  // The persistent kill-switch is opt-in for users who want a quiet
  // browser by default.
  enabled: true,
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
  | { type: 'CAPTURE_TAB' }
  /**
   * Sent by the content script when the extension flips between the
   * `enabled: true` and `enabled: false` states (see
   * {@link UserPreferences.enabled}). The service worker uses this to
   * force the toolbar popup on every tab when the extension is
   * disabled — without it the per-tab popup overrides that disable the
   * popup on Clay pages would leave the user with no way to flip the
   * extension back on from a Clay page.
   */
  | { type: 'EXTENSION_ENABLED_CHANGED'; enabled: boolean };

export interface CaptureResponse {
  readonly ok: boolean;
  readonly dataUrl?: string;
  readonly error?: string;
}

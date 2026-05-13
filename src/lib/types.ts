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

export interface UserPreferences {
  readonly theme: 'auto' | 'light' | 'dark';
  readonly panelPosition: PanelPosition;
  readonly panelWidth: number;
  readonly panelHeight: number;
  readonly defaultEnvironment: Environment;
  readonly environments: EnvironmentHosts;
  readonly highlightOpacity: number;
  readonly enableShortcuts: boolean;
  readonly maxRecentComponents: number;
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
  highlightOpacity: 0.85,
  enableShortcuts: true,
  maxRecentComponents: 20,
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

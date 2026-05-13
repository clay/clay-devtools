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

export interface UserPreferences {
  readonly theme: 'auto' | 'light' | 'dark';
  readonly panelPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  readonly defaultEnvironment: Environment;
  readonly environments: EnvironmentHosts;
  readonly highlightOpacity: number;
  readonly enableShortcuts: boolean;
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
  defaultEnvironment: 'prod',
  environments: DEFAULT_ENVIRONMENT_HOSTS,
  highlightOpacity: 0.85,
  enableShortcuts: true,
};

export const ENVIRONMENT_ORDER: readonly Environment[] = ['local', 'dev', 'staging', 'prod'];

export const ENVIRONMENT_LABELS: Readonly<Record<Environment, string>> = {
  local: 'Local',
  dev: 'Dev',
  staging: 'Staging',
  prod: 'Production',
};

export type RuntimeMessage =
  | { type: 'OPEN_TAB'; url: string }
  | { type: 'UPDATE_BADGE'; count: number; tabId?: number }
  | { type: 'CLAY_DETECTED' }
  | { type: 'PANEL_TOGGLE' };

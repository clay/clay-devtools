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

export interface UserPreferences {
  readonly theme: 'auto' | 'light' | 'dark';
  readonly panelPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  readonly defaultEnvironment: Environment;
  readonly highlightOpacity: number;
  readonly enableShortcuts: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'auto',
  panelPosition: 'bottom-right',
  defaultEnvironment: 'prod',
  highlightOpacity: 0.85,
  enableShortcuts: true,
};

export const DEFAULT_ENVIRONMENTS: readonly EnvironmentConfig[] = [
  { id: 'local', label: 'Local', host: 'http://localhost:3001' },
  { id: 'dev', label: 'Dev', host: '' },
  { id: 'staging', label: 'Staging', host: '' },
  { id: 'prod', label: 'Production', host: '' },
];

export type RuntimeMessage =
  | { type: 'OPEN_TAB'; url: string }
  | { type: 'COPY_TO_CLIPBOARD'; text: string }
  | { type: 'UPDATE_BADGE'; count: number; tabId?: number }
  | { type: 'PANEL_TOGGLE' };

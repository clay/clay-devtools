import { create } from 'zustand';
import type { ClayComponentInfo, ClayPageInfo, UserPreferences } from '@/lib/types';
import { DEFAULT_PREFERENCES } from '@/lib/types';
import { readPageInfo } from '../page-info';

export type PanelTab = 'inspect' | 'tree' | 'json' | 'diff';

interface ToastMessage {
  readonly id: number;
  readonly text: string;
  readonly tone: 'info' | 'success' | 'error';
}

interface StoreState {
  page: ClayPageInfo | null;
  components: ClayComponentInfo[];
  selected: ClayComponentInfo | null;
  hovered: ClayComponentInfo | null;
  collapsed: boolean;
  search: string;
  activeTab: PanelTab;
  showShortcuts: boolean;
  highlightEnabled: boolean;
  preferences: UserPreferences;
  toasts: ToastMessage[];

  setComponents: (components: ClayComponentInfo[]) => void;
  setSelected: (next: ClayComponentInfo | null) => void;
  setHovered: (next: ClayComponentInfo | null) => void;
  toggleCollapsed: () => void;
  setSearch: (q: string) => void;
  setActiveTab: (tab: PanelTab) => void;
  toggleShortcuts: () => void;
  toggleHighlights: () => void;
  setPreferences: (next: Partial<UserPreferences>) => void;
  pushToast: (text: string, tone?: ToastMessage['tone']) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 0;

export const useStore = create<StoreState>()((set) => ({
  page: readPageInfo(),
  components: [],
  selected: null,
  hovered: null,
  collapsed: false,
  search: '',
  activeTab: 'inspect',
  showShortcuts: false,
  highlightEnabled: true,
  preferences: DEFAULT_PREFERENCES,
  toasts: [],

  setComponents: (components) => set({ components, page: readPageInfo() }),
  setSelected: (selected) => set({ selected }),
  setHovered: (hovered) => set({ hovered }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setSearch: (search) => set({ search }),
  setActiveTab: (activeTab) => set({ activeTab }),
  toggleShortcuts: () => set((s) => ({ showShortcuts: !s.showShortcuts })),
  toggleHighlights: () => set((s) => ({ highlightEnabled: !s.highlightEnabled })),
  setPreferences: (prefs) => set((s) => ({ preferences: { ...s.preferences, ...prefs } })),
  pushToast: (text, tone = 'info') =>
    set((s) => ({
      toasts: [...s.toasts, { id: ++toastSeq, text, tone }],
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Read-only selector hook for the resolved environment host string.
 * Returns an empty string when the user has not configured a host for the
 * currently-selected environment, signalling "use the page's existing host".
 */
export function useEnvHost(): string {
  return useStore((s) => s.preferences.environments[s.preferences.defaultEnvironment] ?? '');
}

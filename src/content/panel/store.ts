import { create } from 'zustand';
import type {
  Annotation,
  ClayComponentInfo,
  ClayPageInfo,
  RecentComponent,
  UserPreferences,
} from '@/lib/types';
import { DEFAULT_PREFERENCES } from '@/lib/types';
import { readPageInfo } from '../page-info';

export type PanelTab = 'inspect' | 'tree' | 'json' | 'diff' | 'seo' | 'notes';

interface ToastMessage {
  readonly id: number;
  readonly text: string;
  readonly tone: 'info' | 'success' | 'error';
}

interface FindState {
  readonly query: string;
  readonly index: number;
}

interface StoreState {
  page: ClayPageInfo | null;
  components: ClayComponentInfo[];
  selected: ClayComponentInfo | null;
  hovered: ClayComponentInfo | null;
  collapsed: boolean;
  search: string;
  find: FindState;
  activeTab: PanelTab;
  showShortcuts: boolean;
  highlightEnabled: boolean;
  preferences: UserPreferences;
  toasts: ToastMessage[];
  recents: RecentComponent[];
  annotations: Annotation[];
  annotatedUris: Set<string>;

  setComponents: (components: ClayComponentInfo[]) => void;
  setSelected: (next: ClayComponentInfo | null) => void;
  setHovered: (next: ClayComponentInfo | null) => void;
  toggleCollapsed: () => void;
  setSearch: (q: string) => void;
  setFind: (next: FindState) => void;
  setActiveTab: (tab: PanelTab) => void;
  toggleShortcuts: () => void;
  toggleHighlights: () => void;
  setPreferences: (next: Partial<UserPreferences>) => void;
  setRecents: (next: RecentComponent[]) => void;
  setAnnotations: (next: Annotation[]) => void;
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
  find: { query: '', index: 0 },
  activeTab: 'inspect',
  showShortcuts: false,
  highlightEnabled: true,
  preferences: DEFAULT_PREFERENCES,
  toasts: [],
  recents: [],
  annotations: [],
  annotatedUris: new Set(),

  setComponents: (components) => set({ components, page: readPageInfo() }),
  setSelected: (selected) => set({ selected }),
  setHovered: (hovered) => set({ hovered }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setSearch: (search) => set({ search }),
  setFind: (find) => set({ find }),
  setActiveTab: (activeTab) => set({ activeTab }),
  toggleShortcuts: () => set((s) => ({ showShortcuts: !s.showShortcuts })),
  toggleHighlights: () => set((s) => ({ highlightEnabled: !s.highlightEnabled })),
  setPreferences: (prefs) => set((s) => ({ preferences: { ...s.preferences, ...prefs } })),
  setRecents: (recents) => set({ recents }),
  setAnnotations: (annotations) =>
    set({
      annotations,
      annotatedUris: new Set(annotations.map((a) => a.uri)),
    }),
  pushToast: (text, tone = 'info') =>
    set((s) => ({
      toasts: [...s.toasts, { id: ++toastSeq, text, tone }],
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useEnvHost(): string {
  return useStore((s) => s.preferences.environments[s.preferences.defaultEnvironment] ?? '');
}

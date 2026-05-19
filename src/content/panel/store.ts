import { create } from 'zustand';
import type {
  Annotation,
  ClayComponentInfo,
  ClayPageInfo,
  HighlightMode,
  RecentComponent,
  UserPreferences,
} from '@/lib/types';
import { DEFAULT_PREFERENCES, HIGHLIGHT_MODE_ORDER } from '@/lib/types';
import { savePreferences } from '@/lib/storage';
import { readPageInfo } from '../page-info';

export type PanelTab = 'inspect' | 'tree' | 'json' | 'diff' | 'seo' | 'notes' | 'globals';

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
  /**
   * Update the ambient-outline mode. Persists to chrome.storage.sync so
   * the choice survives reloads and propagates to other tabs.
   */
  setHighlightMode: (mode: HighlightMode) => void;
  /**
   * Cycle through the four modes in `HIGHLIGHT_MODE_ORDER`. Bound to the
   * `h` keyboard shortcut for muscle memory with the old "toggle outlines"
   * behavior.
   */
  cycleHighlightMode: () => void;
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
  // Mount in collapsed state — the panel renders as a small floating "Clay"
  // button (FAB) until the user clicks it. Matches the standard pattern used
  // by Sentry, Hotjar, Crisp, Intercom etc. See {@link Fab}.
  collapsed: true,
  search: '',
  find: { query: '', index: 0 },
  activeTab: 'inspect',
  showShortcuts: false,
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
  setHighlightMode: (mode) => {
    set((s) => ({ preferences: { ...s.preferences, highlightMode: mode } }));
    void savePreferences({ highlightMode: mode });
  },
  cycleHighlightMode: () => {
    const current = useStore.getState().preferences.highlightMode;
    const idx = HIGHLIGHT_MODE_ORDER.indexOf(current);
    const next = HIGHLIGHT_MODE_ORDER[(idx + 1) % HIGHLIGHT_MODE_ORDER.length] ?? 'selection';
    useStore.getState().setHighlightMode(next);
  },
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

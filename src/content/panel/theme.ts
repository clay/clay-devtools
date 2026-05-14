export type ThemeMode = 'light' | 'dark';

export interface ThemeTokens {
  readonly bg: string;
  readonly bgElevated: string;
  readonly bgHover: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textSubtle: string;
  readonly accent: string;
  readonly accentBg: string;
  readonly success: string;
  readonly warning: string;
  readonly danger: string;
  readonly mono: string;
}

export const lightTheme: ThemeTokens = {
  bg: '#ffffff',
  bgElevated: '#f6f7f9',
  bgHover: '#eef0f3',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  text: '#0f172a',
  textMuted: '#475569',
  textSubtle: '#94a3b8',
  // Single inspector accent — matches `ACCENT_RGB` in `src/content/highlighter.ts`
  // so the on-page selection outline and the in-panel selection chrome
  // tell one consistent visual story. Tailwind blue-600.
  accent: '#2563eb',
  accentBg: 'rgba(37, 99, 235, 0.10)',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

export const darkTheme: ThemeTokens = {
  bg: '#0f1115',
  bgElevated: '#161922',
  bgHover: '#1f2330',
  border: '#252a36',
  borderStrong: '#363c4d',
  text: '#e6e8ee',
  textMuted: '#9aa3b2',
  textSubtle: '#5f6776',
  // Lighter blue-400 in dark mode to keep WCAG AA contrast on dark backgrounds.
  // Same hue family as light theme so the visual identity stays coherent.
  accent: '#60a5fa',
  accentBg: 'rgba(96, 165, 250, 0.16)',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

export function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--cs-bg': tokens.bg,
    '--cs-bg-elevated': tokens.bgElevated,
    '--cs-bg-hover': tokens.bgHover,
    '--cs-border': tokens.border,
    '--cs-border-strong': tokens.borderStrong,
    '--cs-text': tokens.text,
    '--cs-text-muted': tokens.textMuted,
    '--cs-text-subtle': tokens.textSubtle,
    '--cs-accent': tokens.accent,
    '--cs-accent-bg': tokens.accentBg,
    '--cs-success': tokens.success,
    '--cs-warning': tokens.warning,
    '--cs-danger': tokens.danger,
    '--cs-mono': tokens.mono,
  };
}

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
  accent: '#e22c2c',
  accentBg: 'rgba(226, 44, 44, 0.08)',
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
  accent: '#ff5c5c',
  accentBg: 'rgba(255, 92, 92, 0.12)',
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

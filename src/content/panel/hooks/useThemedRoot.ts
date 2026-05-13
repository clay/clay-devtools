import { useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { resolveTheme, tokensToCssVars } from '../theme';
import { useStore } from '../store';

export function useThemedRoot(): { style: CSSProperties; mode: 'light' | 'dark' } {
  const themeMode = useStore((s) => s.preferences.theme);

  const resolved = useMemo(() => resolveTheme(themeMode), [themeMode]);

  useEffect(() => {
    if (themeMode !== 'auto') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      useStore.setState((s) => ({ preferences: { ...s.preferences, theme: 'auto' } }));
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [themeMode]);

  return {
    style: tokensToCssVars(resolved.tokens) as unknown as CSSProperties,
    mode: resolved.mode,
  };
}

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { darkTheme, lightTheme, tokensToCssVars, type ThemeMode } from '../theme';
import { useStore } from '../store';

export function useThemedRoot(): { style: CSSProperties; mode: ThemeMode } {
  const themeMode = useStore((s) => s.preferences.theme);

  const [systemDark, setSystemDark] = useState<boolean>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    if (themeMode !== 'auto') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [themeMode]);

  const resolved = useMemo(() => {
    const mode: ThemeMode = themeMode === 'auto' ? (systemDark ? 'dark' : 'light') : themeMode;
    return { mode, tokens: mode === 'dark' ? darkTheme : lightTheme };
  }, [themeMode, systemDark]);

  return {
    style: tokensToCssVars(resolved.tokens) as unknown as CSSProperties,
    mode: resolved.mode,
  };
}

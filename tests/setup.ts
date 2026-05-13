import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-uri');
  document.documentElement.removeAttribute('data-layout-uri');
});

import { afterEach, vi } from 'vitest';

// Forward `import browser from 'webextension-polyfill'` to whatever each test
// sets on `globalThis.chrome`. The real polyfill throws at import time outside
// an extension context, which would break test files that pull in storage/
// runtime helpers transitively.
vi.mock('webextension-polyfill', () => ({
  default: new Proxy(
    {},
    { get: (_t, ns: string) => (globalThis as { chrome?: Record<string, unknown> }).chrome?.[ns] }
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-uri');
  document.documentElement.removeAttribute('data-layout-uri');
});

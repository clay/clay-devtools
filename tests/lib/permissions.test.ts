import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasHostPermission,
  hostFromOrigin,
  hostFromUrl,
  isValidHost,
  listGrantedHosts,
  originsFor,
  removeHostPermission,
  requestHostPermission,
} from '@/lib/permissions';

interface PermsMock {
  origins: string[];
  getAll: ReturnType<typeof vi.fn>;
  request: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
}

function setupChromeMock(initialOrigins: string[] = []): PermsMock {
  const perms: PermsMock = {
    origins: [...initialOrigins],
    getAll: vi.fn(async () => ({ permissions: [], origins: [...perms.origins] })),
    request: vi.fn(async ({ origins }: { origins: string[] }) => {
      perms.origins.push(...origins);
      return true;
    }),
    remove: vi.fn(async ({ origins }: { origins: string[] }) => {
      perms.origins = perms.origins.filter((o) => !origins.includes(o));
      return true;
    }),
    contains: vi.fn(async ({ origins }: { origins: string[] }) =>
      origins.every((o) => perms.origins.includes(o))
    ),
  };
  (globalThis as { chrome?: unknown }).chrome = { permissions: perms };
  return perms;
}

beforeEach(() => {
  setupChromeMock();
});

describe('originsFor', () => {
  it('expands a bare host into both http and https patterns', () => {
    expect(originsFor(['www.thecut.com'])).toEqual([
      'https://www.thecut.com/*',
      'http://www.thecut.com/*',
    ]);
  });

  it('preserves an explicit port (localhost dev box)', () => {
    expect(originsFor(['localhost:3001'])).toEqual([
      'https://localhost:3001/*',
      'http://localhost:3001/*',
    ]);
  });

  it('drops invalid host patterns silently', () => {
    expect(originsFor(['not a host', 'www.ok.com'])).toEqual([
      'https://www.ok.com/*',
      'http://www.ok.com/*',
    ]);
  });
});

describe('hostFromOrigin', () => {
  it('extracts the bare host from a wildcard pattern', () => {
    expect(hostFromOrigin('https://www.thecut.com/*')).toBe('www.thecut.com');
    expect(hostFromOrigin('http://localhost:3001/*')).toBe('localhost:3001');
  });

  it('returns null for opaque or unrecognized patterns', () => {
    expect(hostFromOrigin('<all_urls>')).toBeNull();
    expect(hostFromOrigin('chrome://settings')).toBeNull();
  });
});

describe('hostFromUrl', () => {
  it('returns the host of an http(s) URL', () => {
    expect(hostFromUrl('https://www.thecut.com/article/foo')).toBe('www.thecut.com');
    expect(hostFromUrl('http://localhost:3001/page')).toBe('localhost:3001');
  });

  it('returns null for non-http(s) schemes', () => {
    expect(hostFromUrl('chrome://newtab')).toBeNull();
    expect(hostFromUrl('about:blank')).toBeNull();
    expect(hostFromUrl(undefined)).toBeNull();
    expect(hostFromUrl('not a url')).toBeNull();
  });
});

describe('isValidHost', () => {
  it('accepts conventional hostnames', () => {
    expect(isValidHost('www.thecut.com')).toBe(true);
    expect(isValidHost('localhost')).toBe(true);
    expect(isValidHost('localhost:3001')).toBe(true);
  });

  it('rejects strings that are clearly not hostnames', () => {
    expect(isValidHost('https://www.thecut.com')).toBe(false);
    expect(isValidHost('www.thecut.com/path')).toBe(false);
    expect(isValidHost('www thecut com')).toBe(false);
    expect(isValidHost('')).toBe(false);
  });
});

describe('listGrantedHosts', () => {
  it('returns the de-duplicated, sorted set of granted hosts', async () => {
    setupChromeMock([
      'https://www.thecut.com/*',
      'http://www.thecut.com/*',
      'https://www.vulture.com/*',
    ]);
    expect(await listGrantedHosts()).toEqual(['www.thecut.com', 'www.vulture.com']);
  });

  it('returns [] when chrome.permissions is unavailable', async () => {
    (globalThis as { chrome?: unknown }).chrome = undefined;
    expect(await listGrantedHosts()).toEqual([]);
  });
});

describe('requestHostPermission', () => {
  it('asks chrome.permissions.request and returns the user decision', async () => {
    const perms = setupChromeMock();
    perms.request.mockResolvedValueOnce(true);
    expect(await requestHostPermission('www.thecut.com')).toBe(true);
    expect(perms.request).toHaveBeenCalledWith({
      origins: ['https://www.thecut.com/*', 'http://www.thecut.com/*'],
    });
  });

  it('returns false (without prompting) for invalid host strings', async () => {
    const perms = setupChromeMock();
    expect(await requestHostPermission('not a host')).toBe(false);
    expect(perms.request).not.toHaveBeenCalled();
  });
});

describe('removeHostPermission', () => {
  it('asks chrome.permissions.remove for both http and https patterns', async () => {
    const perms = setupChromeMock(['https://www.thecut.com/*', 'http://www.thecut.com/*']);
    expect(await removeHostPermission('www.thecut.com')).toBe(true);
    expect(perms.remove).toHaveBeenCalledWith({
      origins: ['https://www.thecut.com/*', 'http://www.thecut.com/*'],
    });
  });
});

describe('hasHostPermission', () => {
  it('returns true only when both http and https are granted', async () => {
    setupChromeMock(['https://www.thecut.com/*', 'http://www.thecut.com/*']);
    expect(await hasHostPermission('www.thecut.com')).toBe(true);
  });

  it('returns false if only one of the two is granted', async () => {
    setupChromeMock(['https://www.thecut.com/*']);
    expect(await hasHostPermission('www.thecut.com')).toBe(false);
  });
});

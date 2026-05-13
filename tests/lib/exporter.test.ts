import { describe, expect, it } from 'vitest';
import { buildManifest, formatManifest } from '@/lib/exporter';
import type { ClayComponentInfo, ClayPageInfo } from '@/lib/types';

const samplePage: ClayPageInfo = {
  pageUri: 'site.example.com/_pages/abc',
  layoutUri: 'site.example.com/_layouts/main/instances/x',
  isPublished: true,
  pageInstance: 'abc',
};

function comp(overrides: Partial<ClayComponentInfo> = {}): ClayComponentInfo {
  const el = document.createElement('div');
  return {
    uri: 'site.example.com/_components/byline/instances/x@published',
    name: 'byline',
    displayName: 'Byline',
    instance: 'x',
    element: el,
    depth: 1,
    ...overrides,
  };
}

describe('buildManifest', () => {
  it('captures page metadata + components without DOM refs', () => {
    const m = buildManifest(samplePage, [comp()]);
    expect(m.page).toBe(samplePage);
    expect(m.components).toHaveLength(1);
    expect(m.components[0]).not.toHaveProperty('element');
    expect(m.components[0]).toMatchObject({
      name: 'byline',
      displayName: 'Byline',
      depth: 1,
      instance: 'x',
    });
    expect(m.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('formatManifest', () => {
  const manifest = buildManifest(samplePage, [
    comp({ name: 'a', displayName: 'A' }),
    comp({ name: 'b', displayName: 'B', instance: 'with"quote', uri: 'site/_components/b' }),
  ]);

  it('produces parseable JSON', () => {
    const out = formatManifest(manifest, 'json');
    expect(JSON.parse(out)).toMatchObject({ components: expect.any(Array) });
  });

  it('produces a CSV with header + rows + escapes quotes', () => {
    const out = formatManifest(manifest, 'csv');
    const lines = out.split('\n');
    expect(lines[0]).toBe('name,displayName,uri,instance,depth');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('"with""quote"');
  });

  it('produces markdown with a heading + table', () => {
    const out = formatManifest(manifest, 'markdown');
    expect(out).toContain('# ');
    expect(out).toContain('| # | Component |');
    expect(out).toContain('| 1 | A |');
    expect(out).toContain('| 2 | B |');
  });
});

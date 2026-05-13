import type { ClayComponentInfo, ClayPageInfo, ExportFormat } from './types';

interface ManifestRow {
  readonly name: string;
  readonly displayName: string;
  readonly uri: string;
  readonly instance: string | null;
  readonly depth: number;
}

export interface PageManifest {
  readonly exportedAt: string;
  readonly page: ClayPageInfo | null;
  readonly url: string;
  readonly title: string;
  readonly components: ManifestRow[];
}

export function buildManifest(
  page: ClayPageInfo | null,
  components: ClayComponentInfo[]
): PageManifest {
  return {
    exportedAt: new Date().toISOString(),
    page,
    url: location.href,
    title: document.title,
    components: components.map(({ name, displayName, uri, instance, depth }) => ({
      name,
      displayName,
      uri,
      instance,
      depth,
    })),
  };
}

function escapeCsv(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function formatManifest(manifest: PageManifest, format: ExportFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(manifest, null, 2);
    case 'csv': {
      const header = ['name', 'displayName', 'uri', 'instance', 'depth'];
      const rows = manifest.components.map((c) =>
        [c.name, c.displayName, c.uri, c.instance ?? '', c.depth].map(escapeCsv).join(',')
      );
      return [header.join(','), ...rows].join('\n');
    }
    case 'markdown': {
      const head = `# ${manifest.title}\n\n- **URL**: ${manifest.url}\n- **Page URI**: ${manifest.page?.pageUri ?? '—'}\n- **Layout URI**: ${manifest.page?.layoutUri ?? '—'}\n- **Status**: ${manifest.page?.isPublished ? 'Published' : 'Draft'}\n- **Exported**: ${manifest.exportedAt}\n\n## Components (${manifest.components.length})\n`;
      const table = [
        '| # | Component | Instance | Depth | URI |',
        '| -- | -- | -- | -- | -- |',
        ...manifest.components.map(
          (c, i) =>
            `| ${i + 1} | ${c.displayName} | ${c.instance ?? '—'} | ${c.depth} | \`${c.uri}\` |`
        ),
      ].join('\n');
      return `${head}\n${table}\n`;
    }
  }
}

export function downloadManifest(manifest: PageManifest, format: ExportFormat): void {
  const text = formatManifest(manifest, format);
  const mime =
    format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/markdown';
  const ext = format === 'markdown' ? 'md' : format;
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = (manifest.title || 'clay-page').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `${slug}-manifest-${stamp}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

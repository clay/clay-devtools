// One-shot helper to render the SVG icon at extension sizes.
// Run with:  npx --yes -p sharp@0.34 node scripts/build-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const svgPath = join(root, 'scripts', 'icon-source.svg');
const outDir = join(root, 'public', 'icons');

await mkdir(outDir, { recursive: true });

const sizes = [16, 32, 48, 128];

await Promise.all(
  sizes.map((size) =>
    sharp(svgPath)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(join(outDir, `icon-${size}.png`))
      .then(() => console.log(`wrote icon-${size}.png`))
  )
);

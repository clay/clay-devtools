// Pack the built `dist/` directory into `clay-slip-vX.Y.Z.zip`, ready to
// attach to a GitHub Release (the project's only distribution channel) or
// to hand off for direct sideloading via "Load unpacked".
//
//   npm run zip                          (assumes `dist/` already exists)
//   npm run release:dry                  (validate + build + zip in one shot)
//   INCLUDE_SOURCEMAPS=1 npm run zip     (keep .map files; useful for debugging)
//
// Why this script exists instead of `cd dist && zip -r ../slip.zip .`:
//   - When users sideload the extension via "Load unpacked", they have to
//     point Chrome at a folder containing `manifest.json` at the *top*
//     level. Right-clicking `dist/` in Finder → Compress produces a zip
//     with a `dist/` folder wrapper, which forces every user to drill in
//     one extra level after unzipping (and is the same layout the Chrome
//     Web Store rejects with "No manifest found in package." if we ever
//     do publish there).
//   - macOS adds `__MACOSX/` resource forks and `.DS_Store` files to zips
//     made by Finder. Both clutter the unzipped folder users see.
//   - Sideloaded builds don't need source maps; stripping them halves the
//     download size and avoids shipping source.
//
// This script:
//   1. Wipes any stale zip with the same name.
//   2. Zips the *contents* of `dist/` (so `manifest.json` is at the root).
//   3. Excludes `*.map`, `.DS_Store`, and `__MACOSX/` by default.
//   4. Verifies after the fact that `manifest.json` is at the root; refuses
//      to ship the zip if not.
//
// Cross-platform: uses `zip` on macOS/Linux and PowerShell's
// `Compress-Archive` on Windows. Either is preinstalled on a clean dev box.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const isFirefox = process.env.TARGET === 'firefox';
const distDir = join(root, isFirefox ? 'dist-firefox' : 'dist');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const outName = `clay-slip-v${pkg.version}${isFirefox ? '-firefox' : ''}.zip`;
const outPath = join(root, outName);
const includeMaps = process.env.INCLUDE_SOURCEMAPS === '1';

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error(`✖ ${distDir} not found. Run \`npm run build\` first.`);
  process.exit(1);
}

if (!existsSync(join(distDir, 'manifest.json'))) {
  console.error(`✖ ${distDir}/manifest.json missing — the build looks broken.`);
  process.exit(1);
}

if (existsSync(outPath)) rmSync(outPath);

const isWindows = process.platform === 'win32';

// Patterns to drop. Source maps are dropped by default; opt in via env.
const excludeUnix = ['.DS_Store', '__MACOSX/*', ...(includeMaps ? [] : ['*.map'])];

const cmd = isWindows ? 'powershell.exe' : 'zip';
const args = isWindows
  ? ['-NoProfile', '-Command', buildPowerShellCommand(outName, includeMaps)]
  : ['-r', '-X', outPath, '.', ...excludeUnix.flatMap((p) => ['--exclude', p])];

// On Unix we run *inside* dist/ so paths in the zip are relative to it
// (manifest.json at the root, not dist/manifest.json).
const cwd = isWindows ? root : distDir;

const child = spawn(cmd, args, { cwd, stdio: 'inherit' });

child.on('error', (err) => {
  console.error(`✖ Failed to launch packager: ${err.message}`);
  if (!isWindows) {
    console.error(
      '  Make sure the `zip` command is installed (it ships with macOS and most distros).'
    );
  }
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`✖ Packager exited with code ${code}`);
    process.exit(code ?? 1);
  }
  verifyManifestAtRoot(outPath);
  const sizeKb = (statSync(outPath).size / 1024).toFixed(1);
  console.log('');
  console.log(`✓ wrote ${outName} (${sizeKb} KB${includeMaps ? ', with source maps' : ''})`);
  console.log('');
  console.log('Next steps:');
  console.log('  Local smoke-test:');
  console.log(`    1. Unzip ${outName} into a stable folder.`);
  console.log('    2. Open chrome://extensions → enable Developer mode.');
  console.log('    3. Click "Load unpacked" and select the unzipped folder.');
  console.log('');
  console.log('  Publishing:');
  console.log('    Tag a release (`npm version` then `git push --follow-tags`)');
  console.log('    and the GitHub Action attaches an identical zip to a draft');
  console.log('    release. See README → "Releasing" for the full flow.');
});

/**
 * Read the zip's central directory and assert that `manifest.json` exists
 * at the root (no folder prefix). Catches the most common upload-rejection
 * mistakes: zipping the parent folder, or zipping with a `dist/` wrapper.
 */
function verifyManifestAtRoot(zipPath) {
  // `unzip -p zipPath manifest.json` exits 0 only when the file exists at
  // exactly that path inside the zip. It's available on macOS/Linux and
  // ships with Git for Windows (via the bundled MSYS2 tools), so it's a
  // safe baseline for our supported environments.
  const probe = spawnSync('unzip', ['-p', zipPath, 'manifest.json'], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  if (probe.status === 0) return;

  // No `unzip` available (rare on Windows without Git Bash). Fall back to
  // a PowerShell probe so we still catch obvious mistakes.
  if (isWindows && probe.error) {
    const ps = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead('${zipPath}'); try { if ($z.Entries | Where-Object { $_.FullName -eq 'manifest.json' }) { exit 0 } else { exit 1 } } finally { $z.Dispose() }`,
      ],
      { stdio: ['ignore', 'ignore', 'ignore'] }
    );
    if (ps.status === 0) return;
  }

  console.error('');
  console.error(`✖ ${outName} does not contain manifest.json at the root.`);
  console.error('  Users would need to drill into a subfolder after unzipping');
  console.error('  before "Load unpacked" would accept the folder, and the');
  console.error('  Chrome Web Store would reject this layout outright.');
  console.error('  Likely cause: the script ran outside dist/ or with a folder wrapper.');
  console.error('  Re-run `npm run build && npm run zip`.');
  process.exit(2);
}

function buildPowerShellCommand(zipName, keepMaps) {
  // Build a Compress-Archive invocation that filters out `.DS_Store`,
  // `__MACOSX`, and (by default) `*.map`.
  const filters = ["$_.Name -ne '.DS_Store'", "$_.FullName -notmatch '__MACOSX'"];
  if (!keepMaps) filters.push("$_.Name -notlike '*.map'");
  const where = filters.join(' -and ');
  const srcDir = isFirefox ? 'dist-firefox' : 'dist';
  return `
    $items = Get-ChildItem -Path '${srcDir}' -Recurse -File | Where-Object { ${where} };
    Compress-Archive -Path $items.FullName -DestinationPath '${zipName}' -Force
  `.trim();
}

// Pack the built `dist/` directory into `clay-slip-vX.Y.Z.zip`, ready to
// upload to the Chrome Web Store dashboard or to share for sideloading.
//
//   npm run zip                          (assumes `dist/` already exists)
//   npm run release:dry                  (validate + build + zip in one shot)
//   INCLUDE_SOURCEMAPS=1 npm run zip     (keep .map files; useful for debugging)
//
// Why this script exists instead of `cd dist && zip -r ../slip.zip .`:
//   - The Chrome Web Store rejects uploads where `manifest.json` is not at
//     the *root* of the zip. Right-clicking `dist/` in Finder → Compress
//     produces a zip with a `dist/` folder wrapper, which fails validation
//     with "No manifest found in package."
//   - macOS adds `__MACOSX/` resource forks and `.DS_Store` files to zips
//     made by Finder. Some Web Store checks choke on them.
//   - Production uploads don't need source maps; stripping them halves the
//     upload size and avoids leaking source.
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
const distDir = join(root, 'dist');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const outName = `clay-slip-v${pkg.version}.zip`;
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
  console.log('  1. Upload this file to the Chrome Web Store dashboard:');
  console.log('     https://chrome.google.com/webstore/devconsole');
  console.log('  2. Pick this extension → Package → Upload new package');
  console.log(`  3. Choose: ${outName}`);
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
  console.error('  This zip would be rejected by the Chrome Web Store.');
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
  return `
    $items = Get-ChildItem -Path 'dist' -Recurse -File | Where-Object { ${where} };
    Compress-Archive -Path $items.FullName -DestinationPath '${zipName}' -Force
  `.trim();
}

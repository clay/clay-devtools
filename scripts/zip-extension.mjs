// Pack the built `dist/` directory into `clay-slip-vX.Y.Z.zip`, ready to
// upload to the Chrome Web Store dashboard or to share for sideloading.
//
//   npm run zip            (assumes `dist/` already exists)
//   npm run release:dry    (validate + build + zip in one shot)
//
// Cross-platform: shells out to `zip` on macOS/Linux and PowerShell's
// `Compress-Archive` on Windows. Either is preinstalled on a clean dev box.

import { spawn } from 'node:child_process';
import { existsSync, statSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'dist');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const outName = `clay-slip-v${pkg.version}.zip`;
const outPath = join(root, outName);

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error(`✖ ${distDir} not found. Run \`npm run build\` first.`);
  process.exit(1);
}

if (existsSync(outPath)) {
  rmSync(outPath);
}

const isWindows = process.platform === 'win32';

const cmd = isWindows ? 'powershell.exe' : 'zip';
const args = isWindows
  ? [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path 'dist/*' -DestinationPath '${outName}' -Force`,
    ]
  : ['-r', outPath, '.'];

const cwd = isWindows ? root : distDir;

const child = spawn(cmd, args, { cwd, stdio: 'inherit' });

child.on('error', (err) => {
  console.error(`✖ Failed to launch packager: ${err.message}`);
  if (!isWindows) console.error('  Make sure the `zip` command is installed (it ships with macOS/most distros).');
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`✖ Packager exited with code ${code}`);
    process.exit(code ?? 1);
  }
  const size = (statSync(outPath).size / 1024).toFixed(1);
  console.log(`✓ wrote ${outName} (${size} KB)`);
});

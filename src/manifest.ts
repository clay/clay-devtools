import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json' with { type: 'json' };

// Chrome Web Store rejects uploads with `manifest.description` > 132 chars.
// Catch the regression at build time, where it's easy to fix, instead of at
// upload time, where it bricks a release.
const MAX_DESCRIPTION_CHARS = 132;
if (pkg.description.length > MAX_DESCRIPTION_CHARS) {
  throw new Error(
    `package.json "description" is ${pkg.description.length} chars; Chrome Web Store limit is ${MAX_DESCRIPTION_CHARS}.`
  );
}

export default defineManifest({
  manifest_version: 3,
  name: 'Clay Slip',
  short_name: 'Slip',
  version: pkg.version,
  description: pkg.description,
  minimum_chrome_version: '116',

  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },

  action: {
    default_title: 'Toggle Clay Slip',
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },

  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },

  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },

  // The static content_scripts entry below declares the *maximum* scope
  // (`<all_urls>`), but Chrome only auto-injects on origins where the user
  // has granted host access. Because we declare zero required
  // `host_permissions` and the broad pattern lives in
  // `optional_host_permissions`, on a fresh install the script runs
  // nowhere. Once the user grants `https://example.com/*` from the Options
  // page, Chrome auto-injects on that host from then on.
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],

  // Permissions are deliberately minimal — see PRIVACY.md for the
  // per-permission justification used in the Chrome Web Store listing:
  //   activeTab      → captureVisibleTab for the Screenshot feature
  //   storage        → user prefs (sync) + annotations/recents (local)
  //   clipboardWrite → all "Copy to clipboard" panel actions
  permissions: ['activeTab', 'storage', 'clipboardWrite'],

  // Required host access at install time: NONE.
  // The user grants specific origins from the Options page; Chrome shows
  // a native consent prompt on each addition. This keeps Clay Slip out of
  // the "Broad Host Permissions" review queue while still letting the
  // tool work on any Clay deployment the user chooses to point it at.
  host_permissions: [],
  optional_host_permissions: ['<all_urls>'],
});

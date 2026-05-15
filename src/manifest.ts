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

const isFirefox = process.env.TARGET === 'firefox';

// Firefox needs a gecko block for installable signing. Service worker
// background scripts require Firefox 121+; below that, MV3 extensions
// must use `background.scripts` instead, which crxjs doesn't emit.
const firefoxExtras = isFirefox
  ? {
      browser_specific_settings: {
        gecko: {
          id: 'clay-slip@slate.com',
          strict_min_version: '121.0',
          data_collection_permissions: { required: ['none' as const] },
        },
      },
    }
  : { minimum_chrome_version: '116' };

export default defineManifest({
  manifest_version: 3,
  name: 'Clay Slip',
  short_name: 'Slip',
  version: pkg.version,
  description: pkg.description,
  ...firefoxExtras,

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

  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],

  // Permissions are deliberately minimal — see PRIVACY.md for the
  // per-permission justification used in the Chrome Web Store listing:
  //   activeTab     → captureVisibleTab for the Screenshot feature
  //   storage       → user prefs (sync) + annotations/recents (local)
  //   clipboardWrite → all "Copy to clipboard" panel actions
  permissions: ['activeTab', 'storage', 'clipboardWrite'],
  host_permissions: ['<all_urls>'],
});

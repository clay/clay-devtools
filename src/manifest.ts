import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json' with { type: 'json' };

// 132-char ceiling on `manifest.description` is enforced by both Chrome
// Web Store *and* AMO. We don't currently publish on either store
// (releases ship as zips on GitHub), but keeping the field within the
// stricter store limit means we'd never have to truncate at submit time
// if that ever changes — and 132 is plenty for an honest one-liner.
const MAX_DESCRIPTION_CHARS = 132;
if (pkg.description.length > MAX_DESCRIPTION_CHARS) {
  throw new Error(
    `package.json "description" is ${pkg.description.length} chars; the manifest "description" field is capped at ${MAX_DESCRIPTION_CHARS} (Chrome Web Store + AMO).`
  );
}

// We build the same source twice: once for Chromium-family browsers
// (default) and once for Firefox (`TARGET=firefox`). The differences are
// confined to `firefoxExtras` below + a tiny postbuild step in
// `scripts/firefox-postbuild.mjs` that rewrites a couple of MV3 fields
// crxjs emits in the Chromium-only shape.
const isFirefox = process.env.TARGET === 'firefox';

// Firefox-specific manifest fields:
//   - `browser_specific_settings.gecko.id` is required for any extension
//     that wants to install (signed or temporary) on Firefox; no default
//     synthesis like Chromium has.
//   - `strict_min_version: 121.0` is the floor we test against. Firefox
//     shipped MV3 in 121 (Dec 2023), and that's also the first stable
//     release where ES-module background scripts (`background.scripts`
//     with `type: 'module'`) work — the form we rewrite to in the
//     postbuild step. Older Firefox would silently fail to load the
//     background.
//   - `data_collection_permissions.required: ['none']` is Firefox's
//     newer disclosure mechanism (AMO uses it for the listing labels);
//     we collect nothing, so this is the only honest value.
//
// Chromium gets `minimum_chrome_version: 116` for the same reason —
// MV3 + the storage/clipboard/scripting features we depend on are all
// stable from there.
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

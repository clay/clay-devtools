# Clay Slip

> A modern Chromium + Firefox extension for exploring [Clay](https://github.com/clay) CMS pages.

Clay annotates rendered HTML with `data-uri` attributes on every component, page, and layout. Clay Slip reads those attributes and gives you a powerful developer overlay — visualize component boundaries, inspect data, jump between published and draft versions, and copy URIs without ever opening DevTools.

The same source builds for both browser families:

- **Chromium-family** (Chrome, Edge, Brave, Arc, Vivaldi, Opera, …)
- **Firefox** 121+ (uses the [`webextension-polyfill`](https://github.com/mozilla/webextension-polyfill) at runtime; manifest is post-processed to swap in the `background.scripts` form Firefox MV3 expects)

![Clay Slip panel inspecting a page](docs/screenshots/inspect.png)

## Highlights

- **Manifest V3** extension built with TypeScript, React, Vite, and `@crxjs/vite-plugin` — single source, dual build for Chromium and Firefox
- **Shadow-DOM panel** that never collides with host page styles
- **Component tree + find-on-page** — live filter dims non-matches on the page, <kbd>Enter</kbd> cycles through them, <kbd>Esc</kbd> clears
- **Inline JSON preview** so you don't need to open a new tab to read component data
- **Diff view** comparing the published version against the unpublished draft, **or** the same URI on a different environment using the site host mappings
- **Site host mappings** — the single source of truth for cross-env navigation. Per-brand hostname config that powers a one-click _View on prod / staging / qa_ pill row, a cross-env Share menu, and the Diff tab&rsquo;s env-vs-env compare options
- **Open in Clay editor** — jump from the page or any component straight into Clay edit mode (always opens the unpublished version)
- **Sticky-note annotations** pinned to component URIs, surfaced as a dot on the page and a dedicated Notes tab — leave async review notes for teammates
- **Page audit export** to clipboard as JSON, CSV, or Markdown — every component on the page, ready to paste into a ticket or QA checklist
- **Shareable selection links** — copy a `?clay-slip-select=…` URL that auto-opens the panel and selects the same component on someone else's machine
- **Component screenshot to clipboard** — one-click PNG of any selected component, panel auto-hides during capture
- **SEO tab** — title / meta / og / twitter / JSON-LD with a Twitter + Facebook card preview and lints (length, missing image, duplicate `<h1>`, etc.)
- **Recently viewed components** persisted across sessions, with one-click jump back
- **Resizable + dockable panel** — drag the inner edges (or the inner-corner grabber) to resize width _and_ height; choose any of four corners or a full-height left/right side dock
- **Refined highlight modes** — _Off_, _Selection_ (default; pristine page, hover and click highlight in blue, hold <kbd>⌃</kbd> Control to flash the rainbow over every component), _Editable only_ (always-on subtle corner accents on `[data-editable]`), or _All components_ (always-on rainbow over every component, like the original Clay devtools). Hover and selected always paint in a single blue accent — outline + inset tint — so the "you clicked it" feedback reads consistently across every mode, on top of either the rainbow or the corner-accent ambient layer. Top-left labelled badge follows your hover and selection. Switch modes from the panel header dropdown or with the <kbd>h</kbd> shortcut.
- **Passive in Clay edit mode** — on `?edit=true` pages, the panel still mounts and every read-only feature stays available (Tree, JSON, Diff, SEO, Notes, copy buttons, `View on…` pills, opening the Page/Edit/Metadata links) — but the extension stops painting outlines on the host page and stops listening for clicks/hovers there so it never competes with Clay&rsquo;s own in-page editor chrome. To inspect a component, pick it from the Tree tab.
- **Auto / light / dark themes** that respond to OS theme changes live
- **Keyboard shortcuts** with a <kbd>?</kbd> overlay listing every binding
- **Options page** for theme, dock side + width, site host mappings, highlight mode + intensity, shortcut toggle, and recents history size
- **Floating Clay button (FAB)** on every Clay page — collapsed/idle state of the panel is a small circular button anchored to the user's preferred corner, with a live component-count badge. Click it to expand the full panel. The standard browser-extension chrome pattern (Sentry / Hotjar / Crisp / Intercom).
- **Smart popup**: friendly "Not a Clay page" popup on non-Clay pages; on Clay pages the toolbar icon mounts/unmounts the entire extension as an escape hatch
- **Toolbar badge** shows the count of Clay components on the current page (cleared on navigation)
- **Click-through-aware selection**: the panel selects the component you clicked but lets real interactive elements (links, buttons, inputs) keep working
- **Copy-as menu**: URI / cURL / `fetch()` snippet / CSS selector — every snippet uses the URI&rsquo;s embedded host
- **Vitest** unit tests and **GitHub Actions** CI on every PR

## Install

Clay Slip is distributed as `.zip` files attached to every release on this repo. There is **no Chrome Web Store or AMO listing** — installation is sideloaded. Each release ships two zips:

- `clay-slip-vX.Y.Z.zip` — for Chrome, Edge, Brave, Arc, Vivaldi, Opera, and any other Chromium-based browser.
- `clay-slip-vX.Y.Z-firefox.zip` — for Firefox 121+.

Pick the matching zip for your browser from the [latest release](https://github.com/clay/clay-devtools/releases/latest), then follow the section below for that browser family.

### Chromium browsers (Chrome / Edge / Brave / Arc / Vivaldi / Opera)

#### First-time install

1. Download `clay-slip-vX.Y.Z.zip` from the [latest release](https://github.com/clay/clay-devtools/releases/latest) (under **Assets**, near the bottom of the release notes).
2. **Unzip it** to a stable folder on your machine — e.g. `~/Applications/clay-slip/`, `~/Documents/clay-slip/`, or wherever you like to keep developer tooling. **Don't move or delete this folder later.** Chrome reads the extension from it on every browser start; if the folder disappears, the extension stops working until you reinstall.
3. Open the extensions page in your browser:
   - Chrome → `chrome://extensions`
   - Edge → `edge://extensions`
   - Brave → `brave://extensions`
   - Arc / Vivaldi / Opera / other Chromium browsers → same URL pattern.
4. Toggle **Developer mode** on (top-right corner of the page).
5. Click **Load unpacked** and select the unzipped folder you created in step 2. The folder you pick must contain `manifest.json` at the top level — if you have to drill into a subfolder to see `manifest.json`, pick that subfolder instead.
6. The Clay icon now appears in your extensions list. Click the puzzle-piece icon in the browser toolbar and pin Clay Slip so it stays visible.

That's it — visit any Clay-rendered page and the floating Clay button appears in the corner.

> **About the "Developer mode" warning.** Chrome shows a yellow banner reminding you that extensions are loaded in developer mode. This is normal for any sideloaded (non–Web-Store) extension and can be ignored. It does **not** mean the extension is unsafe; it's the same code attached to the GitHub release. Closing the warning popup that appears on each Chrome startup keeps the extension active.

#### Updating to a new version

1. Download the new `clay-slip-vX.Y.Z.zip` from the [Releases page](https://github.com/clay/clay-devtools/releases).
2. Unzip it **over the existing folder** (replace the old contents) so the path Chrome remembers is still valid.
3. Open the extensions page, find Clay Slip, and click the circular **↻ Reload** icon. Or restart the browser — same effect.

Your settings, notes, and "recently viewed" history are preserved across updates; they live in browser storage, not in the extension folder.

### Firefox 121+

Firefox doesn't allow permanently installing unsigned extensions on the standard release / ESR channels — you have to either load it as a temporary add-on (which lives until you restart Firefox), or use Firefox Developer Edition / Nightly with signature checks disabled. Both flows are documented below.

#### Option A — temporary add-on (any Firefox 121+, but resets on restart)

1. Download `clay-slip-vX.Y.Z-firefox.zip` from the [latest release](https://github.com/clay/clay-devtools/releases/latest) and **unzip it** to a stable folder.
2. Open `about:debugging#/runtime/this-firefox` in a new tab.
3. Click **Load Temporary Add-on…** and select the `manifest.json` file inside the unzipped folder.
4. The Clay icon now appears next to your other extension icons. Visit any Clay-rendered page and the floating Clay button appears in the corner.

> Firefox **unloads temporary add-ons on browser restart** — you'll need to repeat steps 2–3 each time you launch Firefox. For a persistent install, use Option B.

#### Option B — persistent install on Developer Edition / Nightly

1. Install [Firefox Developer Edition](https://www.mozilla.org/firefox/developer/) or [Firefox Nightly](https://www.mozilla.org/firefox/channel/desktop/#nightly) — both let you turn off signature checks. (The standard Firefox release does not.)
2. Open `about:config` and set `xpinstall.signatures.required` to `false`.
3. Download `clay-slip-vX.Y.Z-firefox.zip`, **rename the file extension** from `.zip` to `.xpi` (Firefox installs XPI bundles, which are the same zip format with a different extension).
4. Drag the `.xpi` onto a Firefox window, or open it via **About Firefox → Add-ons → Install Add-on From File…**, and confirm the install.

Updates: download the new `-firefox.zip`, rename to `.xpi`, and re-install — Firefox prompts to upgrade in place. Settings, notes, and recents persist across updates because they live in `browser.storage`, not in the add-on bundle.

### Removing the extension

- **Chromium**: open the extensions page → find Clay Slip → **Remove**, then delete the unzipped folder.
- **Firefox**: `about:addons` → Clay Slip → **Remove**.

Stored preferences/notes can also be cleared from the Options page (**Clear recents**) or via your browser's _Manage extensions_ → _Site access / storage_ controls.

### Troubleshooting

| Symptom                                                                           | Fix                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _"Manifest file is missing or unreadable"_                                        | The folder you picked doesn't contain `manifest.json` at its top level. Look one level deeper inside the unzipped folder (some unzippers wrap the contents in an extra folder).                                                                          |
| Extension disappeared after restart                                               | **Chromium**: the unzipped folder was moved or deleted — re-unzip the release zip to the same path and **Load unpacked** again. **Firefox**: temporary add-ons unload on restart by design (see Option A above) — use Option B for a persistent install. |
| Toolbar icon greyed out on a page                                                 | That page isn't a Clay page (no `data-uri` attributes detected). The extension stays out of the way on non-Clay pages by design.                                                                                                                         |
| Clicking on the page doesn't select any component                                 | The page has `?edit=true` in the URL — by design the extension goes passive in Clay edit mode and doesn't capture page clicks. The panel is still available; pick the component from the **Tree** tab.                                                   |
| Hot reload after update doesn't pick up new code                                  | Click **↻ Reload** on the extensions page _then_ refresh the tab. Service-worker-based extensions need both.                                                                                                                                             |
| _"This add-on could not be installed because it appears to be corrupt"_ (Firefox) | Firefox's signature check rejected the unsigned XPI. Either use Option A (temporary add-on, no signing required) or follow Option B exactly — make sure `xpinstall.signatures.required = false` is set **and** you're on Developer Edition / Nightly.    |

## Usage

| Action                   | Shortcut / Click                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| Open the panel           | Click the floating **Clay** button (FAB) anchored at your preferred corner                        |
| Collapse to FAB          | Click the collapse button in the panel header (or press <kbd>[</kbd>)                             |
| Hide the extension       | Click the toolbar icon (toggles mount on/off for the current tab)                                 |
| Select a component       | Click any outlined element on the page                                                            |
| Open in Clay editor      | **Edit** button on a page or component — opens the page with `?edit=true`                         |
| Open component JSON      | Use the **Data** / **.json** / **.html** buttons in the panel                                     |
| Cross-env diff           | **Diff** tab → `Compare:` select → pick another configured env                                    |
| View page on another env | **View on:** pill row in PageInfo (one pill per env configured for this site)                     |
| Annotate a component     | **Inspect** tab, scroll to **Note**, type and Save — orange dot appears on the page               |
| Share a selection        | **Share** button copies for the current env; click **▾** to share for prod / staging / qa instead |
| Screenshot a component   | **Screenshot** button — PNG copied to clipboard                                                   |
| Export page manifest     | **Export ▾** button on the Inspect tab — copies JSON / CSV / Markdown to your clipboard           |
| Find on page             | **Tree** tab search box → matches dim non-matches; <kbd>Enter</kbd> cycles, <kbd>Esc</kbd> clears |
| Resize the panel         | Drag the inner vertical / horizontal edge — or the inner-corner grabber for both at once          |
| Copy URI                 | Press <kbd>y</kbd> then <kbd>c</kbd> (component) or <kbd>p</kbd> (page)                           |
| Open URI in new tab      | Press <kbd>o</kbd> then <kbd>c</kbd> or <kbd>p</kbd>                                              |
| Cycle highlight mode     | Press <kbd>h</kbd> (off → selection → editable → all) or pick from the eye-icon dropdown          |
| Peek at every component  | In _Selection_ mode, hold <kbd>⌃</kbd> Control to reveal the rainbow over every component         |
| Show shortcut overlay    | Press <kbd>?</kbd>                                                                                |
| Toggle FAB ↔ panel       | Press <kbd>[</kbd> or click the collapse button / the FAB                                         |
| Switch tabs              | Press <kbd>i</kbd> (Inspect) or <kbd>t</kbd> (Tree)                                               |
| Open settings            | Click the gear icon in the panel header                                                           |

## Screenshots

| Inspect                                  | Tree                               | Options                                  |
| ---------------------------------------- | ---------------------------------- | ---------------------------------------- |
| ![Inspect](docs/screenshots/inspect.png) | ![Tree](docs/screenshots/tree.png) | ![Options](docs/screenshots/options.png) |

## Configuration

### Site host mappings

The **Site host mappings** section in the options page is the **single source of truth** for cross-environment behavior. It maps each brand to its hostnames per environment. With it configured:

- The **View on:** pill row appears on every Clay page so you can jump to the equivalent URL on a different env.
- The **Share** button gains a **▾** picker for cross-env share links.
- The **Diff** tab&rsquo;s `Compare:` dropdown auto-populates with one option per other env in the matching mapping (e.g. on a `stg.thecut.com` page you get _Staging vs. Production_ and _Staging vs. QA_).

Empty by default — every fork populates its own.

Example for a Vox-Media-style multi-brand setup:

| Label   | Production      | Staging         | QA            |
| ------- | --------------- | --------------- | ------------- |
| The Cut | www.thecut.com  | stg.thecut.com  | qa.thecut.com |
| Vulture | www.vulture.com | stg.vulture.com |               |
| Curbed  | www.curbed.com  | stg.curbed.com  | qa.curbed.com |

Hostnames are matched **exactly** (case-insensitive) — no prefix stripping or wildcards — so the mapping does what you wrote and nothing more. There&rsquo;s no separate global env config; if a host isn&rsquo;t in any mapping, the extension falls back to whatever host the Clay component URI itself encodes, which is also the page&rsquo;s host.

## Build from source

For contributors and anyone who wants to run the extension from a local checkout instead of a release zip:

```bash
npm install
npm run build
```

Then in your browser's extensions page (Developer mode on) click **Load unpacked** and select the `dist/` directory. Reload the extension after every rebuild.

For live development with HMR (no manual rebuild between code changes):

```bash
npm run dev
```

When switching between `dev` and `build` outputs, click the **↻ Reload** icon on the extension card so Chrome picks up the new bundle.

## Architecture

```
src/
├── manifest.ts             # MV3 manifest in TypeScript; branches on TARGET=firefox to add gecko block
├── background/
│   └── service-worker.ts   # MV3 service worker (open tabs, badge counts)
├── content/
│   ├── index.ts            # Content script entry
│   ├── highlighter.ts      # Component outline styles (host DOM)
│   ├── shadow-host.ts      # Mounts React app inside a Shadow DOM
│   ├── page-info.ts        # Reads Clay metadata from the page
│   └── panel/              # The React panel UI
│       ├── App.tsx
│       ├── store.ts        # Zustand store
│       ├── theme.ts        # Light / dark tokens
│       ├── styles.css      # Shadow-scoped styles
│       ├── components/     # Tabs, tree, JSON viewer, diff, breadcrumb…
│       └── hooks/          # Drag, theme, shortcuts, selection
├── popup/                  # "Not a Clay page" popup (active until a page sends CLAY_DETECTED)
├── options/                # Full options page (site host mappings, dock + width, highlight mode + intensity, recents, shortcuts)
└── lib/                    # Pure utilities
    ├── clay-uri.ts         # URI parsing + buildUrl/buildEditorUrl/buildShareLink + copy-as helpers
    ├── clipboard.ts        # Modern + legacy clipboard
    ├── storage.ts          # User preferences in chrome.storage.sync
    ├── annotations.ts      # Sticky notes per component URI
    ├── recents.ts          # Recently viewed components history
    ├── exporter.ts         # Page manifest → JSON / CSV / Markdown
    ├── seo.ts              # Document head extractor + linter
    ├── screenshot.ts       # captureVisibleTab + canvas crop → clipboard PNG
    ├── site-host.ts        # Per-brand hostname mapping → cross-env URL rewrites
    └── types.ts            # Shared types + DEFAULT_PREFERENCES

```

## Scripts

| Command                       | What it does                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                 | Vite dev server with HMR                                                                                                    |
| `npm run build`               | Typecheck + Chromium production build → `dist/`                                                                             |
| `npm run build:firefox`       | Typecheck + Firefox production build → `dist-firefox/` (runs `scripts/firefox-postbuild.mjs` to rewrite the MV3 background) |
| `npm run lint`                | ESLint with zero-warning policy                                                                                             |
| `npm run lint:fix`            | ESLint auto-fix                                                                                                             |
| `npm run format`              | Prettier write                                                                                                              |
| `npm run format:check`        | Prettier check (used in CI)                                                                                                 |
| `npm run test`                | Run Vitest                                                                                                                  |
| `npm run test:watch`          | Vitest in watch mode                                                                                                        |
| `npm run test:coverage`       | Vitest with coverage                                                                                                        |
| `npm run typecheck`           | `tsc --noEmit`                                                                                                              |
| `npm run validate`            | Typecheck + lint + format check + tests                                                                                     |
| `npm run zip`                 | Pack `dist/` into `clay-slip-vX.Y.Z.zip` (Chromium)                                                                         |
| `npm run zip:firefox`         | Pack `dist-firefox/` into `clay-slip-vX.Y.Z-firefox.zip`                                                                    |
| `npm run release:dry`         | Validate + Chromium build + zip (mirrors the Chromium half of CI)                                                           |
| `npm run release:dry:firefox` | Validate + Firefox build + zip (mirrors the Firefox half of CI)                                                             |

## Releasing

Releases are automated by `.github/workflows/release.yml`. The published GitHub Release is the **only** distribution channel — there is no Chrome Web Store or AMO listing. Users follow the [Install](#install) section above to grab the matching zip for their browser family.

The flow is:

1. Bump the version + create a tag locally:

   ```sh
   npm version patch         # or `minor` / `major`
   git push --follow-tags
   ```

   `npm version` updates `package.json`, commits, and creates an annotated `vX.Y.Z` tag in one shot.

2. The push of the tag triggers the **Release** workflow, which:
   - Verifies the tag matches `package.json` (fails fast on mismatch).
   - Runs the full validation suite (typecheck / lint / format / test).
   - Builds the extension twice — once for Chromium (`npm run build`), once for Firefox (`npm run build:firefox`).
   - Zips each build using the same script as locally: `clay-slip-vX.Y.Z.zip` and `clay-slip-vX.Y.Z-firefox.zip`.
   - Creates a **draft** GitHub release with **both** zips attached and auto-generated release notes.

3. Open the draft release on GitHub, polish the notes (call out the highlights, breaking changes, install/update instructions if anything changed in those flows), and click **Publish**. Both zips become available under **Assets** for users to download.

You can also kick off the workflow manually from the Actions tab against an existing tag (useful if a release run fails midway). To package locally without going through CI:

- `npm run release:dry` → produces `clay-slip-vX.Y.Z.zip` (Chromium).
- `npm run release:dry:firefox` → produces `clay-slip-vX.Y.Z-firefox.zip` (Firefox).

Run both before tagging if you want to smoke-test in both browsers before users see them.

> **⚠️ Always use the project's zip scripts — never zip `dist/` (or `dist-firefox/`) from Finder / Explorer.**
> Right-clicking the folder produces a zip with a `dist/` wrapper, which means users would have to drill into a subfolder to find `manifest.json` when sideloading (and it's the layout both stores reject with _"No manifest found in package."_ if we ever publish there). Our script zips the **contents** of the build folder (so `manifest.json` is at the root), strips source maps and macOS metadata, and verifies the zip layout before declaring success. Pass `INCLUDE_SOURCEMAPS=1` if you need maps for debugging a sideloaded build.

## Migration notes (1.0 → 2.0)

This release is a full rewrite. There are no breaking _features_ — every capability of 1.0 is still present, plus a much larger set of new ones — but every implementation file changed:

- **Node 24 LTS** (`.nvmrc` pinned, `engines.node = ">=24"`).
- **Manifest V2 → V3**: replaces `browserAction` and the persistent background page with `action` and a service worker.
- **Vanilla JS → TypeScript 6 + React 19**: the panel UI is React inside a Shadow DOM, with strict typing.
- **Build system**: `npm` + **Vite 8** + `@crxjs/vite-plugin` for HMR-friendly extension development.
- **State**: **Zustand 5** for the panel store.
- **Testing**: **Vitest 4** + happy-dom 20; 162 tests.
- **Lint / format**: ESLint 9 flat config + `typescript-eslint@8` + Prettier 3.
- **CI**: GitHub Actions runs typecheck, lint, format check, tests, and a production build on every push and PR.

## Privacy

Clay Slip runs entirely on your device, makes no telemetry calls, and ships no remote code. See [PRIVACY.md](PRIVACY.md) for the full disclosure.

## License

MIT — see [LICENSE](LICENSE).

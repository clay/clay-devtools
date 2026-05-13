# Clay Slip

> A modern Chrome extension for exploring [Clay](https://github.com/clay) CMS pages.

Clay annotates rendered HTML with `data-uri` attributes on every component, page, and layout. Clay Slip reads those attributes and gives you a powerful developer overlay — visualize component boundaries, inspect data, jump between published and draft versions, and copy URIs without ever opening DevTools.

![Clay Slip panel inspecting a page](docs/screenshots/inspect.png)

## Highlights

- **Manifest V3** Chrome extension built with TypeScript, React, Vite, and `@crxjs/vite-plugin`
- **Shadow-DOM panel** that never collides with host page styles
- **Component tree + find-on-page** — live filter dims non-matches on the page, <kbd>Enter</kbd> cycles through them, <kbd>Esc</kbd> clears
- **Inline JSON preview** so you don't need to open a new tab to read component data
- **Diff view** comparing the published version against the unpublished draft, **or** the same URI across two environments
- **Environment switcher** that rewrites every link and JSON fetch through your configured local / dev / staging / prod host
- **Open in Clay editor** — jump from the page or any component straight into Clay edit mode
- **Sticky-note annotations** pinned to component URIs, surfaced as a dot on the page and a dedicated Notes tab — leave async review notes for teammates
- **Page audit export** as JSON, CSV, or Markdown — every component on the page, ready to drop into a ticket or QA checklist
- **Shareable selection links** — copy a `?clay-slip-select=…` URL that auto-opens the panel and selects the same component on someone else's machine
- **Component screenshot to clipboard** — one-click PNG of any selected component, panel auto-hides during capture
- **SEO tab** — title / meta / og / twitter / JSON-LD with a Twitter + Facebook card preview and lints (length, missing image, duplicate `<h1>`, etc.)
- **Recently viewed components** persisted across sessions, with one-click jump back
- **Resizable + dockable panel** — drag the inner edges (or the inner-corner grabber) to resize width _and_ height; choose any of four corners or a full-height left/right side dock
- **Toggleable component outlines** (button in the header, <kbd>h</kbd> shortcut) with a configurable opacity
- **Auto / light / dark themes** that respond to OS theme changes live
- **Keyboard shortcuts** with a <kbd>?</kbd> overlay listing every binding
- **Options page** for theme, dock side + width, environment hosts, highlight intensity, shortcut toggle, and recents history size
- **Smart popup**: friendly "Not a Clay page" popup on non-Clay pages, gets out of the way on Clay pages so the icon click toggles the panel
- **Toolbar badge** shows the count of Clay components on the current page (cleared on navigation)
- **Click-through-aware selection**: the panel selects the component you clicked but lets real interactive elements (links, buttons, inputs) keep working
- **Copy-as menu**: URI / cURL / `fetch()` snippet / Playwright locator / CSS selector — all env-host aware
- **Vitest** unit tests and **GitHub Actions** CI on every PR

## Install (development)

```bash
npm install
npm run build
```

Then in Chrome:

1. Visit `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` directory

For live development with HMR:

```bash
npm run dev
```

Reload the extension in `chrome://extensions` after switching between `dev` and `build` outputs.

## Usage

| Action                  | Shortcut / Click                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| Toggle the panel        | Click the toolbar icon (on a Clay page)                                                           |
| Select a component      | Click any outlined element on the page                                                            |
| Open in Clay editor     | **Edit** button on a page or component — opens the page with `?edit=true`                         |
| Open component JSON     | Use the **Data** / **.json** / **.html** buttons in the panel                                     |
| Cross-env diff          | **Diff** tab → `Compare:` select → pick another configured env                                    |
| Annotate a component    | **Inspect** tab, scroll to **Note**, type and Save — orange dot appears on the page               |
| Share a selection       | **Share** button → URL is copied; opening it auto-selects the component                           |
| Screenshot a component  | **Screenshot** button — PNG copied to clipboard                                                   |
| Export page manifest    | **Export ▾** button on the Inspect tab → JSON / CSV / Markdown                                    |
| Find on page            | **Tree** tab search box → matches dim non-matches; <kbd>Enter</kbd> cycles, <kbd>Esc</kbd> clears |
| Resize the panel        | Drag the inner vertical / horizontal edge — or the inner-corner grabber for both at once          |
| Copy URI                | Press <kbd>y</kbd> then <kbd>c</kbd> (component) or <kbd>p</kbd> (page)                           |
| Open URI in new tab     | Press <kbd>o</kbd> then <kbd>c</kbd> or <kbd>p</kbd>                                              |
| Toggle outlines on page | Press <kbd>h</kbd> or click the eye icon in the header                                            |
| Cycle environment       | Click the `env: …` pill at the bottom of the Inspect tab                                          |
| Show shortcut overlay   | Press <kbd>?</kbd>                                                                                |
| Collapse / expand       | Press <kbd>[</kbd> or use the header button                                                       |
| Switch tabs             | Press <kbd>i</kbd> (Inspect) or <kbd>t</kbd> (Tree)                                               |
| Open settings           | Click the gear icon in the panel header                                                           |

## Screenshots

| Inspect                                  | Tree                               | Options                                  |
| ---------------------------------------- | ---------------------------------- | ---------------------------------------- |
| ![Inspect](docs/screenshots/inspect.png) | ![Tree](docs/screenshots/tree.png) | ![Options](docs/screenshots/options.png) |

## Architecture

```
src/
├── manifest.ts             # MV3 manifest defined in TypeScript
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
├── options/                # Full options page (env hosts, dock + width, intensity, recents, shortcuts)
└── lib/                    # Pure utilities
    ├── clay-uri.ts         # URI parsing + buildUrl/buildEditorUrl/buildShareLink + copy-as helpers
    ├── clipboard.ts        # Modern + legacy clipboard
    ├── storage.ts          # User preferences in chrome.storage.sync
    ├── annotations.ts      # Sticky notes per component URI
    ├── recents.ts          # Recently viewed components history
    ├── exporter.ts         # Page manifest → JSON / CSV / Markdown
    ├── seo.ts              # Document head extractor + linter
    ├── screenshot.ts       # captureVisibleTab + canvas crop → clipboard PNG
    └── types.ts            # Shared types + DEFAULT_PREFERENCES

```

## Scripts

| Command                 | What it does                            |
| ----------------------- | --------------------------------------- |
| `npm run dev`           | Vite dev server with HMR                |
| `npm run build`         | Typecheck + production build → `dist/`  |
| `npm run lint`          | ESLint with zero-warning policy         |
| `npm run lint:fix`      | ESLint auto-fix                         |
| `npm run format`        | Prettier write                          |
| `npm run format:check`  | Prettier check (used in CI)             |
| `npm run test`          | Run Vitest                              |
| `npm run test:watch`    | Vitest in watch mode                    |
| `npm run test:coverage` | Vitest with coverage                    |
| `npm run typecheck`     | `tsc --noEmit`                          |
| `npm run validate`      | Typecheck + lint + format check + tests |

## Migration notes (1.0 → 2.0)

This release is a full rewrite. There are no breaking _features_ — every capability of 1.0 is still present, plus a much larger set of new ones — but every implementation file changed:

- **Node 24 LTS** (`.nvmrc` pinned, `engines.node = ">=24"`).
- **Manifest V2 → V3**: replaces `browserAction` and the persistent background page with `action` and a service worker.
- **Vanilla JS → TypeScript 6 + React 19**: the panel UI is React inside a Shadow DOM, with strict typing.
- **Build system**: `npm` + **Vite 8** + `@crxjs/vite-plugin` for HMR-friendly extension development.
- **State**: **Zustand 5** for the panel store.
- **Testing**: **Vitest 4** + happy-dom 20; 71 tests at launch.
- **Lint / format**: ESLint 9 flat config + `typescript-eslint@8` + Prettier 3.
- **CI**: GitHub Actions runs typecheck, lint, format check, tests, and a production build on every push and PR.

## License

MIT — see [LICENSE](LICENSE).

# Clay Slip

> A modern Chrome extension for exploring [Clay](https://github.com/clay) CMS pages.

Clay annotates rendered HTML with `data-uri` attributes on every component, page, and layout. Clay Slip reads those attributes and gives you a powerful developer overlay — visualize component boundaries, inspect data, jump between published and draft versions, and copy URIs without ever opening DevTools.

![Clay Slip panel inspecting a page](docs/screenshots/inspect.png)

## Highlights

- **Manifest V3** Chrome extension built with TypeScript, React, Vite, and `@crxjs/vite-plugin`
- **Shadow-DOM panel** that never collides with host page styles
- **Component tree** with live filter, breadcrumbs, and click-to-scroll navigation
- **Inline JSON preview** so you don't need to open a new tab to read component data
- **Diff view** comparing the published version against the unpublished draft
- **Draggable, collapsible** panel with auto / light / dark themes
- **Keyboard shortcuts** with an `?` overlay listing every binding
- **Options page** for theme, panel position, default environment, and shortcut toggles
- **Toolbar badge** shows the count of Clay components on the current page
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

| Action                | Shortcut / Click                                                        |
| --------------------- | ----------------------------------------------------------------------- |
| Toggle the panel      | Click the toolbar icon                                                  |
| Select a component    | Click any outlined element on the page                                  |
| Open component JSON   | Use the **Data** / **.json** / **.html** buttons in the panel           |
| Copy URI              | Press <kbd>y</kbd> then <kbd>c</kbd> (component) or <kbd>p</kbd> (page) |
| Open URI in new tab   | Press <kbd>o</kbd> then <kbd>c</kbd> or <kbd>p</kbd>                    |
| Show shortcut overlay | Press <kbd>?</kbd>                                                      |
| Collapse / expand     | Press <kbd>[</kbd> or use the header button                             |
| Switch tabs           | Press <kbd>i</kbd> (Inspect) or <kbd>t</kbd> (Tree)                     |
| Open settings         | Click the gear icon in the panel header                                 |

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
├── popup/                  # "Not a Clay page" popup (unused with MV3 action click)
├── options/                # Full options page
└── lib/                    # Pure utilities (clay-uri, clipboard, storage, types)
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

- **Manifest V2 → V3**: replaces `browserAction` and the persistent background page with `action` and a service worker.
- **Vanilla JS → TypeScript + React**: the panel UI is now React 18 inside a Shadow DOM.
- **Build system**: `npm` + Vite + `@crxjs/vite-plugin` for HMR-friendly extension development.
- **Testing**: Vitest + happy-dom; 33 tests at launch.
- **Lint / format**: ESLint 9 flat config + Prettier.
- **CI**: GitHub Actions runs typecheck, lint, format check, tests, and a production build on every push and PR.

## License

MIT — see [LICENSE](LICENSE).

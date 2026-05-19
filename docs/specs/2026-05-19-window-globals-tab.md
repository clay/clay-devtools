# Window Globals tab

**Status:** approved 2026-05-19 — ready for implementation
**Branch:** `feat/window-globals-tab` (off `master` @ `0641e15`)
**Target:** v2.4.0 (new feature, additive, no breaking changes)

## Summary

A new **Globals** tab in the panel that surfaces the values of user-configured `window.*` globals on the host page. Built for inspecting analytics data layers (GTM, Segment, etc.) without opening DevTools.

The user configures a list of top-level global names on the Options page (e.g. `nymGtmPage`, `window.dataLayer`). The Globals tab renders one collapsible section per configured global, each showing the value as syntax-highlighted JSON. Arrays and objects render identically. Data is read on tab open and on explicit per-section / "Refresh all" clicks — there is no ambient polling.

## Motivation

Clay pages routinely carry per-page analytics data on `window.*` globals. Today you have to switch to DevTools, type the path, and re-stringify on each navigation. Surfacing them inside the panel:

- Lets you eyeball analytics data while inspecting components in the same panel.
- Standardises naming across the team (everyone configures the same set once via Options).
- Works in passive edit mode (the panel still mounts on `?edit=true` pages, this is read-only and DOM-noninteractive — fine to run there).

## User-facing behavior

### Options page (`Options.tsx`)

A new section **"Window globals"** below "Site host mappings". Same UX as the site-host rows: one text input per entry, add/remove buttons. Inline help text:

> Top-level globals to show in the Globals tab. Enter `nymGtmPage` or `window.nymGtmPage` — both forms work. Values are serialized with `JSON.stringify`, so functions and `Symbol` values are dropped.

The list persists to `chrome.storage.sync` as `preferences.windowGlobals: string[]`.

### Globals tab (`GlobalsTab.tsx`)

- **Position:** last tab in the bar (after Notes).
- **Empty state:** when `windowGlobals.length === 0`, render copy: _"No globals configured. Add some in Options → Window globals."_ with a button that opens the Options page.
- **Populated state:** one `<details>` element per configured global, **all closed by default**. Summary line shows the path name (the normalised form — `nymGtmPage`, not `window.nymGtmPage`).
- **Opening a section** triggers a read for that path if no cached value exists. Already-cached values render immediately; the section also shows a "Refresh" button to re-read.
- **Tab-level "Refresh all" button** in the tab header re-reads every configured path.
- **Resolved values** render via the existing `JsonPreview` (which uses `highlightJson` + the existing copy-button + JSON-syntax-highlighting). Arrays and objects look identical apart from their bracket style — that's the whole point.
- **Unresolved values** (`undefined` on `window`) render as muted text: _"(not defined on this page)"_, with a tooltip explaining common causes (typo, global set after load, page not yet hydrated).
- **Serialization errors** (circular ref, throwing getters) render as muted text: _"(could not serialize: <message>)"_.

### Tab order

```
Inspect | Tree | JSON | Diff | SEO | Notes | Globals
```

## Architecture

### Why a page-bridge is needed

Content scripts run in an **isolated world** — their `window` is not the page's `window`. Reading `window.nymGtmPage` directly from the content script returns `undefined` even if the page has it. To bridge:

1. Inject a `<script>` element into the page whose `src` is a `web_accessible_resource`.
2. That script runs in the page's main world. It listens for a `postMessage` from the content script containing a correlation ID + the list of paths to read.
3. For each path, it reads `window[path]`, `JSON.stringify`s the value, posts a `{ correlationId, results }` back.
4. The script removes itself after responding.

This is the lowest-permission, most-portable approach — works identically on Chromium and Firefox (manifest is already MV3 + has `host_permissions: ['<all_urls>']`, no new permissions required).

### Files

| File | Purpose |
| --- | --- |
| `src/lib/window-globals.ts` (new) | Pure: `parseWindowGlobal(input: string) → { ok: true, key } \| { ok: false, reason }`. Strips an optional leading `window.`, validates the remainder matches `/^[$_a-zA-Z][$_a-zA-Z0-9]*$/`, rejects dots / brackets / whitespace / empty strings. |
| `src/page-bridge/read-globals.ts` (new) | The script injected into the page's main world. ~30 lines. Listens for a single namespaced postMessage, reads keys, stringifies, responds, removes itself. |
| `src/content/window-globals-bridge.ts` (new) | Content-script side. Exposes `readGlobals(paths: string[]): Promise<Record<path, ReadResult>>`. Manages correlation IDs and one Promise per in-flight read. Auto-injects the page script on first use; idempotent. |
| `src/content/panel/components/GlobalsTab.tsx` (new) | The tab. Renders sections, owns per-path read state in component-local state (`Map<path, ReadResult \| 'loading'>`). |
| `src/content/panel/store.ts` (edit) | Extend `PanelTab` union with `'globals'`. |
| `src/content/panel/components/Tabs.tsx` (edit) | Add the new tab button last in the rendered list. |
| `src/options/Options.tsx` (edit) | Add the "Window globals" section. |
| `src/lib/types.ts` (edit) | Extend `UserPreferences` with `windowGlobals: string[]`, default to `[]`. |
| `src/manifest.ts` (edit) | Add the page-bridge script to `web_accessible_resources`. crxjs handles the build-time path resolution. |
| `README.md` (edit) | One bullet in **Highlights**; one row in the **Usage** table. |

### Data flow (one Refresh click)

```
GlobalsTab           bridge (content script)        page (main world)
   │                       │                              │
   ├─readGlobals(['x'])─►  │                              │
   │                       ├─ensurePageScriptInjected()──►│ <script src="…/read-globals.js">
   │                       ├─postMessage({id, paths})────►│
   │                       │                              │ reads window.x, JSON.stringify
   │                       │                              │ removes self
   │                       │ ◄─postMessage({id, results}) │
   │ ◄─Promise resolves──  │                              │
   ├─setState(…)           │                              │
   └─re-render             │                              │
```

### Correlation IDs

Each `readGlobals` call generates a random ID (crypto.randomUUID). The bridge keeps a `Map<id, resolveFn>`. The window message listener resolves the matching promise and deletes the entry. Stale messages (no entry in the map) are ignored. This handles the user spamming "Refresh all" multiple times in quick succession.

### Origin / source checks on incoming messages

The bridge's message listener:

```ts
if (event.source !== window) return;
if (!event.data || event.data.type !== 'clay-slip:globals:result') return;
```

Plus the correlation-ID check. We never trust the page to inject phantom results.

## Edge cases & error handling

| Case | Behavior |
| --- | --- |
| Path is empty after stripping `window.` | Options page shows inline validation error; never reaches preferences. |
| Path has dots, brackets, or whitespace | Same — caught in the parser, surfaced in Options. |
| `window[key]` is `undefined` | Section renders "(not defined on this page)". |
| `JSON.stringify` throws (circular ref, throwing getter) | Section renders "(could not serialize: <message>)". |
| `window[key]` is a primitive (string, number, boolean, null) | Renders as JSON. `null` shows literally; strings get quoted. |
| `window[key]` contains functions or `Symbol`s | Silently dropped by `JSON.stringify`. The Options help text mentions this. |
| Page-bridge script fails to load (e.g. CSP blocks inline script tag) | Promise rejects with a clear error. Section renders "(could not read: page blocked the bridge — see DevTools console)". |
| Same path configured twice in Options | Parser dedups on save; second entry is silently dropped. |
| Passive (`?edit=true`) mode | Globals tab works normally. It's read-only and doesn't touch the host DOM beyond a transient `<script>` injection. |
| User removes a path from Options while the tab is open | Section disappears on next render (driven off the store). |

## Cross-browser

- Manifest changes are inside the existing dual-target system (`src/manifest.ts` + `scripts/firefox-postbuild.mjs`). No new branching.
- `webextension-polyfill` already wraps `runtime.getURL`.
- `JSON.stringify` and `window.postMessage` are spec'd identically.
- Verified by running `npm run release:dry:both` before push — both zips must build and pass validation.

## Tests

New tests target the pure logic + the wiring. Browser-runtime behavior (actual postMessage round-trip in a real page) is verified manually as part of the sideload smoke test.

| File | Tests |
| --- | --- |
| `tests/lib/window-globals.test.ts` (new) | `parseWindowGlobal`: accepts `foo`, `window.foo`, `$foo`, `_foo`; rejects empty / whitespace-only / `foo.bar` / `foo[0]` / `123foo` / `foo bar`; strips a single leading `window.` (not multiple); preserves identifiers that legitimately start with `_` or `$`. |
| `tests/content/window-globals-bridge.test.ts` (new) | `readGlobals` round-trip via mocked `postMessage`: resolves with results keyed by path; correlation IDs prevent cross-talk between concurrent calls; stale messages (unknown correlation ID) are ignored; missing paths come back as `{ ok: false, reason: 'undefined' }`. |
| `tests/content/panel/components/GlobalsTab.test.tsx` (new) | Empty state when `windowGlobals` is empty; one `<details>` per configured path; clicking Refresh on a section triggers the bridge for just that path; "Refresh all" triggers all paths; unresolved values render the "(not defined on this page)" placeholder. |
| `tests/options/Options.test.tsx` (extend if exists, else new minimal coverage) | Add row → input validates against parser → save persists to storage; remove row removes it. |
| `tests/lib/storage.test.ts` (extend) | `loadPreferences` defaults `windowGlobals` to `[]` when absent; `savePreferences` round-trips the new field. |

Goal: existing 176 tests + ~12–15 new = ~190 total. All must pass on the polyfill mock in `tests/setup.ts` (Firefox-compatible by construction).

## Out of scope (YAGNI)

These were considered and explicitly dropped for v1:

- **Dot-paths / nested access** (`window.foo.bar`). Confirmed not needed — top-level globals cover the analytics use case. Easy to add later by upgrading the parser.
- **Live updates** (polling / `dataLayer.push` wrapping). Manual refresh is sufficient and avoids any ambient cost on the host page.
- **Per-section truncation** for very large objects. Will revisit only if someone actually hits a slow stringify.
- **Export / "Copy as cURL" for globals.** The existing `JsonPreview` already has a copy button; that's enough.
- **Persisting the last-read snapshot across panel reopen.** Read on open is fast enough that caching adds more complexity than it saves.

## Performance

Documented in the previous design conversation; reproduced here for the record:

- **Zero ambient cost** while panel is closed, while Globals tab is inactive, or while no reads are in flight.
- **Per-Refresh cost** is dominated by `JSON.stringify`: < 0.1ms for small analytics objects, ~1–3ms for a 50-event GTM `dataLayer`, tens of ms only for pathological multi-MB objects. All on the main thread, only on explicit user action.

## Validation gate

Before pushing:

```sh
npm run validate            # typecheck + lint + format + all tests (~190)
npm run release:dry:both    # both zips build cleanly; manifest shapes correct
```

Manual smoke test (load `dist/` unpacked, browse to a Clay page with `window.dataLayer` set):

1. Configure `dataLayer` and `nymGtmPage` in Options.
2. Open the Globals tab — both sections present, both collapsed.
3. Open the first section — read fires, JSON renders.
4. Click Refresh on the section — read fires again, JSON re-renders.
5. Remove a path in Options — section disappears.
6. Configure a deliberately-missing path (`thisDoesNotExist`) — section shows "(not defined on this page)".

## Risks

| Risk | Mitigation |
| --- | --- |
| Strict-CSP pages may block the injected `<script>` (e.g. `script-src 'self'`) | Catch the load error, render the per-section "(could not read)" message. Document in README troubleshooting. |
| Pages using a Trusted Types policy may reject `<script>.src` assignment | Same — clear error in the UI. |
| Future support for nested paths would require parser + bridge changes | Designed so the parser is a single pure function; expanding it is a contained change. |

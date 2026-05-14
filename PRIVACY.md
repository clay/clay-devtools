# Privacy policy — Clay Slip

_Last updated: 2026-05-13_

Clay Slip is a developer tool. It runs entirely on your device, in your browser. **It does not collect, transmit, sell, or share any personal data.**

This document is the canonical privacy disclosure linked from the [Chrome Web Store listing](https://chrome.google.com/webstore/devconsole).

---

## TL;DR

- **No analytics.** No telemetry, no error reporting, no usage tracking.
- **No remote code.** All JavaScript is bundled at build time. The extension never loads scripts from the network.
- **No accounts.** The extension does not have any concept of "user" or "session"; nothing is signed in.
- **No third-party endpoints.** The only network calls the extension makes are to the same Clay site you are already viewing.
- **No data leaves your device.** Preferences and notes are stored using `chrome.storage`, which keeps them on your machine (or, for `sync` storage, in your own Google account). The Clay Slip developers never see them.

---

## What the extension stores locally

Clay Slip uses the standard Chrome storage APIs. Stored data never leaves the user's device or Google account.

| Storage area           | Contents                                                                                                       | Why                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `chrome.storage.sync`  | UI preferences (theme, panel position/size, environment hosts, site host mappings, shortcut + outline toggles) | Carries your settings across browsers when you're signed in to Chrome.                                |
| `chrome.storage.local` | Sticky-note annotations pinned to component URIs; "recently viewed components" history (capped, configurable)  | Keeps notes and history available offline; not synced because they may include page-specific context. |

You can clear everything from the extension's **Options** page (Reset preferences, Clear history) or via Chrome → _Manage extensions_ → _Site access / storage_.

---

## What the extension reads from the page

To do its job, the content script reads:

- The `data-uri` and `data-editable` attributes that Clay sites set on rendered components.
- Standard `<head>` metadata (`<title>`, `<meta>` tags, `<link rel="canonical">`, JSON-LD) for the SEO tab.
- The text/HTML of components you explicitly select for the JSON tab and Diff tab.

This data is **only ever displayed inside the panel on your machine.** It is never sent anywhere except, when you explicitly ask, to the same Clay host the page came from (see "Outbound network requests" below).

---

## Outbound network requests

The extension makes outbound `fetch()` requests **only when you initiate them** by interacting with one of these features:

- **JSON tab**: fetches `<componentUri>.json` from the host you are currently browsing.
- **Diff tab**: fetches the `.json` for two component URIs you select (published vs draft, or across two environments resolved from your site host mappings).
- **fetch() / cURL "Copy as…" actions**: do not make a request — they only generate a snippet you can paste elsewhere.

All of these requests target the Clay site you are already browsing (or another Clay environment you have explicitly configured under **Options → Site host mappings**). They are sent with `credentials: 'include'` so your existing browser session is reused — Clay Slip never asks for, intercepts, or stores any credentials of its own.

**No request is ever sent to any server controlled by the Clay Slip developers.** There is no analytics endpoint, no telemetry endpoint, and no auth backend.

---

## Permissions and why each is requested

| Permission       | Why it's requested                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `activeTab`      | Used by the Screenshot feature: when you click _Screenshot_ on a selected component, the service worker calls `chrome.tabs.captureVisibleTab` and crops the result to the component's bounding box. The PNG is written to your clipboard and discarded — never uploaded. |
| `storage`        | Persists the user-controlled state described in the table above. Local-only.                                                                                                                                                                                             |
| `clipboardWrite` | Implements the panel's _Copy URI_, _Copy as cURL/fetch()/CSS_, _Share_, _Export_, and _Screenshot_ actions. Each clipboard write is initiated by an explicit user click.                                                                                                 |
| `<all_urls>`     | The content script must run on every page so it can detect Clay-rendered pages by reading the `data-uri` attribute on `<html>`. On non-Clay pages the extension exits immediately without reading or modifying anything else.                                            |

The extension does **not** request `cookies`, `webRequest`, `webNavigation`, `history`, `bookmarks`, `identity`, `notifications`, `geolocation`, or any other sensitive permission.

---

## Remote code

Clay Slip does **not** execute remote code.

- All JavaScript ships in the `.zip` you download from the Chrome Web Store, bundled at build time by Vite/Rollup.
- The extension contains no `eval()` or `new Function(string)` calls of remote payloads.
- The extension does not load scripts from any CDN or remote host at runtime.

---

## Data sale and sharing

- **Clay Slip does not sell user data.** There is no user data to sell — none is collected.
- **Clay Slip does not share user data with third parties.** No third parties are integrated.
- **Clay Slip does not use data for any purpose unrelated to its single purpose** of inspecting Clay CMS pages in your browser.
- **Clay Slip does not use data to determine creditworthiness or for lending purposes.**

---

## Children's privacy

Clay Slip is a developer tool not directed at children under 13. It collects no information from anyone, including children.

---

## Changes to this policy

If a future release ever changes any of the above (e.g. starts collecting telemetry), this file will be updated in the same release and the change will be called out in the GitHub release notes.

---

## Contact

Questions, concerns, or audit requests: open an issue at <https://github.com/clay/clay-devtools/issues>.

/**
 * Bridge for reading `window.*` globals out of the host page's main world.
 *
 * Content scripts run in an *isolated world* — their `window` is distinct
 * from the page's. Reading `window.nymGtmPage` directly from a content
 * script returns `undefined` even if the page has it. To get at page
 * globals we need code running in the page's main world.
 *
 * Approach: inject a one-time `<script>` element whose `textContent` is
 * the bridge code (string-inlined below). The injected script installs
 * a persistent message listener on `window` that:
 *   1. Listens for `clay-slip:globals:request` postMessages from the
 *      content script.
 *   2. Reads each requested key off `window`, `JSON.stringify`s the
 *      value, posts a `clay-slip:globals:result` back with the same
 *      correlation ID.
 *
 * Why inline-string + persistent listener (vs. `chrome.scripting.executeScript`
 * with `world: 'MAIN'`, or a separate web_accessible_resource):
 *
 *   - `world: 'MAIN'` requires Firefox 128+; our `strict_min_version`
 *     is 121, so it would silently no-op on older Firefox.
 *   - A separate WAR file means an extra Vite build entry, hashed
 *     filenames the content script has to resolve via `chrome.runtime.getURL`,
 *     and divergent handling between Chromium and Firefox WAR semantics.
 *     For ~30 lines of bridge code, the inline-string version is
 *     dramatically simpler.
 *   - Persistent listener (vs. inject-per-call) saves the DOM-mutation
 *     cost on every Refresh click. Idempotent install means subsequent
 *     mounts are no-ops.
 *
 * Risks:
 *   - Pages with a strict CSP (`script-src 'self'` without `unsafe-inline`)
 *     reject the injection. We catch the failure on the content-script
 *     side by timing out the pending request and surface
 *     `{ ok: false, reason: 'bridge-unavailable' }` so the Globals tab
 *     can render a clear "(could not read)" message.
 *   - Pages running a Trusted Types policy may reject `textContent`
 *     assignment to a `<script>` element. Same fallback applies.
 *
 * Security:
 *   - The bridge listener only acts on messages where `event.source === window`
 *     so other pages / extensions can't trigger reads.
 *   - The content script only resolves a Promise if the incoming result
 *     carries a correlation ID we issued. Forged results are ignored.
 *   - Only the keys the user has configured in Options are ever read —
 *     we never expose an "arbitrary path" remote API.
 */

const REQUEST_TYPE = 'clay-slip:globals:request';
const RESULT_TYPE = 'clay-slip:globals:result';
const INSTALLED_FLAG = '__claySlipGlobalsBridgeInstalled' as const;

/**
 * The actual page-world code. Kept as a single string so we can inline
 * it via `<script>.textContent`. No imports; uses only globals.
 *
 * Notes on the body:
 *   - `JSON.stringify` on a function returns `undefined` (not a string).
 *     We treat that as `{ ok: false, reason: 'not-serializable' }` so
 *     the panel renders something explicit rather than swallowing it.
 *   - Property access can throw if `window[key]` is a getter that
 *     throws (rare but possible — some analytics libs do this on
 *     transitional state). Wrapped in try/catch.
 *   - `JSON.stringify` throws on circular structures. Same try/catch
 *     handles that and surfaces the error message.
 */
const PAGE_BRIDGE_SCRIPT = `(() => {
  if (window.${INSTALLED_FLAG}) return;
  window.${INSTALLED_FLAG} = true;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.type !== ${JSON.stringify(REQUEST_TYPE)}) return;
    const { correlationId, keys } = data;
    if (typeof correlationId !== 'string' || !Array.isArray(keys)) return;

    const results = Object.create(null);
    for (const key of keys) {
      if (typeof key !== 'string') continue;
      try {
        const value = window[key];
        if (typeof value === 'undefined') {
          results[key] = { ok: false, reason: 'undefined' };
          continue;
        }
        try {
          const json = JSON.stringify(value);
          if (typeof json === 'undefined') {
            // JSON.stringify drops functions / Symbol values silently.
            // For a top-level global that IS a function, the result is
            // undefined — surface it instead of silent-failing.
            results[key] = { ok: false, reason: 'not-serializable' };
          } else {
            results[key] = { ok: true, json: json };
          }
        } catch (err) {
          results[key] = {
            ok: false,
            reason: 'serialize-error',
            message: String((err && err.message) || err)
          };
        }
      } catch (err) {
        results[key] = {
          ok: false,
          reason: 'access-error',
          message: String((err && err.message) || err)
        };
      }
    }

    window.postMessage({ type: ${JSON.stringify(RESULT_TYPE)}, correlationId: correlationId, results: results }, '*');
  });
})();`;

export type ReadFailure =
  | { readonly ok: false; readonly reason: 'undefined' }
  | { readonly ok: false; readonly reason: 'not-serializable' }
  | { readonly ok: false; readonly reason: 'serialize-error'; readonly message: string }
  | { readonly ok: false; readonly reason: 'access-error'; readonly message: string }
  | { readonly ok: false; readonly reason: 'bridge-unavailable' };

export type ReadSuccess = { readonly ok: true; readonly json: string };

export type ReadResult = ReadSuccess | ReadFailure;

/**
 * How long we wait for the page-world bridge to respond before
 * considering the request lost. Set high enough that even a busy
 * page (e.g. mid-React-render) responds in time, but low enough
 * that the UI doesn't feel stuck if the bridge truly didn't install
 * (strict CSP, Trusted Types policy, etc.).
 *
 * Reads happen on explicit user action (Refresh click / tab open),
 * so the only thing waiting is the panel itself.
 */
const REQUEST_TIMEOUT_MS = 1000;

/**
 * Map of in-flight correlation IDs → resolver functions. Used to route
 * incoming postMessages back to the right Promise. Entries are deleted
 * on response or timeout so the map stays bounded by concurrency, not
 * by total lifetime read count.
 */
const pending = new Map<string, (results: Record<string, ReadResult>) => void>();

/**
 * Idempotent: install the page bridge on first call, no-op on subsequent
 * calls. Returns `true` if the injection succeeded (or was already done),
 * `false` if a CSP / Trusted Types policy blocked it.
 *
 * Also installs the content-script-side listener exactly once.
 */
let bridgeInstalled = false;
let bridgeBlocked = false;
let listenerInstalled = false;

export function installPageBridge(): boolean {
  if (bridgeInstalled) return true;
  if (bridgeBlocked) return false;

  installContentSideListenerOnce();

  try {
    const script = document.createElement('script');
    // Assigning `textContent` (vs. innerHTML) avoids HTML parsing — the
    // string is treated as inert text until it lands in the DOM and the
    // browser executes it as a script. This is the standard recipe for
    // running code in the page's main world from a content script.
    script.textContent = PAGE_BRIDGE_SCRIPT;
    (document.head ?? document.documentElement).appendChild(script);
    // Remove the <script> tag once it's executed — the listener it
    // installed on `window` lives on regardless. Keeps the DOM tidy and
    // means devtools "Sources" doesn't show a phantom script tag.
    script.remove();
    bridgeInstalled = true;
    return true;
  } catch {
    // CSP or Trusted Types blocked the injection. Mark blocked so we
    // don't retry on every request — the user would have to change
    // pages (which reloads the content script and resets this state).
    bridgeBlocked = true;
    return false;
  }
}

function installContentSideListenerOnce(): void {
  if (listenerInstalled) return;
  listenerInstalled = true;
  window.addEventListener('message', (event: MessageEvent) => {
    // Only accept messages from our own page-world bridge. Different-
    // origin iframes posting to the top window would have a different
    // source; ignore them so a malicious embed can't forge results.
    if (event.source !== window) return;
    const data = event.data as unknown;
    if (!isResultMessage(data)) return;
    const resolver = pending.get(data.correlationId);
    if (!resolver) return; // Stale / unknown correlation ID — ignore.
    pending.delete(data.correlationId);
    resolver(data.results);
  });
}

interface ResultMessage {
  readonly type: typeof RESULT_TYPE;
  readonly correlationId: string;
  readonly results: Record<string, ReadResult>;
}

function isResultMessage(data: unknown): data is ResultMessage {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.type === RESULT_TYPE &&
    typeof d.correlationId === 'string' &&
    typeof d.results === 'object' &&
    d.results !== null
  );
}

/**
 * Read the requested global keys from the host page's main world.
 *
 * Returns a Promise that resolves with a map keyed by the input keys.
 * Each value is either `{ ok: true, json }` (where `json` is the
 * `JSON.stringify` output — caller can `JSON.parse` if they want the
 * structured value back, or render the string directly) or one of the
 * `ReadFailure` variants.
 *
 * Behavior on edge cases:
 *
 *   - Empty `keys` array → resolves immediately with `{}` (no bridge
 *     work). Lets callers pass `prefs.windowGlobals` unconditionally.
 *   - Bridge blocked by CSP → resolves with every key set to
 *     `{ ok: false, reason: 'bridge-unavailable' }`. The Globals tab
 *     renders a "(could not read)" placeholder per row.
 *   - Bridge doesn't respond within {@link REQUEST_TIMEOUT_MS} →
 *     resolves with every key set to `bridge-unavailable`. Same UI
 *     treatment, so the user sees a clear failure mode instead of
 *     a spinner stuck forever.
 *   - Concurrent calls work — correlation IDs route each response to
 *     the right Promise. If the user spams "Refresh all", the second
 *     call's results don't get crossed with the first.
 */
export function readGlobals(keys: readonly string[]): Promise<Record<string, ReadResult>> {
  if (keys.length === 0) return Promise.resolve({});

  const installed = installPageBridge();
  if (!installed) {
    return Promise.resolve(buildAllUnavailable(keys));
  }

  const correlationId = generateCorrelationId();

  return new Promise<Record<string, ReadResult>>((resolve) => {
    let settled = false;
    const settle = (results: Record<string, ReadResult>) => {
      if (settled) return;
      settled = true;
      resolve(results);
    };

    pending.set(correlationId, settle);

    setTimeout(() => {
      if (!pending.has(correlationId)) return;
      pending.delete(correlationId);
      settle(buildAllUnavailable(keys));
    }, REQUEST_TIMEOUT_MS);

    window.postMessage(
      {
        type: REQUEST_TYPE,
        correlationId,
        keys: keys.slice(),
      },
      '*'
    );
  });
}

function buildAllUnavailable(keys: readonly string[]): Record<string, ReadResult> {
  const out: Record<string, ReadResult> = {};
  for (const key of keys) {
    out[key] = { ok: false, reason: 'bridge-unavailable' };
  }
  return out;
}

function generateCorrelationId(): string {
  // crypto.randomUUID is available in every Chromium 92+ and Firefox 95+,
  // well below our manifest floors. Falling back to a Math.random ID
  // would still be unique enough in practice (no security boundary
  // attached to these), but the UUID is shorter to type into logs.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cs-globals-${crypto.randomUUID()}`;
  }
  // Defensive fallback for any oddball runtime.
  return `cs-globals-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * Test-only escape hatch: reset module-level state between tests so
 * each test starts with a fresh bridge / listener / pending map.
 * Never exported through the public surface of the module — `_resetForTests`
 * is a deliberately marked-private name.
 */
export function _resetForTests(): void {
  bridgeInstalled = false;
  bridgeBlocked = false;
  listenerInstalled = false;
  pending.clear();
}

/**
 * Tests for the content-script side of the Window Globals bridge.
 *
 * We don't exercise the actual page-world script body here (that runs
 * inside an injected `<script>` element with a real `window.postMessage`
 * round-trip — happy-dom does support that, but stubbing the page-world
 * responses gives us deterministic control over every result variant
 * without coupling the test to the inlined script's exact wording).
 *
 * Instead, we drive `window.postMessage` events directly to simulate
 * what the bridge script would post back, and assert that the
 * content-script side:
 *   - Routes responses to the right Promise via correlation IDs.
 *   - Handles concurrent calls without cross-talk.
 *   - Times out when no response arrives.
 *   - Resets cleanly across test boundaries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetForTests,
  installPageBridge,
  readGlobals,
  type ReadResult,
} from '@/content/window-globals-bridge';

const RESULT_TYPE = 'clay-slip:globals:result';
const REQUEST_TYPE = 'clay-slip:globals:request';

/**
 * Build a result-message payload that mirrors what the page-world
 * script would post back. The shape is locked in by these tests
 * because both ends have to agree on it.
 */
function resultMessage(
  correlationId: string,
  results: Record<string, ReadResult>
): { type: string; correlationId: string; results: Record<string, ReadResult> } {
  return { type: RESULT_TYPE, correlationId, results };
}

/**
 * Capture the correlation ID + keys from the next outgoing request
 * the bridge posts to `window`. Wraps `window.postMessage` with a
 * spy so we can fake the response message that should follow.
 *
 * Returns a Promise that resolves with the first observed request.
 * The bridge sends exactly one message per `readGlobals` call.
 */
function captureNextRequest(): Promise<{ correlationId: string; keys: string[] }> {
  return new Promise((resolve) => {
    const original = window.postMessage;
    window.postMessage = ((message: unknown, ...rest: unknown[]) => {
      const m = message as { type?: string; correlationId?: string; keys?: string[] };
      if (m && m.type === REQUEST_TYPE && m.correlationId && Array.isArray(m.keys)) {
        // Restore before resolving so subsequent posts go through
        // the real implementation (including the test's own response
        // dispatch via dispatchEvent below).
        window.postMessage = original;
        resolve({ correlationId: m.correlationId, keys: m.keys });
        return;
      }
      // Forward anything else (test setup, response dispatches) to
      // the real implementation so the bridge's incoming-message
      // listener still fires.
      original.call(window, message as never, ...(rest as []));
    }) as typeof window.postMessage;
  });
}

/**
 * Dispatch a synthetic MessageEvent at `window` so the bridge's
 * incoming listener fires. happy-dom's `postMessage` is queued — we
 * use the synchronous `dispatchEvent` path so tests don't have to
 * `await` a tick after responding.
 */
function dispatchResponse(payload: object): void {
  const event = new MessageEvent('message', {
    data: payload,
    source: window,
  });
  window.dispatchEvent(event);
}

beforeEach(() => {
  _resetForTests();
  // Wipe any script tag a previous test's `installPageBridge` left
  // behind. The bridge removes its own script immediately after
  // append, but in case a test threw mid-install we play it safe.
  for (const s of document.querySelectorAll('script')) s.remove();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('installPageBridge', () => {
  it('is idempotent — subsequent calls are no-ops', () => {
    // First call sets bridgeInstalled = true and injects the <script>.
    // We don't have to assert the injection details (the inlined string
    // body is tested at integration time); just that the second call
    // doesn't throw or re-trigger the listener install.
    expect(installPageBridge()).toBe(true);
    expect(installPageBridge()).toBe(true);
    expect(installPageBridge()).toBe(true);
  });
});

describe('readGlobals', () => {
  it('resolves immediately with {} when given an empty key list', async () => {
    // Lets callers pass `prefs.windowGlobals` unconditionally without
    // branching on .length. Also avoids the side-effect of installing
    // the bridge when no work is needed.
    const results = await readGlobals([]);
    expect(results).toEqual({});
  });

  it('round-trips a single-key request to a response keyed the same way', async () => {
    const requestPromise = captureNextRequest();
    const readPromise = readGlobals(['nymGtmPage']);

    const { correlationId, keys } = await requestPromise;
    expect(keys).toEqual(['nymGtmPage']);

    dispatchResponse(
      resultMessage(correlationId, {
        nymGtmPage: { ok: true, json: '{"page":"home"}' },
      })
    );

    const results = await readPromise;
    expect(results).toEqual({
      nymGtmPage: { ok: true, json: '{"page":"home"}' },
    });
  });

  it('propagates each failure-reason verbatim from the page bridge', async () => {
    // Lock in the result shape contract that the page-world script
    // commits to. If a future tweak to either side changes the reason
    // codes silently, this test fails loudly.
    const requestPromise = captureNextRequest();
    const readPromise = readGlobals(['missing', 'fn', 'circular', 'throws']);
    const { correlationId } = await requestPromise;

    dispatchResponse(
      resultMessage(correlationId, {
        missing: { ok: false, reason: 'undefined' },
        fn: { ok: false, reason: 'not-serializable' },
        circular: { ok: false, reason: 'serialize-error', message: 'circular structure' },
        throws: { ok: false, reason: 'access-error', message: 'boom' },
      })
    );

    const results = await readPromise;
    expect(results.missing).toEqual({ ok: false, reason: 'undefined' });
    expect(results.fn).toEqual({ ok: false, reason: 'not-serializable' });
    expect(results.circular).toEqual({
      ok: false,
      reason: 'serialize-error',
      message: 'circular structure',
    });
    expect(results.throws).toEqual({ ok: false, reason: 'access-error', message: 'boom' });
  });

  it('routes concurrent calls via correlation IDs without cross-talk', async () => {
    // Spam-Refresh-All scenario: two reads in flight, the second response
    // arrives first. Each Promise must only see its own results.
    const firstRequest = captureNextRequest();
    const firstRead = readGlobals(['a']);
    const { correlationId: id1 } = await firstRequest;

    const secondRequest = captureNextRequest();
    const secondRead = readGlobals(['b']);
    const { correlationId: id2 } = await secondRequest;
    expect(id1).not.toBe(id2);

    // Respond out of order — second-first.
    dispatchResponse(resultMessage(id2, { b: { ok: true, json: '"second"' } }));
    dispatchResponse(resultMessage(id1, { a: { ok: true, json: '"first"' } }));

    const [r1, r2] = await Promise.all([firstRead, secondRead]);
    expect(r1).toEqual({ a: { ok: true, json: '"first"' } });
    expect(r2).toEqual({ b: { ok: true, json: '"second"' } });
  });

  it('ignores response messages with an unknown correlation ID', async () => {
    // Defends against a malicious page (or a stale message from a
    // previous read that timed out) injecting forged results into an
    // unrelated in-flight call. The bridge silently drops them.
    const requestPromise = captureNextRequest();
    const readPromise = readGlobals(['real']);
    const { correlationId } = await requestPromise;

    // Forged result with a bogus correlation ID — must NOT resolve
    // the real read.
    dispatchResponse(resultMessage('forged-id-not-issued', { real: { ok: true, json: '"hi"' } }));

    // Real response with the correct ID — this one resolves the read.
    dispatchResponse(resultMessage(correlationId, { real: { ok: true, json: '"correct"' } }));

    const results = await readPromise;
    expect(results).toEqual({ real: { ok: true, json: '"correct"' } });
  });

  it('times out with bridge-unavailable when no response arrives', async () => {
    // 1-second timeout on the production path is too long for tests;
    // use vitest's fake timers to fast-forward without sleeping.
    vi.useFakeTimers();
    const requestPromise = captureNextRequest();
    const readPromise = readGlobals(['stuck']);
    await requestPromise;

    // Run all pending timers to trigger the bridge's timeout fallback.
    await vi.runAllTimersAsync();

    const results = await readPromise;
    expect(results).toEqual({ stuck: { ok: false, reason: 'bridge-unavailable' } });
  });

  it('ignores message events from sources other than `window`', async () => {
    // Cross-origin iframes posting to the top window have `event.source`
    // pointing at the iframe's window, not the top window. We must
    // drop those silently so a malicious embed can't inject forged
    // results.
    const requestPromise = captureNextRequest();
    const readPromise = readGlobals(['guarded']);
    const { correlationId } = await requestPromise;

    // Dispatch a forged event with a different `source`. The bridge's
    // event.source !== window check should reject it before it ever
    // looks at the correlation ID.
    const otherSource = {} as MessageEventSource;
    const forged = new MessageEvent('message', {
      data: resultMessage(correlationId, { guarded: { ok: true, json: '"forged"' } }),
      source: otherSource,
    });
    window.dispatchEvent(forged);

    // Now send a legitimate response. The bridge should only honor this one.
    dispatchResponse(resultMessage(correlationId, { guarded: { ok: true, json: '"legit"' } }));

    const results = await readPromise;
    expect(results.guarded).toEqual({ ok: true, json: '"legit"' });
  });
});

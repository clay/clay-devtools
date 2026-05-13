import type { CaptureResponse, RuntimeMessage } from './types';

/**
 * Capture a PNG of the given element by:
 *   1. Scrolling it into view + briefly hiding the panel host so it doesn't
 *      appear in the screenshot
 *   2. Asking the service worker to call chrome.tabs.captureVisibleTab
 *   3. Cropping the returned full-tab PNG to the element's viewport rect
 *      using a canvas, accounting for devicePixelRatio
 *   4. Writing the result to the system clipboard as image/png
 *
 * Returns true on success.
 */
export async function captureElementToClipboard(
  el: HTMLElement,
  panelHost: HTMLElement | null
): Promise<boolean> {
  el.scrollIntoView({ behavior: 'instant', block: 'center' });
  await new Promise((r) => requestAnimationFrame(r));

  const previousVisibility = panelHost?.style.visibility ?? '';
  if (panelHost) panelHost.style.visibility = 'hidden';
  await new Promise((r) => requestAnimationFrame(r));

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'CAPTURE_TAB',
    } satisfies RuntimeMessage)) as CaptureResponse;

    if (!response?.ok || !response.dataUrl) {
      throw new Error(response?.error ?? 'Capture failed');
    }

    const rect = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const img = await loadImage(response.dataUrl);
    const sx = rect.left * dpr;
    const sy = rect.top * dpr;
    const sw = rect.width * dpr;
    const sh = rect.height * dpr;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(rect.width));
    canvas.height = Math.max(1, Math.round(rect.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('PNG encoding failed');

    if (!navigator.clipboard?.write) {
      throw new Error('Clipboard image write not supported');
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } finally {
    if (panelHost) panelHost.style.visibility = previousVisibility;
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = dataUrl;
  });
}

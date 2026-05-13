import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import panelCss from './panel/styles.css?inline';
import { App } from './panel/App';

const HOST_ID = 'clay-slip-shadow-host';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

export function mountPanel(): void {
  if (host) return;

  host = document.createElement('div');
  host.id = HOST_ID;
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.inset = 'auto 0 0 auto';
  host.style.pointerEvents = 'none';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = panelCss;
  shadow.appendChild(style);

  const reactMount = document.createElement('div');
  reactMount.id = 'clay-slip-root';
  reactMount.style.pointerEvents = 'auto';
  shadow.appendChild(reactMount);

  root = createRoot(reactMount);
  root.render(createElement(App));
}

export function unmountPanel(): void {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
}

export function isPanelMounted(): boolean {
  return host !== null;
}

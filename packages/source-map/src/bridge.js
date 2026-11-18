import { inspectElement, previewEdit } from './runtime.js';

export const INSPECT = 'feega:inspect';
export const INSPECT_RESULT = 'feega:inspect:result';
export const READY = 'feega:source-map:ready';
export const PREVIEW = 'feega:preview';

const INSTALLED = Symbol.for('feega.source-map.bridge');

export function installBridge(win) {
  if (win[INSTALLED]) {
    return;
  }
  win[INSTALLED] = true;

  win.addEventListener('message', (event) => {
    const request = event.data;
    if (request?.type === PREVIEW) {
      previewEdit(win.document, request);
      return;
    }
    if (!request || request.type !== INSPECT) {
      return;
    }

    const target = targetOf(win.document, request);
    const result = target ? inspectElement(target, { maxHtml: request.maxHtml }) : null;
    event.source?.postMessage({ type: INSPECT_RESULT, id: request.id, result }, { targetOrigin: '*' });
  });

  win.parent?.postMessage({ type: READY }, '*');
}

function targetOf(doc, request) {
  if (typeof request.selector === 'string') {
    return doc.querySelector(request.selector);
  }
  return doc.elementFromPoint(request.x, request.y);
}

if (typeof window !== 'undefined') {
  installBridge(window);
}

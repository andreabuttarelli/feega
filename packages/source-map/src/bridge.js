import { SOURCE_ATTR, clearPreview, relativeOf, inspectElement, keepPreviews, previewEdit, settlePreview } from './runtime.js';

export const INSPECT = 'feega:inspect';
export const INSPECT_RESULT = 'feega:inspect:result';
export const READY = 'feega:source-map:ready';
export const PREVIEW = 'feega:preview';
export const PREVIEW_CLEAR = 'feega:preview:clear';
export const PREVIEW_SETTLE = 'feega:preview:settle';
export const PREVIEW_SETTLED = 'feega:preview:settled';
export const LOCATION = 'feega:location';
export const SCROLL = 'feega:scroll';
export const SCROLLED = 'feega:scrolled';
export const MODE = 'feega:mode';
export const TEXT_EDIT = 'feega:text:edit';
export const TEXT_DONE = 'feega:text:done';

export const Mode = { Navigate: 'navigate', Design: 'design' };

const INSTALLED = Symbol.for('feega.source-map.bridge');
const EDITABLE = 'plaintext-only';

export function installBridge(win) {
  if (win[INSTALLED]) {
    return;
  }
  win[INSTALLED] = true;

  const doc = win.document;
  let mode = Mode.Navigate;
  let reply = (message) => win.parent?.postMessage(message, '*');

  const handlers = {
    [PREVIEW]: (request) => previewEdit(doc, request),
    [PREVIEW_CLEAR]: (request) => clearPreview(doc, request.source),
    [PREVIEW_SETTLE]: (request) => reply({ type: PREVIEW_SETTLED, source: request.source, unapplied: settlePreview(doc, request.source) }),
    [MODE]: (request) => (mode = request.mode),
    [SCROLL]: (request) => {
      win.scrollBy(request.dx, request.dy);
      reply({ type: SCROLLED });
    },
    [TEXT_EDIT]: (request) => mode === Mode.Design && editText(win, targetOf(doc, request), request, reply),
    [INSPECT]: (request) => {
      const target = targetOf(doc, request);
      reply({ type: INSPECT_RESULT, id: request.id, result: target ? inspectElement(target, { maxHtml: request.maxHtml }) : null });
    }
  };

  win.addEventListener('message', (event) => {
    const handle = handlers[event.data?.type];
    if (!handle) {
      return;
    }
    const source = event.source;
    reply = source ? (message) => source.postMessage(message, { targetOrigin: '*' }) : reply;
    handle(event.data);
  });

  new win.MutationObserver(() => keepPreviews(doc)).observe(doc.documentElement, { childList: true, subtree: true });

  reportRoutes(win);
  win.parent?.postMessage({ type: READY, path: win.location.pathname + win.location.search }, '*');
}

function reportRoutes(win) {
  const report = () => win.parent?.postMessage({ type: LOCATION, path: win.location.pathname + win.location.search }, '*');
  for (const name of ['pushState', 'replaceState']) {
    const original = win.history[name].bind(win.history);
    win.history[name] = (...args) => {
      original(...args);
      report();
    };
  }
  win.addEventListener('popstate', report);
}

function editText(win, target, request, reply) {
  const element = target?.closest(`[${SOURCE_ATTR}]`);
  if (!element) {
    return;
  }

  const was = element.textContent;
  element.setAttribute('contenteditable', EDITABLE);
  element.focus?.();
  placeCaret(win, element, request);

  const finish = (commit) => {
    element.removeEventListener('keydown', onKey);
    element.removeEventListener('blur', onBlur);
    element.removeAttribute('contenteditable');
    if (!commit) {
      element.textContent = was;
      return;
    }
    reply({ type: TEXT_DONE, source: element.getAttribute(SOURCE_ATTR), text: element.textContent, was });
  };

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      finish(true);
    }
  };
  const onBlur = () => finish(true);

  element.addEventListener('keydown', onKey);
  element.addEventListener('blur', onBlur);
}

function placeCaret(win, element, { x, y }) {
  const range = typeof x === 'number' ? win.document.caretRangeFromPoint?.(x, y) : null;
  if (!range || !element.contains(range.startContainer)) {
    return;
  }
  const selection = win.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function targetOf(doc, request) {
  if (typeof request.move === 'string') {
    return relativeOf(doc, request.from, request.move);
  }
  if (typeof request.selector === 'string') {
    return doc.querySelector(request.selector);
  }
  return doc.elementFromPoint(request.x, request.y);
}

if (typeof window !== 'undefined') {
  installBridge(window);
}

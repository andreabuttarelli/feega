import { stampSources } from './framework-meta.js';
import { SOURCE_ATTR, GHOST_ATTR, rectOf, deepestAt, clearPreview, clearPreviews, hidePreview, paletteOf, relativeOf, treeOf, inspectElement, keepPreviews, previewEdit, settlePreview } from './runtime.js';
import { FOCUSED, focusTab } from './focus.js';
import { missingFontsOf } from './missing-fonts.js';
import { trackRects } from './track.js';
import { keepScroll } from './reload-restore.js';
import { applyTheme, keepTheme, themeNow, watchScheme } from './theme-switch.js';
import { watchPageMount } from './page-mount.js';
import { CAPTURE, CAPTURED, captureTab, loadRenderer } from './capture.js';
import { FORCED_REBUILD_MS, forceState, forcedNow, keepForced, settleForced, statesOf } from './forced-state.js';

export const INSPECT = 'feega:inspect';
export const INSPECT_RESULT = 'feega:inspect:result';
export const READY = 'feega:source-map:ready';
export const PREVIEW = 'feega:preview';
export const PREVIEW_CLEAR = 'feega:preview:clear';
export const PREVIEW_CLEAR_ALL = 'feega:preview:clear-all';
export const PREVIEW_SETTLE = 'feega:preview:settle';
export const PREVIEW_SETTLED = 'feega:preview:settled';
export const LOCATION = 'feega:location';
export const SCROLL = 'feega:scroll';
export const SCROLLED = 'feega:scrolled';
export const REVEAL = 'feega:reveal';
export const TREE = 'feega:tree';
export const TREE_RESULT = 'feega:tree:result';
export const HIDE = 'feega:hide';
export const FOCUS = 'feega:focus';
export const FOCUS_CANVAS = 'feega:focus-canvas';
export const FOCUS_ZOOM = 'feega:focus-zoom';
export { FOCUSED };
export const PALETTE = 'feega:palette';
export const PALETTE_RESULT = 'feega:palette:result';
export const MODE = 'feega:mode';
export const TEXT_EDIT = 'feega:text:edit';
export const TEXT_DONE = 'feega:text:done';
export const TEXT_CANCEL = 'feega:text:cancel';
export const TEXT_RESTORE = 'feega:text:restore';
export const TRACK = 'feega:track';
export const TRACKED = 'feega:tracked';
export const LEAVE = 'feega:leave';
export const FORCE = 'feega:force';
export const THEME = 'feega:theme';

export const Mode = { Navigate: 'navigate', Design: 'design' };

const INSTALLED = Symbol.for('feega.source-map.bridge');
const EDITABLE = 'plaintext-only';
const TREE_REFRESH_MS = 150;
const TREE_ATTRIBUTES = ['class', 'id', 'style', 'aria-label', 'alt', SOURCE_ATTR];
const THEME_REBUILD_MS = 100;

export function installBridge(win, { nested = false, emit = null, twin = null, render = null } = {}) {
  if (win[INSTALLED]) {
    return;
  }
  if (!nested && watchPageMount(win)) {
    return;
  }
  win[INSTALLED] = true;
  watchScheme(win);

  const doc = win.document;
  let mode = Mode.Navigate;
  const unsaved = new Map();
  let treeWanted = false;
  let treeTimer = null;
  let forcedTimer = null;
  let themeTimer = null;
  let treeSent = '';
  const toParent = (message) => (emit ? emit(message) : win.parent?.postMessage(message, '*'));
  let reply = toParent;
  const scroll = nested ? { restored: false, leave: () => undefined } : keepScroll(win);
  const tab = focusTab(win, { install: (inner) => installBridge(inner, { nested: true, twin: (element) => tab.twin(element), emit: (message) => win.parent?.postMessage({ ...message, focus: true }, '*') }), prepare: () => stampSources(doc), report: (message) => win.parent?.postMessage(message, '*') });
  const tracker = trackRects(win, (slot, rect) => reply({ type: TRACKED, slot, rect }));

  function sendTree() {
    stampSources(doc);
    const tree = treeOf(doc, { bare: nested });
    treeSent = JSON.stringify(tree);
    reply({ type: TREE_RESULT, tree });
  }

  function refreshTree() {
    if (!treeWanted || treeTimer) {
      return;
    }
    treeTimer = win.setTimeout(() => {
      treeTimer = null;
      stampSources(doc);
      if (JSON.stringify(treeOf(doc, { bare: nested })) !== treeSent) {
        sendTree();
      }
    }, TREE_REFRESH_MS);
  }

  function refreshForced() {
    if (!forcedNow(doc) || forcedTimer) {
      return;
    }
    forcedTimer = win.setTimeout(() => {
      forcedTimer = null;
      keepForced(doc);
    }, FORCED_REBUILD_MS);
  }

  function refreshTheme() {
    if (!themeNow(doc) || themeTimer) {
      return;
    }
    themeTimer = win.setTimeout(() => {
      themeTimer = null;
      keepTheme(doc);
    }, THEME_REBUILD_MS);
  }

  const handlers = {
    [PREVIEW]: (request) => previewEdit(doc, request),
    [PREVIEW_CLEAR]: (request) => clearPreview(doc, request.source, request.state),
    [PREVIEW_CLEAR_ALL]: () => clearPreviews(doc),
    [PREVIEW_SETTLE]: (request) => reply({ type: PREVIEW_SETTLED, source: request.source, unapplied: settlePreview(doc, request.source, request.state) }),
    [FORCE]: (request) => forceState(doc, request.source, request.state),
    [THEME]: (request) => applyTheme(doc, request),
    [MODE]: (request) => (mode = request.mode),
    [PALETTE]: () => reply({ type: PALETTE_RESULT, ...paletteOf(doc), missing: missingFontsOf(doc) }),
    [HIDE]: (request) => hidePreview(doc, request.source, request.hidden),
    [FOCUS]: (request) => (request.source === null ? tab.close() : reply({ type: FOCUSED, ...tab.open(request) })),
    [FOCUS_CANVAS]: (request) => tab.canvas(request),
    [FOCUS_ZOOM]: (request) => tab.zoom(request),
    [LEAVE]: () => scroll.leave(),
    [CAPTURE]: (request) => {
      const answer = reply;
      captured(win, request, render).then(
        (png) => answer({ type: CAPTURED, id: request.id, png }),
        (error) => answer({ type: CAPTURED, id: request.id, error: error?.message ?? String(error) })
      );
    },
    [TRACK]: (request) => tracker.follow(request.slot, request.source, request.index),
    [TREE]: () => {
      treeWanted = true;
      sendTree();
    },
    [SCROLL]: (request) => {
      win.scrollBy(request.dx, request.dy);
      reply({ type: SCROLLED });
    },
    [REVEAL]: (request) => revealSource(win, request),
    [TEXT_EDIT]: (request) => mode === Mode.Design && editText(win, targetOf(doc, request), request, reply, unsaved),
    [TEXT_RESTORE]: (request) => restoreText(doc, unsaved, request.source),
    [INSPECT]: (request) => {
      stampSources(doc);
      const target = targetOf(doc, request);
      settleForced(doc);
      const tagged = target?.closest(`[${SOURCE_ATTR}]`);
      const outside = nested && (!tagged || tagged.hasAttribute(GHOST_ATTR) || tagged === doc.body || tagged === doc.documentElement);
      const inspected = target && !outside ? inspectElement(target, { maxHtml: request.maxHtml, twin }) : null;
      reply({ type: INSPECT_RESULT, id: request.id, result: inspected && { ...inspected, states: tagged ? statesOf(tagged) : [] } });
    }
  };

  win.addEventListener('message', (event) => {
    if (tab.status(event)) {
      return;
    }
    if (event.data?.focus) {
      tab.forward(event.data);
      return;
    }
    const handle = handlers[event.data?.type];
    if (!handle) {
      return;
    }
    const source = event.source;
    reply = source && !emit ? (message) => source.postMessage(message, { targetOrigin: '*' }) : reply;
    handle(event.data);
  });

  new win.MutationObserver(() => (keepPreviews(doc), refreshTree(), refreshForced(), refreshTheme(), tab.changed())).observe(doc.documentElement, { childList: true, subtree: true });
  new win.MutationObserver(() => (refreshTree(), tab.changed())).observe(doc.documentElement, { subtree: true, attributes: true, attributeFilter: TREE_ATTRIBUTES, characterData: true });

  if (!nested) {
    reportRoutes(win);
  }
  toParent({ type: READY, path: win.location.pathname + win.location.search, restored: scroll.restored });
}

async function captured(win, request, render) {
  return captureTab(win, request, render ?? (await loadRenderer()));
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

function restoreText(doc, unsaved, source) {
  const html = unsaved.get(source);
  const element = doc.querySelector(`[${SOURCE_ATTR}="${source}"]`);
  unsaved.delete(source);
  if (element && html !== undefined) {
    element.innerHTML = html;
  }
}

function editText(win, target, request, reply, unsaved) {
  const element = target?.closest(`[${SOURCE_ATTR}]`);
  if (!element) {
    reply({ type: TEXT_CANCEL });
    return;
  }

  const was = element.textContent;
  const wasHtml = element.innerHTML;
  element.setAttribute('contenteditable', EDITABLE);
  element.focus?.();
  placeCaret(win, element, request);

  const finish = (commit) => {
    element.removeEventListener('keydown', onKey);
    element.removeEventListener('blur', onBlur);
    element.removeAttribute('contenteditable');
    if (!commit) {
      element.innerHTML = wasHtml;
      reply({ type: TEXT_CANCEL });
      return;
    }
    unsaved.set(element.getAttribute(SOURCE_ATTR), wasHtml);
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

function revealSource(win, request) {
  const target = targetOf(win.document, { selector: `[${SOURCE_ATTR}=${JSON.stringify(request.source)}]`, index: request.index });
  if (!target) {
    return;
  }
  const { y, height } = rectOf(target);
  if (y >= 0 && y + height <= win.innerHeight) {
    return;
  }
  target.scrollIntoView({ block: 'center', behavior: 'instant' });
}

export function targetOf(doc, request) {
  if (typeof request.move === 'string') {
    return relativeOf(doc, request.from, request.move);
  }
  if (typeof request.selector === 'string') {
    const found = doc.querySelectorAll(request.selector);
    return found[request.index ?? 0] ?? found[0] ?? null;
  }
  return deepestAt(doc, request.x, request.y);
}

if (typeof window !== 'undefined' && !window[Symbol.for('feega.nested-host')]) {
  installBridge(window);
}

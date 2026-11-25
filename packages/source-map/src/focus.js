import { GHOST_ATTR, SOURCE_ATTR } from './runtime.js';
import { mountOf } from './framework-meta.js';
import { fileOf, rootOf, taggedParent } from './component-root.js';
import { mountUrlFor } from './mount-hosts.js';
import { FocusMode, MOUNT_STATUS, Status } from './mount-protocol.js';

export const FOCUSED = 'feega:focused';
const NESTED_HOST = Symbol.for('feega.nested-host');
const NO_MOUNT_PAGE = 'The dev server has no mount page';

const FRAME_ID = 'feega-focus';
export const CANVAS_ID = 'feega-focus-canvas';
const LAYER = '2147483646';
const REFRESH_MS = 150;
const PADDING_PX = 48;
const GAP_PX = 32;
const CHECKER_PX = 16;
const CHECKER_LIGHT = '#f4f4f6';
const CHECKER_DARK = '#e6e6ea';
const STYLESHEETS = 'link[rel~="stylesheet"], style';

export const CANVAS_CSS = `html{min-height:100%;background-color:${CHECKER_LIGHT}!important;background-image:conic-gradient(${CHECKER_DARK} 25%,transparent 0 50%,${CHECKER_DARK} 0 75%,transparent 0)!important;background-size:${CHECKER_PX * 2}px ${CHECKER_PX * 2}px!important}body{display:flex!important;flex-wrap:wrap;align-items:center;align-content:center;justify-content:center;gap:${GAP_PX}px;box-sizing:border-box;min-height:100vh;margin:0!important;padding:${PADDING_PX}px!important;background:transparent!important}`;

const nameOfFile = (file) => file.split('/').pop().replace(/\.[^.]+$/, '');
const attrsOf = (element) => Object.fromEntries([...element.attributes].filter(({ name }) => name !== SOURCE_ATTR).map(({ name, value }) => [name, value]));
const attrText = (attrs) => Object.entries(attrs).map(([name, value]) => ` ${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');

function ruleText(sheet) {
  try {
    return [...sheet.cssRules].map((rule) => rule.cssText).join('');
  } catch {
    return '';
  }
}

function styleOf(doc, style) {
  const copy = doc.createElement('style');
  for (const { name, value } of style.attributes) {
    copy.setAttribute(name, value);
  }
  copy.textContent = style.textContent || ruleText(style.sheet);
  return copy.outerHTML;
}

function headOf(doc) {
  const sheets = [...doc.querySelectorAll(STYLESHEETS)].map((node) => (node.localName === 'style' ? styleOf(doc, node) : node.outerHTML));
  const adopted = (doc.adoptedStyleSheets ?? []).map(ruleText).join('');
  return sheets.join('') + (adopted ? `<style>${adopted}</style>` : '');
}

const keyOf = (node) => node.getAttribute('data-vite-dev-id') ?? node.getAttribute('href') ?? node.textContent;

function carryAttrs(from, to) {
  for (const { name, value } of from.attributes) {
    if (name === 'class') {
      to.classList.add(...from.classList);
    } else if (!to.hasAttribute(name)) {
      to.setAttribute(name, value);
    }
  }
}

export function carryPage(doc, inner) {
  const base = inner.createElement('base');
  base.setAttribute('href', doc.baseURI);
  inner.head.prepend(base);
  carryAttrs(doc.documentElement, inner.documentElement);
  carryAttrs(doc.body, inner.body);
  const have = new Set([...inner.querySelectorAll(STYLESHEETS)].map(keyOf));
  for (const node of doc.querySelectorAll(STYLESHEETS)) {
    if (!have.has(keyOf(node))) {
      inner.head.insertAdjacentHTML('beforeend', node.localName === 'style' ? styleOf(doc, node) : node.outerHTML);
    }
  }
  const adopted = (doc.adoptedStyleSheets ?? []).map(ruleText).join('');
  if (adopted) {
    inner.head.insertAdjacentHTML('beforeend', `<style>${adopted}</style>`);
  }
}

function ghostTree(doc, root) {
  const holder = doc.createElement('div');
  const kept = taggedParent(root);
  const ghosts = new Map();

  const ghostOf = (element) => {
    if (!element || element === doc.body || element === doc.documentElement) {
      return holder;
    }
    if (ghosts.has(element)) {
      return ghosts.get(element);
    }
    const ghost = element.cloneNode(false);
    if (element === kept) {
      ghost.setAttribute(GHOST_ATTR, '');
    } else {
      ghost.removeAttribute(SOURCE_ATTR);
    }
    ghost.style.setProperty('display', 'contents', 'important');
    ghosts.set(element, ghost);
    ghostOf(element.parentElement).append(ghost);
    return ghost;
  };

  ghostOf(root.parentElement).append(root.cloneNode(true));
  holder.querySelectorAll('script').forEach((script) => script.setAttribute('type', 'text/plain'));
  return holder.innerHTML;
}

export function focusPage(doc, source, index) {
  const root = rootOf(doc, source, index);
  if (!root) {
    return { count: 0 };
  }
  return { count: 1, rootAttr: root.getAttribute(SOURCE_ATTR), htmlAttrs: attrsOf(doc.documentElement), bodyAttrs: attrsOf(doc.body), head: headOf(doc), body: ghostTree(doc, root) };
}

function mountUrlOf(win, root, { source, index }) {
  const mount = mountOf(root);
  if (!mount) {
    return null;
  }
  const file = fileOf(root.getAttribute(SOURCE_ATTR));
  return mountUrlFor(win, { file, name: mount.name || nameOfFile(file), props: mount.props, source, index });
}

const pathFrom = (root, element) => {
  const path = [];
  for (let node = element; node !== root; node = node.parentElement) {
    if (!node?.parentElement) {
      return null;
    }
    path.unshift([...node.parentElement.children].indexOf(node));
  }
  return path;
};

const documentOf = ({ htmlAttrs, bodyAttrs, head, body }) =>
  `<!doctype html><html${attrText(htmlAttrs)}><head><meta charset="utf-8">${head}<style id="${CANVAS_ID}">${CANVAS_CSS}</style></head><body${attrText(bodyAttrs)}>${body}</body></html>`;

function setAttrs(element, attrs) {
  for (const { name } of [...element.attributes]) {
    element.removeAttribute(name);
  }
  for (const [name, value] of Object.entries(attrs)) {
    element.setAttribute(name, value);
  }
}

function patch(doc, was, now) {
  if (JSON.stringify(was.htmlAttrs) !== JSON.stringify(now.htmlAttrs)) {
    setAttrs(doc.documentElement, now.htmlAttrs);
  }
  if (JSON.stringify(was.bodyAttrs) !== JSON.stringify(now.bodyAttrs)) {
    setAttrs(doc.body, now.bodyAttrs);
  }
  if (was.head !== now.head) {
    const canvas = doc.getElementById(CANVAS_ID);
    doc.head.innerHTML = `<meta charset="utf-8">${now.head}`;
    doc.head.append(canvas);
  }
  if (was.body !== now.body) {
    doc.body.innerHTML = now.body;
  }
}

export function focusTab(win, { install, prepare, report }) {
  let frame = null;
  let source = null;
  let index = null;
  let wanted = null;
  let last = null;
  let loaded = false;
  let timer = null;
  let mode = FocusMode.Snapshot;
  let visible = true;
  const failed = new Set();

  const show = (on) => {
    visible = on;
    frame.style.display = on ? 'block' : 'none';
  };

  function update(parts) {
    if (loaded) {
      patch(frame.contentDocument, last, parts);
    } else {
      frame.srcdoc = documentOf(parts);
    }
    last = parts;
  }

  function create(parts, mountUrl) {
    frame = win.document.createElement('iframe');
    frame.id = FRAME_ID;
    frame.style.cssText = `position:fixed;inset:0;width:100%;height:100%;border:0;z-index:${LAYER};background:${CHECKER_LIGHT}`;
    const mine = frame;
    mode = mountUrl ? FocusMode.Mount : FocusMode.Snapshot;
    if (mountUrl) {
      mine.setAttribute('src', mountUrl);
    } else {
      mine.srcdoc = documentOf(parts);
    }
    mine.addEventListener('load', () => {
      if (frame === mine && mode === FocusMode.Mount && !mine.contentWindow[NESTED_HOST]) {
        fallBack(NO_MOUNT_PAGE);
        return;
      }
      if (frame === mine) {
        loaded = true;
        if (mode === FocusMode.Mount) {
          carryPage(win.document, mine.contentDocument);
        }
        install(mine.contentWindow);
      }
    });
    win.document.documentElement.append(frame);
  }

  function drop() {
    frame?.remove();
    frame = null;
    source = null;
    index = null;
    last = null;
    loaded = false;
  }

  function open(request) {
    prepare();
    const parts = focusPage(win.document, request.source, request.index);
    if (!parts.count) {
      drop();
      wanted = request;
      return { count: 0, mode: FocusMode.Snapshot };
    }
    wanted = null;
    if (!frame || source !== request.source || index !== request.index) {
      drop();
      const mountUrl = failed.has(request.source) || request.mount === false ? null : mountUrlOf(win, rootOf(win.document, request.source, request.index), request);
      create(parts, mountUrl);
      source = request.source;
      index = request.index;
      last = parts;
    } else if (mode === FocusMode.Snapshot) {
      update(parts);
    }
    show(request.shown !== false);
    return { count: parts.count, mode };
  }

  function fallBack(reason) {
    const request = { source, index, shown: visible };
    failed.add(source);
    drop();
    const { count } = open(request);
    report({ type: FOCUSED, count, mode, reason });
  }

  function refresh() {
    timer = null;
    if (!frame) {
      const { count } = wanted ? open(wanted) : { count: 0 };
      if (count) {
        report({ type: FOCUSED, count, mode });
      }
      return;
    }
    if (mode === FocusMode.Mount) {
      return;
    }
    prepare();
    const parts = focusPage(win.document, source, index);
    if (parts.count && JSON.stringify(parts) !== JSON.stringify(last)) {
      update(parts);
    }
  }

  return {
    open,
    close() {
      drop();
      wanted = null;
    },
    twin(element) {
      const root = frame?.contentDocument?.querySelector(`[${SOURCE_ATTR}=${JSON.stringify(last?.rootAttr)}]`);
      const path = root && pathFrom(root, element);
      const onPage = path && rootOf(win.document, source, index);
      return onPage ? path.reduce((node, at) => node?.children[at], onPage) ?? null : null;
    },
    forward({ focus, ...message }) {
      frame?.contentWindow?.postMessage(message, '*');
    },
    status(event) {
      const message = event.data;
      if (message?.type !== MOUNT_STATUS || !frame || event.source !== frame.contentWindow) {
        return false;
      }
      if (message.status === Status.Failed) {
        fallBack(message.reason);
      } else {
        report(message);
      }
      return true;
    },
    changed() {
      if ((frame || wanted) && !timer) {
        timer = win.setTimeout(refresh, REFRESH_MS);
      }
    }
  };
}

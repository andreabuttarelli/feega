import { SOURCE_ATTR } from './runtime.js';

const FRAME_ID = 'feega-focus';
const CANVAS_ID = 'feega-focus-canvas';
const LAYER = '2147483646';
const REFRESH_MS = 150;
const PADDING_PX = 48;
const GAP_PX = 32;
const CHECKER_PX = 16;
const CHECKER_LIGHT = '#f4f4f6';
const CHECKER_DARK = '#e6e6ea';
const STYLESHEETS = 'link[rel~="stylesheet"], style';

const CANVAS_CSS = `html{min-height:100%;background-color:${CHECKER_LIGHT}!important;background-image:conic-gradient(${CHECKER_DARK} 25%,transparent 0 50%,${CHECKER_DARK} 0 75%,transparent 0)!important;background-size:${CHECKER_PX * 2}px ${CHECKER_PX * 2}px!important}body{display:flex!important;flex-wrap:wrap;align-items:center;align-content:center;justify-content:center;gap:${GAP_PX}px;box-sizing:border-box;min-height:100vh;margin:0!important;padding:${PADDING_PX}px!important;background:transparent!important}`;

const fileOf = (attr) => attr.slice(0, attr.lastIndexOf(':', attr.lastIndexOf(':') - 1));
const taggedParent = (element) => element.parentElement?.closest(`[${SOURCE_ATTR}]`) ?? null;
const bySource = (doc, source) => [...doc.querySelectorAll(`[${SOURCE_ATTR}=${JSON.stringify(source)}]`)];
const attrsOf = (element) => Object.fromEntries([...element.attributes].map(({ name, value }) => [name, value]));
const attrText = (attrs) => Object.entries(attrs).map(([name, value]) => ` ${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');

function componentRoot(element) {
  const file = fileOf(element.getAttribute(SOURCE_ATTR));
  let root = element;
  for (let up = taggedParent(root); up && fileOf(up.getAttribute(SOURCE_ATTR)) === file; up = taggedParent(up)) {
    root = up;
  }
  return root;
}

function rootsOf(doc, source) {
  const [element] = bySource(doc, source);
  return element ? bySource(doc, componentRoot(element).getAttribute(SOURCE_ATTR)) : [];
}

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

function ghostTree(doc, roots) {
  const holder = doc.createElement('div');
  const kept = new Set(roots.map(taggedParent));
  const ghosts = new Map();

  const ghostOf = (element) => {
    if (!element || element === doc.body || element === doc.documentElement) {
      return holder;
    }
    if (ghosts.has(element)) {
      return ghosts.get(element);
    }
    const ghost = element.cloneNode(false);
    if (!kept.has(element)) {
      ghost.removeAttribute(SOURCE_ATTR);
    }
    ghost.style.setProperty('display', 'contents', 'important');
    ghosts.set(element, ghost);
    ghostOf(element.parentElement).append(ghost);
    return ghost;
  };

  for (const root of roots) {
    ghostOf(root.parentElement).append(root.cloneNode(true));
  }
  holder.querySelectorAll('script').forEach((script) => script.remove());
  return holder.innerHTML;
}

export function focusPage(doc, source) {
  const roots = rootsOf(doc, source);
  if (!roots.length) {
    return { count: 0 };
  }
  return { count: roots.length, htmlAttrs: attrsOf(doc.documentElement), bodyAttrs: attrsOf(doc.body), head: headOf(doc), body: ghostTree(doc, roots) };
}

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

export function focusTab(win, { install, prepare, found }) {
  let frame = null;
  let source = null;
  let wanted = null;
  let last = null;
  let loaded = false;
  let timer = null;

  const show = (visible) => {
    frame.style.display = visible ? 'block' : 'none';
  };

  function update(parts) {
    if (loaded) {
      patch(frame.contentDocument, last, parts);
    } else {
      frame.srcdoc = documentOf(parts);
    }
    last = parts;
  }

  function create(parts) {
    frame = win.document.createElement('iframe');
    frame.id = FRAME_ID;
    frame.style.cssText = `position:fixed;inset:0;width:100%;height:100%;border:0;z-index:${LAYER};background:${CHECKER_LIGHT}`;
    const mine = frame;
    mine.srcdoc = documentOf(parts);
    mine.addEventListener('load', () => {
      if (frame === mine) {
        loaded = true;
        install(mine.contentWindow);
      }
    });
    win.document.documentElement.append(frame);
  }

  function drop() {
    frame?.remove();
    frame = null;
    source = null;
    last = null;
    loaded = false;
  }

  function open(request) {
    prepare();
    const parts = focusPage(win.document, request.source);
    if (!parts.count) {
      drop();
      wanted = request;
      return 0;
    }
    wanted = null;
    if (!frame || source !== request.source) {
      drop();
      create(parts);
      source = request.source;
      last = parts;
    } else {
      update(parts);
    }
    show(request.shown !== false);
    return parts.count;
  }

  function refresh() {
    timer = null;
    if (!frame) {
      const count = wanted ? open(wanted) : 0;
      if (count) {
        found(count);
      }
      return;
    }
    prepare();
    const parts = focusPage(win.document, source);
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
    forward({ focus, ...message }) {
      frame?.contentWindow?.postMessage(message, '*');
    },
    changed() {
      if ((frame || wanted) && !timer) {
        timer = win.setTimeout(refresh, REFRESH_MS);
      }
    }
  };
}

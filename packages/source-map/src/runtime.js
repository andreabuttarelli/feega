export const SOURCE_ATTR = 'data-feega-src';

const DEFAULT_MAX_HTML = 2000;
const TEXT_NODE = 3;

const DESIGN_PROPERTIES = [
  'display', 'position', 'width', 'height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'flex-direction', 'justify-content', 'align-items', 'grid-template-columns',
  'color', 'background-color', 'background-image', 'opacity',
  'border-top-width', 'border-top-style', 'border-top-color', 'border-radius', 'box-shadow',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-transform'
];

const SOURCE_PATTERN = /^(.+):(\d+):(\d+)$/;

export function parseSource(value) {
  const match = SOURCE_PATTERN.exec(value ?? '');
  if (!match) {
    return null;
  }
  return { file: match[1], line: Number(match[2]), col: Number(match[3]) };
}

export function inspectElement(element, { maxHtml = DEFAULT_MAX_HTML } = {}) {
  const tagged = element.closest(`[${SOURCE_ATTR}]`);
  if (!tagged) {
    return null;
  }

  const source = parseSource(tagged.getAttribute(SOURCE_ATTR));
  return {
    source,
    styles: designStyles(tagged),
    html: truncate(tagged.outerHTML, maxHtml),
    component: componentBoundary(tagged, source.file),
    rect: rectOf(tagged),
    classes: tagged.getAttribute('class') ?? '',
    text: tagged.children.length ? null : tagged.textContent,
    ownText: [...tagged.childNodes].some((n) => n.nodeType === TEXT_NODE && n.textContent.trim()),
    elements: tagged.children.length,
    rem: rootFontSize(tagged.ownerDocument),
    viewport: tagged.ownerDocument.defaultView.innerWidth
  };
}

function rootFontSize(doc) {
  return parseFloat(doc.defaultView.getComputedStyle(doc.documentElement).fontSize);
}

function rectOf(element) {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
}

const PREVIEW_STYLE_ID = 'feega-preview';
const previews = new WeakMap();

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const sourcedIn = (doc, source) => [...doc.querySelectorAll(`[${SOURCE_ATTR}]`)].filter((e) => e.getAttribute(SOURCE_ATTR) === source);

function previewsOf(doc) {
  if (!previews.has(doc)) {
    previews.set(doc, new Map());
  }
  return previews.get(doc);
}

function sheetOf(doc) {
  const found = doc.getElementById(PREVIEW_STYLE_ID);
  if (found) {
    return found;
  }
  const style = doc.createElement('style');
  style.id = PREVIEW_STYLE_ID;
  (doc.head ?? doc.documentElement).append(style);
  return style;
}

const ruleOf = (source, css) => `[${SOURCE_ATTR}=${JSON.stringify(source)}]{${Object.entries(css).map(([n, v]) => `${n}:${v} !important`).join(';')}}`;

function render(doc) {
  sheetOf(doc).textContent = [...previewsOf(doc)].map(([source, css]) => ruleOf(source, css)).join('\n');
}

export function previewEdit(doc, { source, text, style }) {
  for (const element of sourcedIn(doc, source)) {
    if (typeof text === 'string') {
      element.textContent = text;
    }
  }
  const css = Object.fromEntries(Object.entries(style ?? {}).map(([name, value]) => [kebab(name), value]));
  if (!Object.keys(css).length) {
    return;
  }
  const all = previewsOf(doc);
  all.set(source, { ...all.get(source), ...css });
  render(doc);
}

export function keepPreviews(doc) {
  if (previewsOf(doc).size && !doc.getElementById(PREVIEW_STYLE_ID)) {
    render(doc);
  }
}

export function clearPreview(doc, source) {
  previewsOf(doc).delete(source);
  render(doc);
}

export function settlePreview(doc, source) {
  const all = previewsOf(doc);
  const css = all.get(source);
  const [element] = sourcedIn(doc, source);
  if (!css || !element) {
    return Object.keys(css ?? {});
  }

  const computed = (name) => doc.defaultView.getComputedStyle(element).getPropertyValue(name);
  const wanted = Object.fromEntries(Object.keys(css).map((name) => [name, computed(name)]));
  all.delete(source);
  render(doc);
  const left = Object.fromEntries(Object.entries(css).filter(([name]) => computed(name) !== wanted[name]));

  if (Object.keys(left).length) {
    all.set(source, left);
    render(doc);
  }
  return Object.keys(left);
}

function designStyles(element) {
  const computed = element.ownerDocument.defaultView.getComputedStyle(element);
  return Object.fromEntries(DESIGN_PROPERTIES.map((name) => [name, computed.getPropertyValue(name)]));
}

function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function componentBoundary(element, file) {
  for (let node = element.parentElement?.closest(`[${SOURCE_ATTR}]`); node; node = node.parentElement?.closest(`[${SOURCE_ATTR}]`)) {
    const source = parseSource(node.getAttribute(SOURCE_ATTR));
    if (source && source.file !== file) {
      return source;
    }
  }
  return null;
}

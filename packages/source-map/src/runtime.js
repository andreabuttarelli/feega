import { layerName } from './layer-names.js';

export const SOURCE_ATTR = 'data-feega-src';
export const ICON_ATTR = 'data-feega-icon';
export const FORCE_ATTR = 'data-feega-force';
const BOOKKEEPING_ATTRS = new Set([SOURCE_ATTR, ICON_ATTR, FORCE_ATTR]);

const DEFAULT_MAX_HTML = 2000;
const TEXT_NODE = 3;

const DESIGN_PROPERTIES = [
  'display', 'position', 'width', 'height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'flex-direction', 'justify-content', 'align-items', 'grid-template-columns',
  'color', 'background-color', 'background-image', 'background-size', 'background-repeat', 'background-position', 'background-clip', '-webkit-background-clip', 'opacity',
  'border-top-width', 'border-top-style', 'border-top-color', 'border-radius',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius', 'box-shadow',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-shadow',
  'top', 'right', 'bottom', 'left', 'z-index', 'overflow-x', 'overflow-y',
  'min-width', 'max-width', 'min-height', 'max-height', 'aspect-ratio', 'object-fit', 'object-position',
  'grid-template-rows', 'row-gap', 'column-gap', 'grid-column', 'grid-row',
  'flex-grow', 'flex-shrink', 'flex-basis', 'align-self', 'order',
  'border-right-width', 'border-bottom-width', 'border-left-width',
  'outline-width', 'outline-style', 'outline-color', 'outline-offset',
  'mix-blend-mode', 'filter', 'backdrop-filter', 'translate', 'rotate', 'scale',
  'transition-property', 'transition-duration', 'transition-timing-function', 'cursor',
  'text-decoration-line', 'text-overflow', 'white-space', '-webkit-line-clamp', 'word-break',
  'list-style-type', 'list-style-position',
  'fill', 'stroke', 'stroke-width'
];

const INHERITED_PROPERTIES = new Set([
  'color', 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-shadow',
  'cursor', 'white-space', 'word-break', 'list-style-type', 'list-style-position'
]);

const SOURCE_PATTERN = /^(.+):(\d+):(\d+)$/;
const CUSTOM_PROPERTY = /^--/;
const CSS_WIDE = new Set(['', 'initial', 'inherit', 'unset', 'revert', 'revert-layer']);

export function parseSource(value) {
  const match = SOURCE_PATTERN.exec(value ?? '');
  if (!match) {
    return null;
  }
  return { file: match[1], line: Number(match[2]), col: Number(match[3]) };
}

const INNER_KEY = ' >> ';
const STATE_KEY = ' @@ ';
const keyOf = (source, inner, state) => `${source}${inner ? `${INNER_KEY}${inner}` : ''}${state ? `${STATE_KEY}${state}` : ''}`;

function untaggedSvg(element, tagged) {
  const svg = element.closest('svg');
  return svg && !svg.hasAttribute(SOURCE_ATTR) && tagged.contains(svg) && svg !== tagged ? svg : null;
}

export function deepestAt(doc, x, y) {
  let at = doc.elementFromPoint(x, y);
  while (at) {
    const inside = [...at.children].reverse().find((child) => {
      const r = child.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
    });
    if (!inside || inside.tagName.toLowerCase() === 'path') {
      return at;
    }
    at = inside;
    if (at.tagName.toLowerCase() === 'svg') {
      return at;
    }
  }
  return at;
}

export function inspectElement(element, { maxHtml = DEFAULT_MAX_HTML, twin = null } = {}) {
  const closest = element.closest(`[${SOURCE_ATTR}]`);
  const tagged = closest && !isPageElement(closest) ? closest : null;
  if (!tagged) {
    const page = closest ?? element;
    return pageTargetOf(page) ? inspectPage(page, maxHtml) : null;
  }
  const svg = untaggedSvg(element, tagged);
  if (svg) {
    return { ...inspectTagged(tagged, maxHtml, twin), inner: 'svg', styles: designStyles(svg), html: truncate(svg.outerHTML, maxHtml), rect: rectOf(svg), name: 'icon', ownText: false, inlineText: false, elements: 0, text: null };
  }
  return inspectTagged(tagged, maxHtml, twin);
}

export const PAGE_SOURCE = '(page):0:0';
export const HTML_SOURCE = '(html):0:0';

const PAGE_SOURCES = { body: PAGE_SOURCE, html: HTML_SOURCE };

function pageTargetOf(element) {
  const tag = element.tagName.toLowerCase();
  return element === element.ownerDocument[tag === 'html' ? 'documentElement' : 'body'] && PAGE_SOURCES[tag] ? tag : null;
}

function pageElementOf(doc, source) {
  return { [PAGE_SOURCE]: doc.body, [HTML_SOURCE]: doc.documentElement }[source] ?? null;
}

function inspectPage(body, maxHtml) {
  const target = pageTargetOf(body);
  return {
    source: parseSource(PAGE_SOURCES[target]),
    page: target,
    styles: designStyles(body),
    html: truncate(`<${target}>`, maxHtml),
    component: null,
    rect: rectOf(body),
    classes: body.getAttribute('class') ?? '',
    text: null,
    name: target,
    instances: 1,
    instanceIndex: 0,
    classCount: 0,
    parentWidth: body.getBoundingClientRect().width,
    ancestors: target === 'body' ? [pageAncestor('html')] : [],
    attributes: [],
    ownText: false,
    inlineText: false,
    elements: body.children.length,
    rem: rootFontSize(body.ownerDocument),
    viewport: body.ownerDocument.defaultView.innerWidth
  };
}

const instancesOf = (tagged) => [...tagged.ownerDocument.querySelectorAll(`[${SOURCE_ATTR}="${tagged.getAttribute(SOURCE_ATTR)}"]`)];

function inspectTagged(tagged, maxHtml, twin) {
  const source = parseSource(tagged.getAttribute(SOURCE_ATTR));
  const onPage = twin?.(tagged) ?? tagged;
  const styles = designStyles(tagged);
  return {
    source,
    styles,
    inherited: inheritedStyles(tagged, styles),
    html: truncate(tagged.outerHTML, maxHtml),
    component: componentBoundary(tagged, source.file),
    rect: rectOf(tagged),
    classes: tagged.getAttribute('class') ?? '',
    text: tagged.children.length ? null : tagged.textContent,
    name: nameOf(tagged),
    instances: instancesOf(onPage).length,
    instanceIndex: instancesOf(tagged).indexOf(tagged),
    usage: usageOf(onPage, source.file),
    classCount: tagged.classList?.[0] ? tagged.ownerDocument.getElementsByClassName(tagged.classList[0]).length : 0,
    parentWidth: tagged.parentElement?.getBoundingClientRect().width ?? 0,
    ancestors: ancestorsOf(tagged),
    attributes: [...tagged.attributes].filter((a) => !BOOKKEEPING_ATTRS.has(a.name)).map(({ name, value }) => ({ name, value })),
    variables: colourVariables(tagged),
    ownText: [...tagged.childNodes].some((n) => n.nodeType === TEXT_NODE && n.textContent.trim()),
    elements: tagged.children.length,
    inlineText: inlineTextOnly(tagged),
    rem: rootFontSize(tagged.ownerDocument),
    viewport: tagged.ownerDocument.defaultView.innerWidth
  };
}

const INLINE_TEXT = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'A', 'BR', 'CODE', 'SMALL', 'MARK', 'SUB', 'SUP', 'U', 'S']);

const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === TEXT_NODE && n.textContent.trim());

function inlineTextOnly(el) {
  const all = [...el.querySelectorAll('*')];
  const prose = hasOwnText(el);
  const inline = (d) => INLINE_TEXT.has(d.tagName.toUpperCase()) && (d.tagName.toUpperCase() !== 'A' || prose);
  return all.length > 0 && all.every(inline) && Boolean(el.textContent.trim());
}

function rootFontSize(doc) {
  return parseFloat(doc.defaultView.getComputedStyle(doc.documentElement).fontSize);
}

const boxOf = ({ x, y, width, height }) => ({ x, y, width, height });
const isEmpty = (box) => box.width === 0 && box.height === 0;

function unionOf(boxes) {
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function rectOf(element) {
  const own = boxOf(element.getBoundingClientRect());
  if (!isEmpty(own) || element.ownerDocument.defaultView.getComputedStyle(element).display !== 'contents') {
    return own;
  }
  const inner = [...element.children].map(rectOf).filter((box) => !isEmpty(box));
  return inner.length ? unionOf(inner) : own;
}

const PREVIEW_STYLE_ID = 'feega-preview';
const previews = new WeakMap();

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const sourcedIn = (doc, source) => {
  const page = pageElementOf(doc, source);
  return page ? [page] : [...doc.querySelectorAll(`[${SOURCE_ATTR}]`)].filter((e) => e.getAttribute(SOURCE_ATTR) === source);
};

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

const PAGE_SOURCES_BY_SOURCE = { [PAGE_SOURCE]: 'body', [HTML_SOURCE]: 'html' };

const selectorOf = (key) => {
  const [rest, state] = key.split(STATE_KEY);
  const [source, inner] = rest.split(INNER_KEY);
  const forced = state ? `[${FORCE_ATTR}~=${JSON.stringify(state)}]` : '';
  if (PAGE_SOURCES_BY_SOURCE[source]) {
    return `${PAGE_SOURCES_BY_SOURCE[source]}${forced}`;
  }
  return `[${SOURCE_ATTR}=${JSON.stringify(source)}]${forced}${inner ? ` ${inner}` : ''}`;
};

const ruleOf = (key, css) => `${selectorOf(key)}{${Object.entries(css).map(([n, v]) => `${n}:${v} !important`).join(';')}}`;

function render(doc) {
  sheetOf(doc).textContent = [...previewsOf(doc)].map(([source, css]) => ruleOf(source, css)).join('\n');
}

export function previewEdit(doc, { source, inner, text, style, state }) {
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
  const key = keyOf(source, inner, state);
  all.set(key, { ...all.get(key), ...css });
  render(doc);
}

const HIDDEN_STYLE_ID = 'feega-hidden';
const hiddenSets = new WeakMap();

export function hidePreview(doc, source, hidden) {
  const set = hiddenSets.get(doc) ?? new Set();
  hiddenSets.set(doc, set);
  if (hidden) {
    set.add(source);
  } else {
    set.delete(source);
  }
  let style = doc.getElementById(HIDDEN_STYLE_ID);
  if (!style) {
    style = doc.createElement('style');
    style.id = HIDDEN_STYLE_ID;
    (doc.head ?? doc.documentElement).append(style);
  }
  style.textContent = [...set].map((s) => `[${SOURCE_ATTR}=${JSON.stringify(s)}]{display:none !important}`).join('\n');
}

export function keepPreviews(doc) {
  if (previewsOf(doc).size && !doc.getElementById(PREVIEW_STYLE_ID)) {
    render(doc);
  }
}

export function clearPreview(doc, source, state) {
  const all = previewsOf(doc);
  const suffix = state ? `${STATE_KEY}${state}` : '';
  const inState = (key) => key.endsWith(suffix) && (state || !key.includes(STATE_KEY));
  const own = (key) => key === keyOf(source, undefined, state) || (key.startsWith(`${source}${INNER_KEY}`) && inState(key));
  [...all.keys()].filter(own).forEach((key) => all.delete(key));
  render(doc);
}

export function clearPreviews(doc) {
  previewsOf(doc).clear();
  render(doc);
}

export function settlePreview(doc, source, state) {
  const all = previewsOf(doc);
  const key = keyOf(source, undefined, state);
  const css = all.get(key);
  const [element] = sourcedIn(doc, source);
  if (!css || !element) {
    return Object.keys(css ?? {});
  }

  const computed = (name) => doc.defaultView.getComputedStyle(element).getPropertyValue(name);
  const wanted = Object.fromEntries(Object.keys(css).map((name) => [name, computed(name)]));
  all.delete(key);
  render(doc);
  const left = Object.fromEntries(Object.entries(css).filter(([name]) => computed(name) !== wanted[name]));

  if (Object.keys(left).length) {
    all.set(key, left);
    render(doc);
  }
  return Object.keys(left);
}

const MAX_ANCESTORS = 12;

export const GHOST_ATTR = 'data-feega-ghost';

const isGhost = (element) => element?.hasAttribute(GHOST_ATTR) ?? false;
const isPageElement = (element) => element === element.ownerDocument.body || element === element.ownerDocument.documentElement;
const taggedParent = (element) => {
  const parent = element.parentElement?.closest(`[${SOURCE_ATTR}]`) ?? null;
  return parent && isPageElement(parent) ? null : parent;
};
const shownParent = (element) => {
  const parent = taggedParent(element);
  return isGhost(parent) ? null : parent;
};
const fileOf = (element) => parseSource(element.getAttribute(SOURCE_ATTR))?.file ?? '';
const componentName = (file) => file.split('/').pop().replace(/\.[^.]+$/, '');

export function nameOf(element) {
  const icon = element.getAttribute(ICON_ATTR);
  if (icon) {
    return icon;
  }
  const parent = taggedParent(element);
  if (parent && fileOf(parent) !== fileOf(element)) {
    return componentName(fileOf(element));
  }
  return layerName(element);
}

const pageAncestor = (tag) => ({ source: parseSource(PAGE_SOURCES[tag]), name: tag });

function ancestorsOf(element) {
  const chain = [];
  for (let node = shownParent(element); node && chain.length < MAX_ANCESTORS; node = shownParent(node)) {
    chain.unshift({ source: parseSource(node.getAttribute(SOURCE_ATTR)), name: nameOf(node) });
  }
  const inHead = element.ownerDocument.head?.contains(element);
  return [pageAncestor('html'), ...(inHead ? [] : [pageAncestor('body')]), ...chain];
}

const taggedChildren = (element) => [...element.querySelectorAll(`[${SOURCE_ATTR}]`)].filter((child) => taggedParent(child) === element);

function pageParent(element) {
  const doc = element.ownerDocument;
  if (element === doc.documentElement) {
    return null;
  }
  return element === doc.body || doc.head?.contains(element) ? doc.documentElement : doc.body;
}

const MOVES = {
  parent: (element) => shownParent(element) ?? pageParent(element),
  child: (element) => taggedChildren(element)[0] ?? null,
  next: (element) => sibling(element, 1),
  previous: (element) => sibling(element, -1)
};

function sibling(element, step) {
  const parent = taggedParent(element);
  const all = parent ? taggedChildren(parent) : [];
  return all[all.indexOf(element) + step] ?? null;
}

const MAX_TREE_DEPTH = 24;
const MAX_TREE_NODES = 1500;

function instanceIndexes(doc) {
  const seen = new Map();
  const index = new Map();
  for (const element of doc.querySelectorAll(`[${SOURCE_ATTR}]`)) {
    const attr = element.getAttribute(SOURCE_ATTR);
    index.set(element, seen.get(attr) ?? 0);
    seen.set(attr, (seen.get(attr) ?? 0) + 1);
  }
  return index;
}

function nodeOf(element, depth, budget) {
  budget.left--;
  const parent = taggedParent(element);
  const children = depth < MAX_TREE_DEPTH && budget.left > 0 ? foldedOf(taggedChildren(element), depth + 1, budget) : [];
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  return {
    name: nameOf(element),
    tag: element.tagName.toLowerCase(),
    display: style.display,
    direction: style.flexDirection || 'row',
    position: style.position || 'static',
    source: parseSource(element.getAttribute(SOURCE_ATTR)),
    component: Boolean(parent) && fileOf(parent) !== fileOf(element),
    count: 1,
    instance: budget.instances.get(element) ?? 0,
    children
  };
}

function foldedOf(elements, depth, budget) {
  const nodes = [];
  for (const element of elements) {
    const last = nodes.at(-1);
    if (last && last.attr === element.getAttribute(SOURCE_ATTR)) {
      last.node.count++;
      continue;
    }
    if (budget.left <= 0) {
      break;
    }
    nodes.push({ attr: element.getAttribute(SOURCE_ATTR), node: nodeOf(element, depth, budget) });
  }
  return nodes.map((n) => n.node);
}

export const HEAD_GROUP = 'Head';

function pageNode(element, source, children) {
  const tag = element.tagName.toLowerCase();
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  return { name: tag, tag, display: style.display, direction: 'row', position: style.position || 'static', source: parseSource(source), component: false, count: 1, children };
}

export function treeOf(doc, { bare = false } = {}) {
  const roots = [...doc.querySelectorAll(`[${SOURCE_ATTR}]`)].filter((e) => !isPageElement(e) && !isGhost(e) && !shownParent(e));
  const budget = { left: MAX_TREE_NODES, instances: instanceIndexes(doc) };
  const inHead = (e) => Boolean(doc.head?.contains(e));
  const head = foldedOf(roots.filter(inHead), 1, budget);
  const body = foldedOf(roots.filter((e) => !inHead(e)), 0, budget);
  if (bare) {
    return body;
  }
  const group = { name: HEAD_GROUP, tag: 'head', display: 'none', direction: 'row', position: 'static', source: null, component: false, count: head.length, children: head };
  return [pageNode(doc.documentElement, HTML_SOURCE, [...(head.length ? [group] : []), pageNode(doc.body, PAGE_SOURCE, body)])];
}

const PALETTE_MAX = 16;
const COLOUR_PROPS = ['color', 'background-color', 'border-top-color'];
const COLOUR_VALUE = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|color\()/i;
const TRANSPARENT_VALUE = /^(transparent|rgba\([^)]*,\s*0\))$/;
const ROOT_SELECTOR = /(^|,)\s*(:root|html|:host)\s*(,|$)/;

function rootTokens(doc) {
  const tokens = new Map();
  for (const sheet of doc.styleSheets) {
    let rules = [];
    try {
      rules = [...sheet.cssRules];
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (!rule.style || !ROOT_SELECTOR.test(rule.selectorText ?? '')) {
        continue;
      }
      for (let i = 0; i < rule.style.length; i++) {
        const name = rule.style[i];
        const value = rule.style.getPropertyValue(name).trim();
        if (name.startsWith('--') && COLOUR_VALUE.test(value)) {
          tokens.set(name, value);
        }
      }
    }
  }
  return [...tokens].map(([name, value]) => ({ name, value }));
}

const GENERIC_FONTS = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', '-apple-system', 'blinkmacsystemfont', 'inherit', 'initial']);

const unquoted = (name) => name.trim().replace(/^["']|["']$/g, '');

function fontsOf(doc) {
  const names = new Set();
  for (const element of doc.querySelectorAll(`[${SOURCE_ATTR}]`)) {
    for (const part of doc.defaultView.getComputedStyle(element).fontFamily.split(',')) {
      const name = unquoted(part);
      if (name && !GENERIC_FONTS.has(name.toLowerCase())) {
        names.add(name);
      }
    }
  }
  for (const face of doc.fonts ?? []) {
    names.add(unquoted(face.family));
  }
  return [...names];
}

export function paletteOf(doc) {
  const counts = new Map();
  for (const element of doc.querySelectorAll(`[${SOURCE_ATTR}]`)) {
    const style = doc.defaultView.getComputedStyle(element);
    for (const prop of COLOUR_PROPS) {
      const value = style.getPropertyValue(prop).trim();
      if (COLOUR_VALUE.test(value) && !TRANSPARENT_VALUE.test(value)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
  }
  const document = [...counts].sort((a, b) => b[1] - a[1]).slice(0, PALETTE_MAX).map(([value]) => value);
  return { document, tokens: rootTokens(doc), fonts: fontsOf(doc) };
}

export function relativeOf(doc, source, move) {
  const [element] = sourcedIn(doc, source);
  return element && MOVES[move] ? MOVES[move](element) : null;
}

function originOf(element, name, value) {
  let origin = null;
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.ownerDocument.defaultView.getComputedStyle(node).getPropertyValue(name) !== value) {
      return origin;
    }
    origin = node.tagName.toLowerCase();
  }
  return origin;
}

function inheritedStyles(element, styles) {
  const found = [...INHERITED_PROPERTIES].map((name) => [name, originOf(element, name, styles[name])]);
  return Object.fromEntries(found.filter(([, origin]) => origin));
}

function matching(element, selector) {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function sheetRules(sheet) {
  try {
    return [...sheet.cssRules];
  } catch {
    return [];
  }
}

function declaringRules(element, rules) {
  return rules.flatMap((rule) => {
    if (rule.cssRules && !rule.selectorText) {
      return declaringRules(element, [...rule.cssRules]);
    }

    return rule.selectorText && matching(element, rule.selectorText) ? [rule.style] : [];
  });
}

function declaredVariables(element) {
  const sheets = [...element.ownerDocument.styleSheets].flatMap(sheetRules);
  const styles = [...declaringRules(element, sheets), element.style].filter(Boolean);
  const names = (style) => Array.from({ length: style.length }, (_, i) => style[i]);
  return [...new Set(styles.flatMap((style) => names(style).filter((name) => CUSTOM_PROPERTY.test(name))))];
}

function isColour(doc, value) {
  const probe = doc.createElement('i').style;
  probe.color = value;
  return !CSS_WIDE.has(value) && probe.color !== '';
}

function colourVariables(element) {
  const computed = element.ownerDocument.defaultView.getComputedStyle(element);
  return declaredVariables(element)
    .map((name) => ({ name, value: computed.getPropertyValue(name).trim() }))
    .filter((v) => isColour(element.ownerDocument, v.value));
}

function designStyles(element) {
  const computed = element.ownerDocument.defaultView.getComputedStyle(element);
  return Object.fromEntries(DESIGN_PROPERTIES.map((name) => [name, computed.getPropertyValue(name)]));
}

function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

const LAYOUT_FILE = /(^|\/)(\+layout\.svelte|layout\.[jt]sx?|_app\.[jt]sx?|root\.[jt]sx?)$/;

function boundaryOf(element, file) {
  let root = { source: parseSource(element.getAttribute(SOURCE_ATTR)), node: element };
  for (let node = element.parentElement?.closest(`[${SOURCE_ATTR}]`); node; node = node.parentElement?.closest(`[${SOURCE_ATTR}]`)) {
    const source = parseSource(node.getAttribute(SOURCE_ATTR));
    if (!source || source.file === file) {
      root = source ? { source, node } : root;
      continue;
    }
    return LAYOUT_FILE.test(source.file) && !LAYOUT_FILE.test(file) ? root : { source, node };
  }
  return null;
}

const componentBoundary = (element, file) => boundaryOf(element, file)?.source ?? null;

function usageOf(tagged, file) {
  const boundary = boundaryOf(tagged, file);
  if (!boundary) {
    return { index: 0, count: 1 };
  }
  const same = [...boundary.node.querySelectorAll(`[${SOURCE_ATTR}="${tagged.getAttribute(SOURCE_ATTR)}"]`)];
  return { index: Math.max(same.indexOf(tagged), 0), count: Math.max(same.length, 1) };
}

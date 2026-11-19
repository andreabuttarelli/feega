export const SOURCE_ATTR = 'data-feega-src';

const DEFAULT_MAX_HTML = 2000;
const TEXT_NODE = 3;

const DESIGN_PROPERTIES = [
  'display', 'position', 'width', 'height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'flex-direction', 'justify-content', 'align-items', 'grid-template-columns',
  'color', 'background-color', 'background-image', 'opacity',
  'border-top-width', 'border-top-style', 'border-top-color', 'border-radius',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius', 'box-shadow',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-shadow'
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
    name: nameOf(tagged),
    instances: tagged.ownerDocument.querySelectorAll(`[${SOURCE_ATTR}="${tagged.getAttribute(SOURCE_ATTR)}"]`).length,
    classCount: tagged.classList?.[0] ? tagged.ownerDocument.getElementsByClassName(tagged.classList[0]).length : 0,
    parentWidth: tagged.parentElement?.getBoundingClientRect().width ?? 0,
    ancestors: ancestorsOf(tagged),
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

const MAX_ANCESTORS = 12;

const taggedParent = (element) => element.parentElement?.closest(`[${SOURCE_ATTR}]`) ?? null;
const fileOf = (element) => parseSource(element.getAttribute(SOURCE_ATTR))?.file ?? '';
const componentName = (file) => file.split('/').pop().replace(/\.[^.]+$/, '');

export function nameOf(element) {
  const parent = taggedParent(element);
  if (parent && fileOf(parent) !== fileOf(element)) {
    return componentName(fileOf(element));
  }
  const tag = element.tagName.toLowerCase();
  const first = element.classList?.[0];
  return element.id ? `${tag}#${element.id}` : first ? `${tag}.${first}` : tag;
}

function ancestorsOf(element) {
  const chain = [];
  for (let node = taggedParent(element); node && chain.length < MAX_ANCESTORS; node = taggedParent(node)) {
    chain.unshift({ source: parseSource(node.getAttribute(SOURCE_ATTR)), name: nameOf(node) });
  }
  return chain;
}

const taggedChildren = (element) => [...element.querySelectorAll(`[${SOURCE_ATTR}]`)].filter((child) => taggedParent(child) === element);

const MOVES = {
  parent: (element) => taggedParent(element),
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
    source: parseSource(element.getAttribute(SOURCE_ATTR)),
    component: Boolean(parent) && fileOf(parent) !== fileOf(element),
    count: 1,
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

export function treeOf(doc) {
  const roots = [...doc.querySelectorAll(`[${SOURCE_ATTR}]`)].filter((e) => !taggedParent(e));
  const budget = { left: MAX_TREE_NODES };
  const inHead = (e) => Boolean(doc.head?.contains(e));
  const head = foldedOf(roots.filter(inHead), 1, budget);
  const body = foldedOf(roots.filter((e) => !inHead(e)), 0, budget);
  const group = { name: HEAD_GROUP, tag: 'head', display: 'none', direction: 'row', source: null, component: false, count: head.length, children: head };
  return head.length ? [group, ...body] : body;
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

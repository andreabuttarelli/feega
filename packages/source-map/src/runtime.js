export const SOURCE_ATTR = 'data-feega-src';

const DEFAULT_MAX_HTML = 2000;

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
    component: componentBoundary(tagged, source.file)
  };
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

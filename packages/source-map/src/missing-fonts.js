import { SOURCE_ATTR } from './runtime.js';

const SYSTEM_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', '-apple-system', 'blinkmacsystemfont', 'inherit', 'initial']);
const BASELINES = ['monospace', 'serif'];
const UNKNOWN_FAMILY = 'feega-no-such-font';
const SAMPLE = 'mmmmmmmmmmlli0Oq';
const SAMPLE_SIZE_PX = 72;
const FAILED = 'error';
const DEFAULT_FALLBACK = 'the default font';
const TEXT_NODE = 3;
const GOOGLE_STYLES = /fonts\.googleapis\.com\/css/;

const unquoted = (name) => name.trim().replace(/^["']|["']$/g, '');

export function canvasMeasure(doc) {
  const context = doc.createElement('canvas').getContext?.('2d');
  if (!context) {
    return null;
  }
  return (family, baseline) => {
    context.font = `${SAMPLE_SIZE_PX}px "${family}", ${baseline}`;
    return String(context.measureText(SAMPLE).width);
  };
}

function installed(family, measure) {
  return BASELINES.some((baseline) => measure(family, baseline) !== measure(UNKNOWN_FAMILY, baseline));
}

function faceStatuses(doc) {
  const statuses = new Map();
  for (const face of doc.fonts ?? []) {
    statuses.set(unquoted(face.family).toLowerCase(), face.status);
  }
  return statuses;
}

function requestedHrefs(doc) {
  const hrefs = [...doc.querySelectorAll('link[rel~="stylesheet"]')].map((link) => link.getAttribute('href') ?? '');
  for (const sheet of doc.styleSheets) {
    try {
      hrefs.push(...[...sheet.cssRules].map((rule) => rule.href ?? '').filter(Boolean));
    } catch {
      continue;
    }
  }
  return hrefs;
}

function googleRequested(doc) {
  const families = new Set();
  for (const href of requestedHrefs(doc).filter((h) => GOOGLE_STYLES.test(h))) {
    for (const [, name] of href.matchAll(/[?&]family=([^:&;@]+)/g)) {
      families.add(decodeURIComponent(name.replace(/\+/g, ' ')).toLowerCase());
    }
  }
  return families;
}

function stackOf(element) {
  return element.ownerDocument.defaultView.getComputedStyle(element).fontFamily.split(',').map(unquoted).filter(Boolean);
}

function hasText(element) {
  return [...element.childNodes].some((node) => node.nodeType === TEXT_NODE && node.textContent.trim());
}

function walked(stack, resolves) {
  const missing = [];
  for (const family of stack) {
    if (SYSTEM_FAMILIES.has(family.toLowerCase()) || resolves(family)) {
      return { missing, fallback: family };
    }
    missing.push(family);
  }
  return { missing, fallback: DEFAULT_FALLBACK };
}

export function missingFontsOf(doc, measure = canvasMeasure(doc)) {
  if (!measure) {
    return [];
  }
  const statuses = faceStatuses(doc);
  const requested = googleRequested(doc);
  const resolves = (family) => {
    if (requested.has(family.toLowerCase()) && !statuses.has(family.toLowerCase())) {
      return true;
    }
    const status = statuses.get(family.toLowerCase());
    return status === undefined ? installed(family, measure) : status !== FAILED;
  };
  const found = new Map();
  for (const element of doc.querySelectorAll(`[${SOURCE_ATTR}]`)) {
    if (!hasText(element)) {
      continue;
    }
    const { missing, fallback } = walked(stackOf(element), resolves);
    for (const family of missing) {
      if (!found.has(family)) {
        found.set(family, { family, fallback, declared: statuses.has(family.toLowerCase()) });
      }
    }
  }
  return [...found.values()];
}

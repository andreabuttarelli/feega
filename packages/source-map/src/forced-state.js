import { FORCE_ATTR, SOURCE_ATTR } from './runtime.js';

const FORCED_STYLE_ID = 'feega-forced';
const OWN_STYLE_IDS = new Set([FORCED_STYLE_ID, 'feega-preview', 'feega-hidden']);
const DEFAULT_STATE = 'default';
const REBUILD_MS = 100;

const PSEUDO_STATES = {
  hover: { pattern: /:hover(?![\w-])/g, reachesAncestors: true },
  focus: { pattern: /:focus(?![\w-])/g, reachesAncestors: false },
  'focus-visible': { pattern: /:focus-visible(?![\w-])/g, reachesAncestors: false },
  active: { pattern: /:active(?![\w-])/g, reachesAncestors: true },
  disabled: { pattern: /:disabled(?![\w-])/g, reachesAncestors: false }
};

const STATES = Object.keys(PSEUDO_STATES);
const GROUP_HEAD = /^@(media|supports|layer|container)\b/;
const HOVER_MEDIA = /\(\s*hover\s*:\s*hover\s*\)/g;
const ANY_WIDTH = '(min-width: 0px)';
const TRAILING_COMBINATOR = /[\s>+~]$/;

const forced = new WeakMap();
const indexes = new WeakMap();

const has = (selector, state) => new RegExp(PSEUDO_STATES[state].pattern.source).test(selector);

function splitSelectors(text) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    depth += '([' .includes(text[i]) ? 1 : ')]'.includes(text[i]) ? -1 : 0;
    if (text[i] === ',' && depth === 0) {
      parts.push(text.slice(from, i));
      from = i + 1;
    }
  }
  return [...parts, text.slice(from)].map((p) => p.trim()).filter(Boolean);
}

const forcedSelector = (selector, state) => selector.replace(PSEUDO_STATES[state].pattern, `[${FORCE_ATTR}~="${state}"]`);

function plainSelector(selector, state) {
  const bare = selector.replace(PSEUDO_STATES[state].pattern, '').trim();
  return !bare || TRAILING_COMBINATOR.test(bare) ? `${bare}*` : bare;
}

function rulesOf(sheet) {
  try {
    return [...sheet.cssRules];
  } catch {
    return [];
  }
}

const ownSheet = (sheet) => OWN_STYLE_IDS.has(sheet.ownerNode?.id);

const isGroup = (rule) => rule.cssRules && !rule.selectorText && GROUP_HEAD.test(rule.cssText.trim());

function* styleRules(rules) {
  for (const rule of rules) {
    if (rule.selectorText) {
      yield rule;
    } else if (isGroup(rule)) {
      yield* styleRules([...rule.cssRules]);
    }
  }
}

function forcedText(rules, state) {
  const out = [];
  for (const rule of rules) {
    if (rule.selectorText) {
      const hit = splitSelectors(rule.selectorText).filter((s) => has(s, state));
      hit.length && out.push(`${hit.map((s) => forcedSelector(s, state)).join(', ')} { ${rule.style.cssText} }`);
      continue;
    }
    if (!isGroup(rule)) {
      continue;
    }
    const inner = forcedText([...rule.cssRules], state);
    const head = rule.cssText.slice(0, rule.cssText.indexOf('{')).trim().replace(HOVER_MEDIA, ANY_WIDTH);
    inner && out.push(`${head} {\n${inner}\n}`);
  }
  return out.join('\n');
}

function sheetOf(doc) {
  const found = doc.getElementById(FORCED_STYLE_ID);
  if (found) {
    return found;
  }
  const style = doc.createElement('style');
  style.id = FORCED_STYLE_ID;
  (doc.head ?? doc.documentElement).append(style);
  return style;
}

const sourced = (doc, source) => [...doc.querySelectorAll(`[${SOURCE_ATTR}]`)].filter((e) => e.getAttribute(SOURCE_ATTR) === source);

function mark(elements, state) {
  const reached = new Set();
  for (const element of elements) {
    reached.add(element);
    if (PSEUDO_STATES[state].reachesAncestors) {
      for (let up = element.parentElement; up; up = up.parentElement) {
        reached.add(up);
      }
    }
  }
  reached.forEach((e) => e.setAttribute(FORCE_ATTR, state));
  return reached;
}

function settleTransitions(doc, elements) {
  const view = doc.defaultView;
  for (const element of elements) {
    view.getComputedStyle(element).getPropertyValue('color');
    element.getAnimations?.({ subtree: true }).forEach((a) => a.finish());
  }
}

function render(doc, state) {
  const rules = [...doc.styleSheets].filter((s) => !ownSheet(s)).flatMap(rulesOf);
  const text = forcedText(rules, state);
  const style = sheetOf(doc);
  if (style.textContent !== text) {
    style.textContent = text;
  }
}

export function forceState(doc, source, state) {
  const before = forced.get(doc);
  before?.reached.forEach((e) => e.removeAttribute(FORCE_ATTR));
  forced.delete(doc);
  if (!state || state === DEFAULT_STATE || !PSEUDO_STATES[state]) {
    doc.getElementById(FORCED_STYLE_ID)?.remove();
    return;
  }
  const elements = sourced(doc, source);
  const reached = mark(elements, state);
  forced.set(doc, { source, state, reached });
  render(doc, state);
  settleTransitions(doc, elements);
}

export function settleForced(doc) {
  const now = forced.get(doc);
  if (now) {
    settleTransitions(doc, sourced(doc, now.source));
  }
}

export function keepForced(doc) {
  const now = forced.get(doc);
  if (!now) {
    return;
  }
  const elements = sourced(doc, now.source);
  now.reached.forEach((e) => e.removeAttribute(FORCE_ATTR));
  now.reached = mark(elements, now.state);
  render(doc, now.state);
}

export const forcedNow = (doc) => forced.get(doc) ?? null;

export const FORCED_REBUILD_MS = REBUILD_MS;

function signatureOf(doc) {
  const counts = [...doc.styleSheets].filter((s) => !ownSheet(s)).map((s) => rulesOf(s).length);
  const lengths = [...doc.querySelectorAll('style')].filter((s) => !OWN_STYLE_IDS.has(s.id)).map((s) => s.textContent.length);
  return `${counts.join(',')}|${lengths.join(',')}`;
}

function indexOf(doc) {
  const signature = signatureOf(doc);
  const cached = indexes.get(doc);
  if (cached?.signature === signature) {
    return cached.entries;
  }
  const entries = [];
  const rules = [...doc.styleSheets].filter((s) => !ownSheet(s)).flatMap(rulesOf);
  for (const rule of styleRules(rules)) {
    for (const selector of splitSelectors(rule.selectorText)) {
      for (const state of STATES) {
        has(selector, state) && entries.push({ state, selector: plainSelector(selector, state) });
      }
    }
  }
  indexes.set(doc, { signature, entries });
  return entries;
}

function reaches(element, selector) {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

export function statesOf(element) {
  const found = new Set();
  for (const { state, selector } of indexOf(element.ownerDocument)) {
    !found.has(state) && reaches(element, selector) && found.add(state);
  }
  return [...found];
}

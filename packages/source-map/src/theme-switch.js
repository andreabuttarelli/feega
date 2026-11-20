const KIND_CLASS = 'class';
const KIND_ATTRIBUTE = 'attribute';
const KIND_MEDIA = 'media';
const OWN_STYLE_IDS = new Set(['feega-forced', 'feega-preview', 'feega-hidden']);
const SCHEME_QUERY = /\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi;
const SCHEME_MENTION = /prefers-color-scheme/i;
const SCHEME_CHANGE = 'change';
const MATCHES_NOW = '(min-width: 0px)';
const MATCHES_NEVER = '(min-width: 100000px)';
const SHIMMED = Symbol.for('feega.source-map.scheme-shim');

const states = new WeakMap();
const originals = new WeakMap();
const wrappers = new Set();
const emulated = new WeakMap();

const schemeOf = (win) => emulated.get(win) ?? null;

const rewritten = (text, scheme) => (scheme ? text.replace(SCHEME_QUERY, (_, value) => (value.toLowerCase() === scheme ? MATCHES_NOW : MATCHES_NEVER)) : text);

function wrap(win, query, original) {
  const listeners = new Set();
  const list = {
    media: query,
    onchange: null,
    get matches() {
      return original(rewritten(query, schemeOf(win))).matches;
    },
    addEventListener: (type, listener) => type === SCHEME_CHANGE && listeners.add(listener),
    removeEventListener: (type, listener) => listeners.delete(listener),
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    dispatchEvent: () => true
  };
  const entry = { list, listeners, last: list.matches };
  wrappers.add(entry);
  return list;
}

export function watchScheme(win) {
  if (win[SHIMMED] || typeof win.matchMedia !== 'function') {
    return;
  }
  win[SHIMMED] = true;
  const original = win.matchMedia.bind(win);
  win.matchMedia = (query) => (SCHEME_MENTION.test(query) ? wrap(win, query, original) : original(query));
}

function announce() {
  for (const entry of wrappers) {
    const matches = entry.list.matches;
    if (matches === entry.last) {
      continue;
    }
    entry.last = matches;
    const event = { type: SCHEME_CHANGE, matches, media: entry.list.media };
    entry.list.onchange?.(event);
    entry.listeners.forEach((listener) => (typeof listener === 'function' ? listener(event) : listener.handleEvent(event)));
  }
}

function* mediaRules(rules) {
  for (const rule of rules) {
    if (rule.media && rule.cssRules) {
      yield rule;
    }
    if (rule.cssRules) {
      yield* mediaRules([...rule.cssRules]);
    }
  }
}

function sheetRules(sheet) {
  try {
    return [...sheet.cssRules];
  } catch {
    return [];
  }
}

const foreign = (sheet) => !OWN_STYLE_IDS.has(sheet.ownerNode?.id);

function emulate(doc, scheme) {
  for (const rule of mediaRules([...doc.styleSheets].filter(foreign).flatMap(sheetRules))) {
    const before = originals.get(rule) ?? rule.media.mediaText;
    if (!SCHEME_MENTION.test(before)) {
      continue;
    }
    originals.set(rule, before);
    const next = rewritten(before, scheme);
    if (rule.media.mediaText !== next) {
      rule.media.mediaText = next;
    }
  }
}

function schemeOfActive(active) {
  return active?.kind === KIND_MEDIA ? active.value : null;
}

function setEmulation(doc, scheme) {
  const win = doc.defaultView;
  emulated.set(win, scheme);
  emulate(doc, scheme);
  announce();
}

function snapshot(root, themes) {
  const classes = new Map();
  const attributes = new Map();
  for (const apply of themes) {
    if (apply.kind === KIND_CLASS) {
      classes.set(apply.value, root.classList.contains(apply.value));
    }
    if (apply.kind === KIND_ATTRIBUTE && !attributes.has(apply.attribute)) {
      attributes.set(apply.attribute, root.getAttribute(apply.attribute));
    }
  }
  return { classes, attributes };
}

function restore(root, saved) {
  saved.classes.forEach((had, name) => root.classList.toggle(name, had));
  saved.attributes.forEach((value, name) => (value === null ? root.removeAttribute(name) : root.setAttribute(name, value)));
}

function put(root, active) {
  if (active?.kind === KIND_CLASS) {
    root.classList.add(active.value);
  }
  if (active?.kind === KIND_ATTRIBUTE) {
    root.setAttribute(active.attribute, active.value);
  }
}

const holds = (root, active) => {
  if (active?.kind === KIND_CLASS) {
    return root.classList.contains(active.value);
  }
  return active?.kind === KIND_ATTRIBUTE ? root.getAttribute(active.attribute) === active.value : true;
};

function guard(doc, state) {
  state.observer?.disconnect();
  state.observer = null;
  if (!state.active || state.active.kind === KIND_MEDIA) {
    return;
  }
  const win = doc.defaultView;
  state.observer = new win.MutationObserver(() => !holds(doc.documentElement, state.active) && put(doc.documentElement, state.active));
  state.observer.observe(doc.documentElement, { attributes: true, attributeFilter: [state.active.kind === KIND_CLASS ? 'class' : state.active.attribute] });
}

export function applyTheme(doc, request) {
  const root = doc.documentElement;
  watchScheme(doc.defaultView);
  const state = states.get(doc) ?? { saved: null, active: null, observer: null };
  states.set(doc, state);
  state.observer?.disconnect();
  if (state.saved) {
    restore(root, state.saved);
  }
  state.saved = snapshot(root, request.themes);
  const active = request.active && request.active.kind !== 'default' ? request.active : null;
  state.active = active;
  put(root, active);
  setEmulation(doc, schemeOfActive(active));
  guard(doc, state);
}

export function keepTheme(doc) {
  const state = states.get(doc);
  if (!state?.active) {
    return;
  }
  if (state.active.kind === KIND_MEDIA) {
    emulate(doc, schemeOfActive(state.active));
  }
}

export const themeNow = (doc) => states.get(doc)?.active ?? null;

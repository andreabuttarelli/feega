import { ICON_ATTR, SOURCE_ATTR } from './runtime.js';

const REACT_FIBER_PREFIX = '__reactFiber$';
const STACK_FRAME = /\(?((?:https?:\/\/[^/\s)]+)?[^\s()]*\.(?:[jt]sx?|svelte|vue)):(\d+):(\d+)\)?\s*$/;
const FRAMEWORK_FRAME = /react-jsx|react-dom|jsx-dev-runtime|node_modules/;

const format = (file, line, col) => `${file}:${line}:${col}`;

function svelteSource(element) {
  const loc = element.__svelte_meta?.loc;
  return loc ? format(loc.file, loc.line, loc.column + 1) : null;
}

function fiberOf(element) {
  const key = Object.keys(element).find((name) => name.startsWith(REACT_FIBER_PREFIX));
  return key ? element[key] : null;
}

const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]);
const FUNCTION_MARK = { $fn: true };
const MAX_PROP_DEPTH = 4;

function componentName(type) {
  return typeof type === 'function' ? type.displayName || type.name : type?.displayName || type?.render?.name || componentName(type?.type) || '';
}

function plain(value, depth) {
  if (typeof value === 'function') {
    return FUNCTION_MARK;
  }
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return value;
  }
  if (typeof value !== 'object' || value.$$typeof || value.nodeType) {
    return undefined;
  }
  if (depth >= MAX_PROP_DEPTH) {
    throw new RangeError('too deep');
  }
  if (Array.isArray(value)) {
    return value.map((item) => plain(item, depth + 1) ?? null);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const kept = plain(item, depth + 1);
    return kept === undefined ? [] : [[key, kept]];
  }));
}

function plainProp(value) {
  try {
    return plain(value, 0);
  } catch {
    return undefined;
  }
}

export function reactMountOf(element) {
  let fiber = fiberOf(element);
  while (fiber && !COMPONENT_TAGS.has(fiber.tag)) {
    fiber = fiber.return;
  }
  if (!fiber) {
    return null;
  }
  const props = Object.fromEntries(Object.entries(fiber.memoizedProps ?? {}).flatMap(([name, value]) => {
    const kept = plainProp(value);
    return kept === undefined ? [] : [[name, kept]];
  }));
  return { name: componentName(fiber.type), props };
}

function stackSource(stack) {
  for (const frame of String(stack).split('\n').slice(1)) {
    const match = STACK_FRAME.exec(frame);
    if (match && !FRAMEWORK_FRAME.test(frame)) {
      return format(match[1].replace(/^https?:\/\/[^/]+/, ''), match[2], match[3]);
    }
  }
  return null;
}

function reactSource(element) {
  const fiber = fiberOf(element);
  const legacy = fiber?._debugSource;
  if (legacy) {
    return format(legacy.fileName, legacy.lineNumber, legacy.columnNumber);
  }
  return fiber?._debugStack ? stackSource(fiber._debugStack.stack) : null;
}

function vueSource(element) {
  const file = element.__vueParentComponent?.type?.__file;
  return file ? format(file, 1, 0) : null;
}

const READERS = [svelteSource, reactSource, vueSource];

export function sourceFromFramework(element) {
  for (const read of READERS) {
    const source = read(element);
    if (source) {
      return source;
    }
  }
  return null;
}

export function stampSources(doc) {
  for (const element of doc.body.querySelectorAll(`*:not([${SOURCE_ATTR}])`)) {
    if (element.parentElement?.closest(`[${ICON_ATTR}]`)) {
      continue;
    }
    const source = sourceFromFramework(element);
    if (source) {
      element.setAttribute(SOURCE_ATTR, source);
    }
  }
}

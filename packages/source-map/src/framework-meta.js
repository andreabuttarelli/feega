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

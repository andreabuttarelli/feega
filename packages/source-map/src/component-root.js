import { SOURCE_ATTR } from './runtime.js';

export const fileOf = (attr) => attr.slice(0, attr.lastIndexOf(':', attr.lastIndexOf(':') - 1));
export const taggedParent = (element) => element.parentElement?.closest(`[${SOURCE_ATTR}]`) ?? null;
const bySource = (doc, source) => [...doc.querySelectorAll(`[${SOURCE_ATTR}=${JSON.stringify(source)}]`)];

function componentRoot(element) {
  const file = fileOf(element.getAttribute(SOURCE_ATTR));
  let root = element;
  for (let up = taggedParent(root); up && fileOf(up.getAttribute(SOURCE_ATTR)) === file; up = taggedParent(up)) {
    root = up;
  }
  return root;
}

export function rootOf(doc, source, index = 0) {
  const element = bySource(doc, source)[index];
  return element ? componentRoot(element) : null;
}

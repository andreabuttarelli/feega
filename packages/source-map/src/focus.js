import { SOURCE_ATTR, rectOf } from './runtime.js';

const OVERLAY_ID = 'feega-focus';
const SVG_NS = 'http://www.w3.org/2000/svg';
const DIM = 'rgba(8, 8, 10, 0.84)';
const LAYER = '2147483646';
const MARGIN_PX = 12;

const states = new WeakMap();

const taggedParent = (element) => element.parentElement?.closest(`[${SOURCE_ATTR}]`) ?? null;
const fileOf = (attr) => attr.slice(0, attr.lastIndexOf(':', attr.lastIndexOf(':') - 1));

function componentRoot(element) {
  const file = fileOf(element.getAttribute(SOURCE_ATTR));
  let root = element;
  for (let up = taggedParent(root); up && fileOf(up.getAttribute(SOURCE_ATTR)) === file; up = taggedParent(up)) {
    root = up;
  }
  return root;
}

function instancesOf(doc, source, index) {
  const element = doc.querySelector(`[${SOURCE_ATTR}=${JSON.stringify(source)}]`);
  if (!element) {
    return [];
  }
  const all = [...doc.querySelectorAll(`[${SOURCE_ATTR}=${JSON.stringify(componentRoot(element).getAttribute(SOURCE_ATTR))}]`)];
  return typeof index === 'number' ? all.slice(index, index + 1) : all;
}

const holeOf = ({ x, y, width, height }) => `M${x - MARGIN_PX} ${y - MARGIN_PX}h${width + 2 * MARGIN_PX}v${height + 2 * MARGIN_PX}h${-(width + 2 * MARGIN_PX)}Z`;

function overlayOf(doc) {
  let svg = doc.getElementById(OVERLAY_ID);
  if (svg) {
    return svg;
  }
  svg = doc.createElementNS(SVG_NS, 'svg');
  svg.id = OVERLAY_ID;
  svg.style.cssText = `position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:${LAYER}`;
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('fill', DIM);
  svg.append(path);
  doc.documentElement.append(svg);
  return svg;
}

export function refreshFocus(win) {
  const state = states.get(win);
  if (!state) {
    return;
  }
  const doc = win.document;
  const targets = instancesOf(doc, state.source, state.index);
  const shape = `M0 0H${win.innerWidth}V${win.innerHeight}H0Z${targets.map((t) => holeOf(rectOf(t))).join('')}`;
  const path = overlayOf(doc).firstElementChild;
  if (path.getAttribute('d') !== shape) {
    path.setAttribute('d', shape);
  }
}

function follow(win, state) {
  if (states.get(win) !== state) {
    return;
  }
  refreshFocus(win);
  win.requestAnimationFrame?.(() => follow(win, state));
}

export function focusComponent(win, { source, index }) {
  clearFocus(win);
  const targets = instancesOf(win.document, source, index);
  if (!targets.length) {
    return 0;
  }
  const state = { source, index };
  states.set(win, state);
  targets[0].scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'instant' });
  follow(win, state);
  return targets.length;
}

export function clearFocus(win) {
  states.delete(win);
  win.document.getElementById(OVERLAY_ID)?.remove();
}

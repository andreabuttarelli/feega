import { springSource } from '../spring';
import { UI_SAFE, type UiPiece, type UiSize } from '../ui-kit/kit';
import { withinBudget, type VectorUi } from './model';
import { MAX_JS } from '../custom/component';

const JS_MARGIN = 200;

export const FALLBACK_FAMILY = 'Inter';

const VARIANT = /\s*(variable|var|vf|display|text)$/i;

export function familyFor(family: string, catalogue: readonly string[]): string {
  const wanted = family.replace(/["']/g, '').replace(/[-_]/g, ' ').replace(VARIANT, '').trim().toLowerCase();
  return catalogue.find((f) => f.toLowerCase() === wanted) ?? FALLBACK_FAMILY;
}

export function withFonts(ui: VectorUi, catalogue: readonly string[]): VectorUi {
  const mapped = new Map(ui.fonts.map((f) => [f, familyFor(f, catalogue)]));
  const first = (font: string) => font.split(',')[0].replace(/["']/g, '').trim();
  return { ...ui, fonts: [...new Set(mapped.values())], nodes: ui.nodes.map((n) => (n.font ? { ...n, font: mapped.get(first(n.font)) ?? FALLBACK_FAMILY } : n)) };
}

export const VECTOR_CSS = `
:scope { position: absolute; inset: 0; }
.vstage { position: absolute; left: 50%; top: 50%; transform-origin: 50% 50%; }
.vui { position: relative; overflow: hidden; }
.vn { position: absolute; box-sizing: border-box; }
.vn-text { white-space: pre; overflow: visible; }
.vn-icon > svg { display: block; width: 100%; height: 100%; }
.vcaret { display: inline-block; width: 0.08em; height: 1em; vertical-align: -0.12em; margin-left: 0.04em; }
`;

export const VECTOR_DRAW = `
const SPRINGS = SPRING_MATH;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const vspan = (t, at, len) => clamp01((t - at) / Math.max(0.001, len));
const expoOut = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const expoInOut = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2);
const lerp = (a, b, p) => a + (b - a) * p;
const SANS = ', Inter, system-ui, sans-serif';
const drawVector = (U, host) => {
  const els = {};
  const frame = document.createElement('div');
  frame.className = 'vui';
  frame.style.width = U.width + 'px';
  frame.style.height = U.height + 'px';
  frame.style.background = U.background;
  host.appendChild(frame);
  U.nodes.forEach((n) => {
    const el = document.createElement('div');
    el.className = 'vn vn-' + n.kind;
    const s = el.style;
    s.left = n.x + 'px';
    s.top = n.y + 'px';
    s.width = (n.kind === 'text' ? n.w * 1.03 + 1 : n.w) + 'px';
    s.height = n.h + 'px';
    if (n.o !== undefined && n.o < 1) {
      s.opacity = String(n.o);
    }
    if (n.kind === 'box') {
      if (n.fill) {
        s.background = n.fill;
      }
      if (n.stroke) {
        s.border = n.stroke;
      }
      if (n.sides) {
        s.borderTop = n.sides[0] || 'none';
        s.borderRight = n.sides[1] || 'none';
        s.borderBottom = n.sides[2] || 'none';
        s.borderLeft = n.sides[3] || 'none';
      }
      if (n.r) {
        s.borderRadius = n.r;
      }
      if (n.shadow) {
        s.boxShadow = n.shadow;
      }
      if (n.blur) {
        s.backdropFilter = 'blur(' + n.blur + 'px)';
      }
    }
    if (n.kind === 'text') {
      s.fontFamily = "'" + (n.font || 'Inter') + "'" + SANS;
      s.fontSize = (n.size || 16) + 'px';
      s.fontWeight = String(n.weight || 400);
      s.lineHeight = (n.wrap ? (n.lh ? n.lh + 'px' : 'normal') : n.h + 'px');
      s.whiteSpace = n.wrap ? 'normal' : 'pre';
      if (n.ls) {
        s.letterSpacing = n.ls + 'px';
      }
      if (n.italic) {
        s.fontStyle = 'italic';
      }
      if (n.fill) {
        s.backgroundImage = n.fill;
        s.webkitBackgroundClip = 'text';
        s.backgroundClip = 'text';
        s.color = 'transparent';
      } else {
        s.color = n.color || '#000';
      }
      el.textContent = n.text || '';
    }
    if (n.kind === 'icon' && n.svg) {
      el.innerHTML = n.svg;
    }
    if (n.kind === 'image') {
      if (n.r) {
        s.borderRadius = n.r;
      }
    }
    el.setAttribute('data-anchor', n.id);
    frame.appendChild(el);
    els[n.id] = el;
  });
  return { frame, els };
};
const nodeById = (U, id) => U.nodes.find((n) => n.id === id) || null;
const typers = {};
const typeInto = (U, els, id, text, p, t) => {
  const node = nodeById(U, id);
  const el = els[id];
  if (!node || !el || node.kind !== 'text') {
    return;
  }
  if (!typers[id]) {
    el.textContent = '';
    const typed = document.createElement('span');
    const caret = document.createElement('span');
    caret.className = 'vcaret';
    caret.style.background = node.color || '#000';
    el.appendChild(typed);
    el.appendChild(caret);
    typers[id] = { typed, caret };
  }
  const full = text || node.text || '';
  typers[id].typed.textContent = full.slice(0, Math.round(full.length * p));
  typers[id].caret.style.opacity = p < 1 || Math.floor(t * 2.4) % 2 === 0 ? '1' : '0';
};
const pressOn = (els, id, t, at) => {
  const el = els[id];
  if (!el) {
    return;
  }
  const down = SPRINGS.sumSteps(0, [{ at, delta: 1, spring: { stiffness: 1400, damping: 75 } }, { at: at + 0.09, delta: -1, spring: { stiffness: 1400, damping: 75 } }], t);
  el.style.transform = 'scale(' + (1 - 0.06 * down) + ')';
};
const NUM = /^([^0-9]*)([0-9][0-9.,]*)(.*)$/;
const countUp = (U, els, id, p) => {
  const node = nodeById(U, id);
  const el = els[id];
  const m = node && NUM.exec(node.text || '');
  if (!el || !m) {
    return;
  }
  const raw = m[2].replace(/,/g, '');
  const digits = (raw.split('.')[1] || '').length;
  const grouped = m[2].includes(',');
  const v = (Number(raw) * p).toFixed(digits);
  el.textContent = m[1] + (grouped ? v.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') : v) + m[3];
};
const ringOn = (els, id, colour, p) => {
  const el = els[id];
  if (!el) {
    return;
  }
  el.style.outline = p > 0 ? (3 * p).toFixed(2) + 'px solid ' + colour : '';
  el.style.outlineOffset = (6 * p).toFixed(2) + 'px';
};
`;

const SPRING_TOKEN = 'SPRING_MATH';

export const vectorRuntime = () => VECTOR_DRAW.replace(SPRING_TOKEN, () => springSource());

const PIECE_JS = `
const U = VECTOR_UI;
const zoom = param('zoom', 1, { type: 'number', min: 0.4, max: 4, step: 0.05, group: 'Layout', label: 'Size' });
const enter = param('enter', 'rise', { type: 'text', enum: ['rise', 'none'], group: 'Motion' });
const typeId = param('type_id', '', { type: 'text', group: 'Motion', label: 'Type into (element id)' });
const typeText = param('type_text', '', { type: 'text', group: 'Motion', label: 'Typed text' });
const typeAt = param('type_at', 0.6, { type: 'number', min: 0, max: 30, group: 'Motion' });
const typeFor = param('type_for', 1.2, { type: 'number', min: 0.1, max: 10, group: 'Motion' });
const pressId = param('press_id', '', { type: 'text', group: 'Motion', label: 'Press (element id)' });
const pressAt = param('press_at', 2, { type: 'number', min: 0, max: 30, group: 'Motion' });
const countId = param('count_id', '', { type: 'text', group: 'Motion', label: 'Count up (element id)' });
const countAt = param('count_at', 0.4, { type: 'number', min: 0, max: 30, group: 'Motion' });
const countFor = param('count_for', 1.4, { type: 'number', min: 0.1, max: 10, group: 'Motion' });
const ringId = param('ring_id', '', { type: 'text', group: 'Motion', label: 'Highlight (element id)' });
const ringAt = param('ring_at', 1, { type: 'number', min: 0, max: 30, group: 'Motion' });
const ringColour = param('ring_colour', '#0099ff', { type: 'color', group: 'Motion' });
const stage = document.createElement('div');
stage.className = 'vstage';
root.appendChild(stage);
const drawn = drawVector(U, stage);
const fit = Math.min(1, ((root.clientWidth || U.width) * SAFE) / U.width, ((root.clientHeight || U.height) * SAFE) / U.height);
stage.style.transform = 'translate(-50%, -50%) scale(' + zoom * fit + ')';
const order = U.nodes.map((n) => ({ id: n.id, at: Math.min(0.6, (n.y / U.height) * 0.5 + (n.x / U.width) * 0.1) }));
const render = (t) => {
  if (enter === 'rise') {
    order.forEach((o) => {
      const p = expoOut(vspan(t, o.at, 0.7));
      const el = drawn.els[o.id];
      el.style.translate = '0 ' + (24 * (1 - p)).toFixed(2) + 'px';
      el.style.filter = p < 1 ? 'blur(' + (8 * (1 - p)).toFixed(2) + 'px)' : '';
      el.style.opacity = String((nodeById(U, o.id).o ?? 1) * p);
    });
  }
  if (typeId) {
    typeInto(U, drawn.els, typeId, typeText, vspan(t, typeAt, typeFor), t);
  }
  if (pressId) {
    pressOn(drawn.els, pressId, t, pressAt);
  }
  if (countId) {
    countUp(U, drawn.els, countId, expoOut(vspan(t, countAt, countFor)));
  }
  if (ringId) {
    ringOn(drawn.els, ringId, ringColour, expoOut(vspan(t, ringAt, 0.5)));
  }
};
render(0);
tl.to({}, { duration, ease: 'none', onUpdate() { render(this.time()); } }, 0);
`;

export const VECTOR_TOKEN = /const U = (\{.*\});\n/;

export const vectorJson = (ui: VectorUi) => JSON.stringify({ ...ui, url: undefined, title: undefined, raster: undefined });

export function vectorPiece(name: string, ui: VectorUi): UiPiece {
  const size: UiSize = { width: ui.width, height: ui.height };
  const head = `const SAFE = ${UI_SAFE};\n${vectorRuntime()}\n`;
  const fitted = withinBudget(ui, MAX_JS - head.length - PIECE_JS.length - JS_MARGIN, (u) => vectorJson(u).length);
  const js = head + PIECE_JS.replace('VECTOR_UI', () => vectorJson(fitted));
  return { name, about: `${ui.title || ui.url} rebuilt as vector UI: ${ui.nodes.length} elements`, size, html: '', css: VECTOR_CSS, js };
}

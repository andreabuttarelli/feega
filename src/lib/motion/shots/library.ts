import { z } from 'zod';
import { vectorJson, vectorRuntime, VECTOR_CSS } from '../vector-ui/piece';
import { withinBudget, type VectorUi } from '../vector-ui/model';
import { MAX_JS } from '../custom/component';
import { CURSOR_SLOT, NODE_ID, cursorSource } from './cursor';

export enum ShotId {
  KineticTitle = 'kinetic-title',
  DeviceFlyIn = 'device-fly-in',
  UiFocus = 'ui-focus',
  FeatureGrid = 'feature-grid',
  StatCount = 'stat-count',
  BeforeAfter = 'before-after',
  LogoResolve = 'logo-resolve',
  UiMorph = 'ui-morph',
  TaglineCard = 'tagline-card',
  WhipZoom = 'whip-zoom'
}

export const SHOT_IDS = Object.values(ShotId) as [ShotId, ...ShotId[]];

export enum ShotUi {
  None = 'none',
  Required = 'required'
}

export enum ShotCursor {
  None = 'none',
  Scripted = 'scripted'
}

export type SlotLimit = { words: number; chars: number };

export type ShotSpec = {
  name: string;
  about: string;
  seconds: { min: number; best: number; max: number };
  ui: ShotUi;
  cursor: ShotCursor;
  peak: boolean;
  slots: z.ZodObject<z.ZodRawShape>;
  limits: Record<string, SlotLimit>;
  css: string;
  js: string;
};

const text = z.string().trim().min(1);
const limit = (words: number, chars: number): SlotLimit => ({ words, chars });
const nodeId = NODE_ID;

const PRELUDE = `
const W = root.clientWidth || 1920;
const H = root.clientHeight || 1080;
const UNIT = Math.min(W, H);
const WIDE = W >= H;
const font = param('font', 'sans', { type: 'font', group: 'Style' });
const ink = param('ink', '#ffffff', { type: 'color', group: 'Style', label: 'Text' });
const paper = param('paper', '#000000', { type: 'color', group: 'Style', label: 'Background' });
const muted = param('muted', '#8b8b8b', { type: 'color', group: 'Style', label: 'Muted text' });
const accent = param('accent', '#0099ff', { type: 'color', group: 'Style' });
root.style.background = paper;
root.style.overflow = 'hidden';
root.style.fontFamily = font;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const span = (t, at, len) => clamp((t - at) / Math.max(0.001, len), 0, 1);
const EXPO = 1 - Math.pow(2, -10);
const out = (p) => (p >= 1 ? 1 : (1 - Math.pow(2, -10 * p)) / EXPO);
const into = (p) => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10));
const move = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2);
const mix = (a, b, p) => a + (b - a) * p;
const el = (tag, css, host, content) => {
  const n = document.createElement(tag);
  n.style.cssText = css || '';
  if (content !== undefined) {
    n.textContent = content;
  }
  (host || root).appendChild(n);
  return n;
};
const TITLE = 'font-weight:600;letter-spacing:-0.05em;line-height:0.95;';
const GLYPH = 0.52;
const MAX_ROWS = WIDE ? 2 : 4;
const CAPTION = UNIT * (WIDE ? 0.04 : 0.056);
const wrapRows = (line, cap) => line.split(/\\s+/).filter(Boolean).reduce((rows, w) => {
  const last = rows[rows.length - 1];
  if (last !== undefined && (last + ' ' + w).length <= cap) {
    rows[rows.length - 1] = last + ' ' + w;
    return rows;
  }
  rows.push(w);
  return rows;
}, []);
const fitRows = (lines, share, most) => {
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const word = Math.max(1, ...lines.flatMap((l) => l.split(/\\s+/)).map((w) => w.length));
  let best = { size: 0, rows: lines };
  for (let cap = longest; cap >= word; cap--) {
    const rows = lines.flatMap((l) => wrapRows(l, cap));
    if (rows.length > Math.max(most, lines.length)) {
      continue;
    }
    const wide = Math.max(...rows.map((r) => r.length));
    const size = Math.min((H * share) / rows.length, (W * 0.86) / (wide * GLYPH));
    if (size > best.size) {
      best = { size, rows };
    }
  }
  return best;
};
const titleSize = (copy, share) => fitRows([String(copy)], share, MAX_ROWS).size;
const drive = (render) => {
  render(0);
  tl.to({}, { duration, ease: 'none', onUpdate() { render(this.time()); } }, 0);
};
`;

const UI_PRELUDE = `
const U = VECTOR_UI;
const boxOf = (id) => {
  const n = nodeById(U, id);
  return n ? { x: n.x, y: n.y, w: Math.max(1, n.w), h: Math.max(1, n.h) } : { x: 0, y: 0, w: U.width, h: U.height };
};
const textInside = (id) => {
  const b = boxOf(id);
  const own = nodeById(U, id);
  if (own && own.kind === 'text') {
    return id;
  }
  const hit = U.nodes.find((n) => n.kind === 'text' && n.x >= b.x - 2 && n.y >= b.y - 2 && n.x + n.w <= b.x + b.w + 2 && n.y + n.h <= b.y + b.h + 2);
  return hit ? hit.id : '';
};
const frameOn = (b, fillW, fillH) => {
  const k = clamp(Math.min((W * fillW) / b.w, (H * fillH) / b.h), 0.3, 7);
  return { k, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
};
const lerpCam = (a, b, p) => ({ k: Math.exp(mix(Math.log(a.k), Math.log(b.k), p)), cx: mix(a.cx, b.cx, p), cy: mix(a.cy, b.cy, p) });
const place = (cam, host) => {
  host.style.transform = 'translate(' + (W / 2 - cam.cx * cam.k).toFixed(2) + 'px,' + (H / 2 - cam.cy * cam.k).toFixed(2) + 'px) scale(' + cam.k.toFixed(4) + ')';
};
const dimAround = (drawn, b, level) => {
  U.nodes.forEach((n) => {
    const inside = n.x >= b.x - 6 && n.y >= b.y - 6 && n.x + n.w <= b.x + b.w + 6 && n.y + n.h <= b.y + b.h + 6;
    const holder = n.x <= b.x && n.y <= b.y && n.x + n.w >= b.x + b.w && n.y + n.h >= b.y + b.h && n.w * n.h <= b.w * b.h * 4;
    drawn.els[n.id].style.opacity = String((n.o ?? 1) * (inside || holder ? 1 : level));
  });
};
const WHOLE = { k: Math.min((W * 0.86) / U.width, (H * 0.8) / U.height), cx: U.width / 2, cy: U.height / 2 };
`;

const CURSOR_LAYER = `
const CURSOR = CURSOR_MATH;
const cursorUi = { width: U.width, height: U.height, box: (id) => {
  const n = nodeById(U, id);
  return n ? { x: n.x, y: n.y, w: Math.max(1, n.w), h: Math.max(1, n.h), role: n.role || 'box' } : null;
} };
const scriptOf = (raw, fallback) => {
  let script = raw;
  if (typeof script === 'string') {
    try {
      script = script.trim() ? JSON.parse(script) : null;
    } catch (e) {
      script = null;
    }
  }
  return Array.isArray(script) && script.length ? script : fallback;
};
const CURSOR_SVG = {
  arrow: { tip: [4, 2.5], svg: '<path d="M4 2.5v17.2l4.6-4.4 2.9 6.6 2.9-1.3-2.9-6.5h6.3z" fill="#000" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>' },
  hand: { tip: [9, 3], svg: '<path d="M9 2.8c-1 0-1.7.8-1.7 1.7v8.6l-1.4-1.5c-.7-.7-1.8-.7-2.4 0-.6.6-.6 1.5-.1 2.2l4.1 5.6c.9 1.3 2.4 2.1 4 2.1h3.6c2.6 0 4.7-2.1 4.7-4.7v-4.6c0-.9-.7-1.6-1.6-1.6-.4 0-.8.2-1.1.4v-.2c0-.9-.7-1.6-1.6-1.6-.5 0-.9.2-1.2.5-.2-.7-.8-1.2-1.6-1.2-.4 0-.8.2-1.1.4V4.5c0-.9-.8-1.7-1.6-1.7z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>' },
  beam: { tip: [12, 12], svg: '<path d="M8.5 3.5h7M8.5 20.5h7M12 3.5v17" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><path d="M8.5 3.5h7M8.5 20.5h7M12 3.5v17" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>' }
};
const CURSOR_SIZE = UNIT * (WIDE ? 0.036 : 0.05);
const FOLLOW = 0.12;
const HOVER = 0.07;
const cursorLayer = (drawn, script) => {
  const plan = CURSOR.plan(script, cursorUi, duration);
  const ripple = el('div', 'position:absolute;left:0;top:0;border-radius:50%;border:' + Math.max(2, UNIT * 0.003) + 'px solid ' + accent + ';');
  const pointer = el('div', 'position:absolute;left:0;top:0;width:' + CURSOR_SIZE + 'px;height:' + CURSOR_SIZE + 'px;transform-origin:0 0;filter:drop-shadow(0 ' + (CURSOR_SIZE * 0.06).toFixed(1) + 'px ' + (CURSOR_SIZE * 0.1).toFixed(1) + 'px rgba(0,0,0,0.35));');
  pointer.setAttribute('data-cursor', 'pointer');
  ripple.setAttribute('data-cursor', 'ripple');
  const shapes = Object.fromEntries(Object.entries(CURSOR_SVG).map(([k, v]) => {
    const holder = el('div', 'position:absolute;inset:0;', pointer);
    holder.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">' + v.svg + '</svg>';
    return [k, holder];
  }));
  const ink = (U.nodes.find((n) => n.role === 'heading' && n.color) || {}).color || '#111111';
  const typing = plan.steps.filter((s) => s.action === 'type').map((s) => ({ target: s.target, text: s.text, into: textInside(s.target) })).filter((s) => s.into);
  typing.forEach((s) => {
    drawn.els[s.into].style.color = ink;
  });
  const pressing = plan.steps.filter((s) => s.action === 'click' || s.action === 'type');
  const touched = [...new Set(plan.steps.map((s) => s.target))].filter((id) => drawn.els[id]);
  const pose = (t) => CURSOR.pose(plan, t);
  const follow = (view, p) => ({ k: view.k, cx: mix(view.cx, p.x, FOLLOW * p.opacity), cy: mix(view.cy, p.y, FOLLOW * p.opacity) + p.scroll });
  const toScreen = (view, x, y) => [W / 2 + (x - view.cx) * view.k, H / 2 + (y - view.cy) * view.k];
  const draw = (p, view, t) => {
    touched.forEach((id) => {
      drawn.els[id].style.filter = id === p.hover && p.lit > 0 ? 'brightness(' + (1 - HOVER * p.lit).toFixed(4) + ')' : '';
    });
    pressing.forEach((s) => pressOn(drawn.els, s.target, t, s.at));
    typing.forEach((s) => {
      const typed = p.typed.find((k) => k.target === s.target && k.text === s.text);
      typeInto(U, drawn.els, s.into, s.text, typed ? typed.p : 0, t);
    });
    const [x, y] = toScreen(view, p.x, p.y);
    const tip = CURSOR_SVG[p.shape].tip;
    const k = 1 - 0.18 * p.press;
    Object.entries(shapes).forEach(([name, holder]) => {
      holder.style.display = name === p.shape ? 'block' : 'none';
    });
    pointer.style.opacity = String(p.opacity);
    pointer.style.transform = 'translate(' + (x - (tip[0] / 24) * CURSOR_SIZE * k).toFixed(2) + 'px,' + (y - (tip[1] / 24) * CURSOR_SIZE * k).toFixed(2) + 'px) scale(' + k.toFixed(4) + ')';
    const [rx, ry] = p.ripple ? toScreen(view, p.ripple.x, p.ripple.y) : [0, 0];
    const r = p.ripple ? UNIT * 0.045 * out(p.ripple.p) : 0;
    ripple.style.display = p.ripple ? 'block' : 'none';
    ripple.style.opacity = p.ripple ? String(0.6 * (1 - p.ripple.p)) : '0';
    ripple.style.width = (2 * r).toFixed(1) + 'px';
    ripple.style.height = (2 * r).toFixed(1) + 'px';
    ripple.style.transform = 'translate(' + (rx - r).toFixed(2) + 'px,' + (ry - r).toFixed(2) + 'px)';
  };
  return { plan, pose, follow, draw };
};
`;

const UI_HOST_CSS = `${VECTOR_CSS}
.cam { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
`;

const KINETIC_TITLE = `
const copy = param('text', 'make your brand move.', { type: 'text', group: 'Content' });
const keyRaw = param('accent_word', '', { type: 'text', group: 'Content', label: 'Accent word (the word or its index)' });
const words = String(copy).split(/\\s+/).filter(Boolean);
const keyWord = /^-?\\d+$/.test(String(keyRaw)) ? Number(keyRaw) : words.indexOf(String(keyRaw));
const fitted = fitRows([words.join(' ')], 0.46, MAX_ROWS);
const box = el('div', 'position:absolute;left:50%;top:50%;width:' + W * 0.92 + 'px;text-align:center;color:' + ink + ';font-size:' + fitted.size + 'px;' + TITLE);
let next = 0;
const spans = fitted.rows.flatMap((row) => {
  const line = el('div', 'white-space:nowrap;', box);
  const inRow = row.split(' ');
  return inRow.map((w, j) => {
    const i = next++;
    return el('span', 'display:inline-block;white-space:pre;transform-origin:50% 60%;' + (i === keyWord ? 'color:' + accent + ';' : ''), line, w + (j < inRow.length - 1 ? ' ' : ''));
  });
});
const STAGGER = 0.09;
drive((t) => {
  const push = 1 + 0.05 * span(t, 0, duration);
  box.style.transform = 'translate(-50%,-50%) scale(' + push.toFixed(4) + ')';
  spans.forEach((s, i) => {
    const p = out(span(t, 0.12 + i * STAGGER, 0.6));
    s.style.opacity = String(clamp(p * 2.5, 0, 1));
    s.style.transform = 'scale(' + mix(1.34, 1, p).toFixed(4) + ')';
    s.style.filter = p < 1 ? 'blur(' + (18 * (1 - p)).toFixed(2) + 'px)' : '';
  });
});
`;

const DEVICE_FLY_IN = `
const BEZEL = Math.round(UNIT * 0.012);
const sw = W * (WIDE ? 0.66 : 0.88);
const s = sw / U.width;
const sh = U.height * s;
const DEPTH = W * 1.3;
const RAD = Math.PI / 180;
const stage = el('div', 'position:absolute;inset:0;');
const floor = el('div', 'position:absolute;left:50%;top:50%;width:' + sw * 0.9 + 'px;height:' + sh * 0.18 + 'px;margin-left:' + -sw * 0.45 + 'px;margin-top:' + sh * 0.52 + 'px;border-radius:50%;background:radial-gradient(closest-side, rgba(0,0,0,0.55), rgba(0,0,0,0));', stage);
const device = el('div', 'position:absolute;left:50%;top:50%;width:' + (sw + 2 * BEZEL) + 'px;height:' + (sh + 2 * BEZEL) + 'px;margin-left:' + -(sw / 2 + BEZEL) + 'px;margin-top:' + -(sh / 2 + BEZEL) + 'px;background:#0c0c0c;box-shadow:0 0 0 1px rgba(255,255,255,0.09) inset, 0 70px 140px rgba(0,0,0,0.45);', stage);
const glass = el('div', 'position:absolute;left:' + BEZEL + 'px;top:' + BEZEL + 'px;width:' + sw + 'px;height:' + sh + 'px;overflow:hidden;', device);
const inner = el('div', 'position:absolute;left:0;top:0;transform-origin:0 0;transform:scale(' + s + ');', glass);
const drawn = drawVector(U, inner);
const sheen = el('div', 'position:absolute;inset:0;background:linear-gradient(115deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 38%);', glass);
const LAND = 1.7;
drive((t) => {
  const p = out(span(t, 0.05, LAND));
  const after = span(t, LAND, Math.max(0.1, duration - LAND));
  const ry = mix(-104, 0, p) + 3 * after;
  const rx = mix(30, 7, p) - 4 * after;
  const z = mix(-W * 0.9, 0, p);
  const y = mix(H * 0.22, 0, p);
  const k = 1 + 0.035 * after;
  const near = DEPTH / (DEPTH - z);
  const turn = Math.max(0.04, Math.abs(Math.cos(ry * RAD)));
  const tilt = Math.cos(rx * RAD);
  device.style.transform = 'translate(0,' + y.toFixed(1) + 'px) scale(' + (near * k * turn).toFixed(4) + ',' + (near * k * tilt).toFixed(4) + ') skewY(' + (-Math.sin(ry * RAD) * 10).toFixed(3) + 'deg) skewX(' + (-rx * 0.3).toFixed(3) + 'deg)';
  device.style.opacity = String(clamp(p * 3, 0, 1));
  floor.style.opacity = String(0.9 * p);
  sheen.style.opacity = String(mix(1, 0.35, p));
});
`;

const UI_FOCUS = `
const fieldId = param('field_id', 'input-0', { type: 'text', group: 'Content', label: 'Field (element id)' });
const typed = param('type_text', '', { type: 'text', group: 'Content', label: 'Typed text' });
const buttonId = param('button_id', 'button-0', { type: 'text', group: 'Content', label: 'Button (element id)' });
const resultId = param('result_id', '', { type: 'text', group: 'Content', label: 'Result (element id, empty = whole UI)' });
const script = param('cursor', '', { type: 'textarea', group: 'Content', label: 'Cursor script (JSON)' });
const cam = el('div', '', root);
cam.className = 'cam';
const sheet = el('div', 'position:absolute;left:0;top:0;width:' + U.width + 'px;height:' + U.height + 'px;background:' + U.background + ';', cam);
const drawn = drawVector(U, cam);
drawn.frame.style.background = 'transparent';
drawn.frame.style.position = 'absolute';
drawn.frame.style.left = '0px';
drawn.frame.style.top = '0px';
const pointer = cursorLayer(drawn, scriptOf(script, CURSOR.auto([{ id: fieldId, text: typed }, { id: buttonId }].concat(resultId ? [{ id: resultId }] : []), cursorUi)));
const steps = pointer.plan.steps;
const around = (b) => {
  const mx = b.w > 300 ? b.w * 0.12 : Math.max(b.w * 0.5, 120);
  const my = Math.max(b.h, 80);
  return frameOn({ x: b.x - mx, y: b.y - my, w: b.w + 2 * mx, h: b.h + 2 * my }, 0.8, 0.6);
};
const beats = steps.map((s) => ({ view: around(boxOf(s.target)), from: Math.max(0, s.travel - 0.15), len: Math.max(0.75, s.at - s.travel + 0.15) }));
const first = beats.length ? beats[0].view : WHOLE;
const last = steps.length ? Math.max(steps[steps.length - 1].end, steps[steps.length - 1].at + 0.5) + 0.3 : 0;
const DIM = { depth: 0.55, at: 0.3, len: 0.3, release: 0.4 };
const released = steps.length > 1 ? steps[1].travel - 0.2 : duration;
drive((t) => {
  const arrive = out(span(t, 0, 0.7));
  let view = { k: first.k * mix(0.82, 1, arrive), cx: first.cx, cy: first.cy };
  beats.slice(1).forEach((b) => {
    view = lerpCam(view, b.view, move(span(t, b.from, b.len)));
  });
  if (!resultId) {
    view = lerpCam(view, WHOLE, move(span(t, last, Math.max(0.4, duration - last))));
  }
  const p = pointer.pose(t);
  view = pointer.follow(view, p);
  place(view, cam);
  const dim = out(span(t, DIM.at, DIM.len)) * (1 - move(span(t, released, DIM.release)));
  dimAround(drawn, boxOf(steps.length ? steps[0].target : fieldId), 1 - DIM.depth * dim);
  pointer.draw(p, view, t);
});
`;

const FEATURE_GRID = `
const items = String(param('items', 'Launch films|Product demos|Social ads|Brand kits|Live UI|Agents', { type: 'text', group: 'Content', label: 'Features (a|b|c)' })).split('|').map((s) => s.trim()).filter(Boolean).slice(0, 6);
const cols = WIDE ? Math.min(3, items.length) : 2;
const rows = Math.ceil(items.length / cols);
const GAP = UNIT * 0.018;
const tw = Math.min((W * 0.84 - GAP * (cols - 1)) / cols, UNIT * 0.62);
const th = tw * 0.62;
const DEPTH = W * 1.2;
const stage = el('div', 'position:absolute;inset:0;');
const grid = el('div', 'position:absolute;left:50%;top:50%;width:' + (cols * tw + (cols - 1) * GAP) + 'px;height:' + (rows * th + (rows - 1) * GAP) + 'px;', stage);
const SCATTER = [[-1.3, -0.9, -900, 55, -35], [0.2, -1.4, -1300, -40, 25], [1.4, -0.6, -700, 30, 50], [-1.5, 0.9, -1100, -50, -30], [0.1, 1.5, -800, 45, 40], [1.3, 1.0, -1200, -35, -45]];
const tiles = items.map((label, i) => {
  const c = i % cols;
  const r = Math.floor(i / cols);
  const tile = el('div', 'position:absolute;left:' + c * (tw + GAP) + 'px;top:' + r * (th + GAP) + 'px;width:' + tw + 'px;height:' + th + 'px;background:rgba(255,255,255,0.06);box-shadow:0 0 0 1px rgba(255,255,255,0.08) inset;color:' + ink + ';', grid);
  el('div', 'position:absolute;left:' + tw * 0.08 + 'px;top:' + th * 0.12 + 'px;width:' + UNIT * 0.012 + 'px;height:' + UNIT * 0.012 + 'px;border-radius:50%;background:' + accent + ';', tile);
  el('div', 'position:absolute;left:' + tw * 0.08 + 'px;bottom:' + th * 0.12 + 'px;right:' + tw * 0.08 + 'px;font-size:' + tw * (WIDE ? 0.085 : 0.11) + 'px;' + TITLE, tile, label);
  return tile;
});
drive((t) => {
  const settleAll = span(t, 1.6, Math.max(0.1, duration - 1.6));
  grid.style.transform = 'translate(-50%,-50%) scale(' + (1 + 0.04 * settleAll).toFixed(4) + ')';
  tiles.forEach((tile, i) => {
    const [sx, sy, sz, rx, ry] = SCATTER[i % SCATTER.length];
    const p = out(span(t, 0.1 + i * 0.08, 1.15));
    tile.style.transform = p >= 1 ? 'none' : 'translate(' + (sx * tw * (1 - p)).toFixed(1) + 'px,' + (sy * th * (1 - p)).toFixed(1) + 'px) scale(' + (DEPTH / (DEPTH - sz * (1 - p))).toFixed(4) + ') rotate(' + ((rx + ry) * 0.2 * (1 - p)).toFixed(2) + 'deg)';
    tile.style.opacity = String(clamp(p * 2, 0, 1));
  });
});
`;

const STAT_COUNT = `
const value = String(param('value', '12,400', { type: 'text', group: 'Content' }));
const label = param('label', 'videos made this month', { type: 'text', group: 'Content' });
const m = /^([^0-9]*)([0-9][0-9.,]*)(.*)$/.exec(value) || ['', '', '0', value];
const raw = m[2].replace(/,/g, '');
const digits = (raw.split('.')[1] || '').length;
const grouped = m[2].includes(',');
const size = titleSize(value, 0.42);
const num = el('div', 'position:absolute;left:0;right:0;top:' + (H * 0.5 - size * 0.62) + 'px;text-align:center;color:' + ink + ';font-size:' + size + 'px;font-variant-numeric:tabular-nums;' + TITLE);
const rule = el('div', 'position:absolute;left:50%;top:' + (H * 0.5 + size * 0.42) + 'px;height:' + Math.max(2, UNIT * 0.004) + 'px;background:' + accent + ';');
const cap = el('div', 'position:absolute;left:0;right:0;top:' + (H * 0.5 + size * 0.42 + UNIT * 0.04) + 'px;text-align:center;color:' + muted + ';font-size:' + CAPTION + 'px;font-weight:500;letter-spacing:-0.02em;', root, label);
const ruleW = Math.min(W * 0.5, size * 2.2);
const show = (n) => {
  const v = n.toFixed(digits);
  return m[1] + (grouped ? v.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') : v) + m[3];
};
const ghost = el('span', 'visibility:hidden;', num);
const digitsShown = el('span', '', num);
const FINAL = show(Number(raw));
const COUNT_MIN_STEPS = 20;
const counts = Number(raw) * Math.pow(10, digits) >= COUNT_MIN_STEPS;
drive((t) => {
  const p = counts ? 1 - Math.pow(1 - span(t, 0.2, 1.7), 3) : 1;
  const shown = show(Number(raw) * p);
  ghost.textContent = FINAL.slice(0, Math.max(0, FINAL.length - shown.length));
  digitsShown.textContent = shown;
  const enter = out(span(t, 0.05, 0.7));
  num.style.opacity = String(enter);
  num.style.transform = 'scale(' + (mix(1.18, 1, enter) + 0.03 * span(t, 1.8, duration)).toFixed(4) + ')';
  num.style.filter = enter < 1 ? 'blur(' + (14 * (1 - enter)).toFixed(2) + 'px)' : '';
  const r = out(span(t, 0.5, 1.1));
  rule.style.width = (ruleW * r).toFixed(1) + 'px';
  rule.style.marginLeft = (-ruleW * r / 2).toFixed(1) + 'px';
  const c = out(span(t, 0.8, 0.7));
  cap.style.opacity = String(c);
  cap.style.transform = 'translateY(' + (UNIT * 0.02 * (1 - c)).toFixed(1) + 'px)';
});
`;

const BEFORE_AFTER = `
const pain = param('before_text', 'three weeks in a timeline', { type: 'text', group: 'Content', label: 'Before' });
const beforeLabel = param('before_label', 'before', { type: 'text', group: 'Content' });
const afterLabel = param('after_label', 'after', { type: 'text', group: 'Content' });
const SPLIT = WIDE ? 0.38 : 0.36;
const LONG = WIDE ? W : H;
const fitted = fitRows([String(pain)], 0.34, MAX_ROWS);
const painSize = fitted.size;
const left = el('div', 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;');
const painBox = el('div', 'position:absolute;left:' + W * 0.06 + 'px;right:' + W * 0.06 + 'px;top:50%;text-align:center;white-space:pre-line;color:' + muted + ';font-size:' + painSize + 'px;' + TITLE, left, fitted.rows.join('\\n'));
const strike = el('div', 'position:absolute;left:50%;top:50%;height:' + Math.max(2, UNIT * 0.005) + 'px;background:' + muted + ';', left);
const right = el('div', 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;overflow:hidden;');
const cam = el('div', '', right);
cam.className = 'cam';
drawVector(U, cam);
const RULE = Math.max(2, UNIT * 0.003);
const divider = el('div', 'position:absolute;background:' + accent + ';' + (WIDE ? 'top:0;bottom:0;width:' + RULE + 'px;' : 'left:0;right:0;height:' + RULE + 'px;'));
const tag = (copy) => el('div', 'position:absolute;top:' + H * (WIDE ? 0.06 : 0.04) + 'px;left:' + W * (WIDE ? 0.05 : 0.06) + 'px;font-size:' + CAPTION * 0.65 + 'px;font-weight:500;letter-spacing:0.02em;text-transform:lowercase;color:' + muted + ';', root, copy);
const tagL = tag(beforeLabel);
const tagR = tag(afterLabel);
const room = WIDE ? { w: W * (1 - SPLIT), h: H } : { w: W, h: H * (1 - SPLIT) };
const view = { k: Math.min((room.w * 0.92) / U.width, (room.h * 0.8) / U.height), cx: U.width / 2, cy: U.height / 2 };
const painExtent = WIDE ? Math.max(...fitted.rows.map((r) => r.length)) * GLYPH * painSize : fitted.rows.length * 0.95 * painSize;
const painRoom = LONG * SPLIT * 0.84;
const offset = (LONG * SPLIT + (LONG * (1 - SPLIT)) / 2 - LONG / 2) / view.k;
drive((t) => {
  const e = out(span(t, 0, 0.6));
  painBox.style.opacity = String(e);
  const st = out(span(t, 0.5, 0.5));
  strike.style.width = (W * 0.5 * st).toFixed(1) + 'px';
  strike.style.marginLeft = (-W * 0.25 * st).toFixed(1) + 'px';
  const wipe = move(span(t, 1.15, 0.9));
  const edge = mix(LONG, LONG * SPLIT, wipe);
  divider.style[WIDE ? 'left' : 'top'] = edge.toFixed(1) + 'px';
  divider.style.opacity = String(wipe > 0 && wipe < 1 ? 1 : wipe >= 1 ? 0.6 : 0);
  right.style.clipPath = WIDE ? 'inset(0 0 0 ' + edge.toFixed(1) + 'px)' : 'inset(' + edge.toFixed(1) + 'px 0 0 0)';
  const shrink = mix(1, Math.min(1, painRoom / painExtent), wipe);
  painBox.style.transform = 'translateY(-50%) scale(' + (mix(1.1, 1, e) * shrink).toFixed(4) + ')';
  strike.style.transform = 'scaleX(' + shrink.toFixed(4) + ')';
  const slide = mix(0, (LONG * SPLIT) / 2 - LONG / 2, wipe).toFixed(1);
  left.style.transform = WIDE ? 'translateX(' + slide + 'px)' : 'translateY(' + slide + 'px)';
  const k = view.k * mix(1.08, 1, wipe) * (1 + 0.03 * span(t, 2.1, duration));
  place({ k, cx: view.cx - (WIDE ? offset : 0), cy: view.cy - (WIDE ? 0 : offset) }, cam);
  tagL.style.opacity = String(e);
  tagR.style[WIDE ? 'left' : 'top'] = (edge + LONG * 0.03).toFixed(1) + 'px';
  tagR.style.opacity = String(wipe);
});
`;

const LOGO_RESOLVE = `
const logo = param('logo', '', { type: 'asset', group: 'Content' });
const wordmark = param('wordmark', 'feega', { type: 'text', group: 'Content', label: 'Wordmark (when no logo)' });
const url = param('url', '', { type: 'text', group: 'Content' });
const mark = el('div', 'position:absolute;left:50%;top:50%;display:flex;align-items:center;justify-content:center;');
if (logo) {
  const img = document.createElement('img');
  img.setAttribute('src', logo);
  img.style.cssText = 'display:block;max-width:' + W * 0.46 + 'px;max-height:' + H * 0.22 + 'px;';
  mark.appendChild(img);
} else {
  el('div', 'color:' + ink + ';font-size:' + titleSize(String(wordmark), 0.26) + 'px;' + TITLE, mark, wordmark);
}
const address = el('div', 'position:absolute;left:0;right:0;top:' + H * 0.68 + 'px;text-align:center;color:' + muted + ';font-size:' + CAPTION + 'px;font-weight:500;letter-spacing:-0.02em;', root, url);
drive((t) => {
  const p = out(span(t, 0.1, 1.1));
  mark.style.opacity = String(p);
  mark.style.transform = 'translate(-50%,-50%) scale(' + (mix(0.9, 1, p) + 0.025 * span(t, 1.2, duration)).toFixed(4) + ')';
  const a = out(span(t, 0.9, 0.7));
  address.style.opacity = String(a);
  address.style.transform = 'translateY(' + (UNIT * 0.015 * (1 - a)).toFixed(1) + 'px)';
});
`;

const UI_MORPH = `
const fromId = param('from_id', 'button-0', { type: 'text', group: 'Content', label: 'From (element id)' });
const toId = param('to_id', 'button-1', { type: 'text', group: 'Content', label: 'To (element id)' });
const toText = param('to_text', '', { type: 'text', group: 'Content', label: 'New text on the target' });
const script = param('cursor', '', { type: 'textarea', group: 'Content', label: 'Cursor script (JSON)' });
const cam = el('div', '', root);
cam.className = 'cam';
const drawn = drawVector(U, cam);
const a = boxOf(fromId);
const b = boxOf(toId);
const ring = el('div', 'position:absolute;left:0;top:0;transform-origin:0 0;box-shadow:0 0 0 2px ' + accent + ', 0 0 0 10px rgba(0,153,255,0.14);', cam);
const target = textInside(toId);
const camA = frameOn({ x: a.x - a.w * 0.6, y: a.y - a.h * 1.2, w: a.w * 2.2, h: a.h * 3.4 }, 0.8, 0.7);
const camB = frameOn({ x: b.x - b.w * 0.6, y: b.y - b.h * 1.2, w: b.w * 2.2, h: b.h * 3.4 }, 0.8, 0.7);
const full = target ? nodeById(U, target).text : '';
const pointer = cursorLayer(drawn, scriptOf(script, [{ target: fromId, action: 'hover' }].concat(CURSOR.auto([{ id: toId }], cursorUi))));
const onTo = pointer.plan.steps.find((s) => s.target === toId);
const M = onTo ? { move: onTo.travel, len: Math.max(0.3, onTo.at - onTo.travel), swap: onTo.at + 0.05 } : { move: 0.9, len: 0.9, swap: 1.95 };
drive((t) => {
  const e = out(span(t, 0, 0.7));
  const p = move(span(t, M.move, M.len));
  const c = pointer.pose(t);
  const view = pointer.follow(lerpCam({ k: camA.k * mix(0.85, 1, e), cx: camA.cx, cy: camA.cy }, camB, p), c);
  place(view, cam);
  const PAD = 8;
  ring.style.left = (mix(a.x, b.x, p) - PAD).toFixed(1) + 'px';
  ring.style.top = (mix(a.y, b.y, p) - PAD).toFixed(1) + 'px';
  ring.style.width = (mix(a.w, b.w, p) + 2 * PAD).toFixed(1) + 'px';
  ring.style.height = (mix(a.h, b.h, p) + 2 * PAD).toFixed(1) + 'px';
  ring.style.opacity = String(out(span(t, 0.25, 0.4)));
  dimAround(drawn, { x: Math.min(a.x, b.x) - 40, y: Math.min(a.y, b.y) - 40, w: Math.abs(b.x - a.x) + Math.max(a.w, b.w) + 80, h: Math.abs(b.y - a.y) + Math.max(a.h, b.h) + 80 }, 0.22);
  if (target && toText) {
    const s = span(t, M.swap, 0.45);
    const node = drawn.els[target];
    node.textContent = s < 0.5 ? full : toText;
    node.style.filter = s > 0 && s < 1 ? 'blur(' + (8 * (1 - Math.abs(s * 2 - 1))).toFixed(2) + 'px)' : '';
  }
  pointer.draw(c, view, t);
});
`;

const TAGLINE_CARD = `
const lines = String(param('lines', 'make your brand|move.', { type: 'text', group: 'Content', label: 'Lines (a|b)' })).split('|').map((s) => s.trim()).filter(Boolean).slice(0, 3);
const url = param('url', 'feega.app', { type: 'text', group: 'Content' });
const keyLine = param('accent_line', -1, { type: 'number', min: -1, max: 2, group: 'Content' });
const fitted = lines.map((l) => fitRows([l], 0.5 / lines.length, Math.max(1, Math.floor(MAX_ROWS * 1.5 / lines.length))));
const size = Math.min(...fitted.map((f) => f.size));
const block = el('div', 'position:absolute;left:0;right:0;top:50%;text-align:center;color:' + ink + ';font-size:' + size + 'px;' + TITLE);
const rows = fitted.flatMap((f, i) => f.rows.map((l) => {
  const mask = el('div', 'overflow:hidden;padding-bottom:0.08em;white-space:nowrap;', block);
  return el('div', i === keyLine ? 'color:' + accent + ';' : '', mask, l);
}));
const address = el('div', 'position:absolute;left:0;right:0;bottom:' + H * 0.1 + 'px;text-align:center;color:' + muted + ';font-size:' + CAPTION + 'px;font-weight:500;letter-spacing:-0.02em;', root, url);
drive((t) => {
  block.style.transform = 'translateY(-50%) scale(' + (1 + 0.04 * span(t, 0, duration)).toFixed(4) + ')';
  rows.forEach((r, i) => {
    const p = out(span(t, 0.1 + i * 0.14, 0.85));
    r.style.transform = 'translateY(' + (110 * (1 - p)).toFixed(2) + '%)';
  });
  const a = out(span(t, 0.9, 0.7));
  address.style.opacity = String(a);
});
`;

const WHIP_ZOOM = `
const targetId = param('target_id', 'button-0', { type: 'text', group: 'Content', label: 'Zoom into (element id)' });
const into_ = param('end_colour', '', { type: 'color', group: 'Style', label: 'Colour it lands on (empty = the element)' });
const cam = el('div', '', root);
cam.className = 'cam';
drawVector(U, cam);
const b = boxOf(targetId);
const flood = el('div', 'position:absolute;inset:0;background:' + (into_ || accent) + ';');
const deep = { k: frameOn(b, 1, 1).k * 9, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
drive((t) => {
  const p = into(span(t, 0.15, duration * 0.8));
  place(lerpCam(WHOLE, deep, p), cam);
  cam.style.filter = p > 0.05 ? 'blur(' + (26 * p * p).toFixed(2) + 'px)' : '';
  flood.style.opacity = String(move(span(t, duration * 0.45, duration * 0.5)));
});
`;

export const SHOTS: Record<ShotId, ShotSpec> = {
  [ShotId.KineticTitle]: { name: 'ShotKineticTitle', about: 'a full-frame title: words punch in one by one from 134% and an 18 px blur, then hold on a slow push-in', seconds: { min: 2, best: 2.5, max: 4 }, ui: ShotUi.None, cursor: ShotCursor.None, peak: false, slots: z.object({ text, accent_word: z.union([z.number().int().min(-1).max(12), text.max(24)]).optional() }), limits: { text: limit(6, 36) }, css: '', js: KINETIC_TITLE },
  [ShotId.DeviceFlyIn]: { name: 'ShotDeviceFlyIn', about: 'the recreated product UI on a screen flies in from deep space turning 104°, lands and drifts: the establishing shot of the product', seconds: { min: 2.5, best: 3.5, max: 4 }, ui: ShotUi.Required, cursor: ShotCursor.None, peak: true, slots: z.object({}), limits: {}, css: UI_HOST_CSS, js: DEVICE_FLY_IN },
  [ShotId.UiFocus]: { name: 'ShotUiFocus', about: 'one flow of the recreated UI, one part at a time, driven by a cursor: it clicks the field and types, moves to the button and presses it while the camera follows, then pulls back to the result', seconds: { min: 3, best: 4, max: 4 }, ui: ShotUi.Required, cursor: ShotCursor.Scripted, peak: false, slots: z.object({ field_id: nodeId, button_id: nodeId, type_text: text.optional(), result_id: nodeId.optional(), cursor: CURSOR_SLOT.optional() }), limits: { type_text: limit(8, 48) }, css: UI_HOST_CSS, js: UI_FOCUS },
  [ShotId.FeatureGrid]: { name: 'ShotFeatureGrid', about: 'up to six feature tiles fly in exploded in depth and assemble into a grid', seconds: { min: 2.5, best: 3, max: 4 }, ui: ShotUi.None, cursor: ShotCursor.None, peak: true, slots: z.object({ items: text }), limits: { items: limit(12, 96) }, css: '', js: FEATURE_GRID },
  [ShotId.StatCount]: { name: 'ShotStatCount', about: 'one number counts up huge, an accent rule draws under it, the label rises', seconds: { min: 2.5, best: 3, max: 4 }, ui: ShotUi.None, cursor: ShotCursor.None, peak: false, slots: z.object({ value: text, label: text }), limits: { value: limit(1, 12), label: limit(5, 32) }, css: '', js: STAT_COUNT },
  [ShotId.BeforeAfter]: { name: 'ShotBeforeAfter', about: 'the pain line is struck through, then an accent divider wipes the recreated UI in beside it (under it in vertical)', seconds: { min: 3, best: 3.5, max: 4 }, ui: ShotUi.Required, cursor: ShotCursor.None, peak: false, slots: z.object({ before_text: text, before_label: text.optional(), after_label: text.optional() }), limits: { before_text: limit(6, 36), before_label: limit(2, 16), after_label: limit(2, 16) }, css: UI_HOST_CSS, js: BEFORE_AFTER },
  [ShotId.LogoResolve]: { name: 'ShotLogoResolve', about: 'the original logo, flat and untouched, resolves with a fade and a small scale; the address follows', seconds: { min: 2, best: 2.5, max: 4 }, ui: ShotUi.None, cursor: ShotCursor.None, peak: false, slots: z.object({ logo: z.string().min(1).optional(), wordmark: text.optional(), url: text.optional() }), limits: { wordmark: limit(2, 24), url: limit(1, 40) }, css: '', js: LOGO_RESOLVE },
  [ShotId.UiMorph]: { name: 'ShotUiMorph', about: 'the cursor rests on one element of the recreated UI, travels to another with a highlight as the camera follows, clicks it and the target changes state', seconds: { min: 2.5, best: 3, max: 4 }, ui: ShotUi.Required, cursor: ShotCursor.Scripted, peak: false, slots: z.object({ from_id: nodeId, to_id: nodeId, to_text: text.optional(), cursor: CURSOR_SLOT.optional() }), limits: { to_text: limit(3, 24) }, css: UI_HOST_CSS, js: UI_MORPH },
  [ShotId.TaglineCard]: { name: 'ShotTaglineCard', about: 'the end card: the promise rises line by line out of a mask, the address fades in under it', seconds: { min: 2.5, best: 3, max: 4 }, ui: ShotUi.None, cursor: ShotCursor.None, peak: false, slots: z.object({ lines: text, url: text.optional(), accent_line: z.number().int().min(-1).max(2).optional() }), limits: { lines: limit(6, 40), url: limit(1, 40) }, css: '', js: TAGLINE_CARD },
  [ShotId.WhipZoom]: { name: 'ShotWhipZoom', about: 'a transition: the camera dives into one element of the recreated UI, blurring with speed, and lands on its colour for the next shot', seconds: { min: 1, best: 1.4, max: 2 }, ui: ShotUi.Required, cursor: ShotCursor.None, peak: true, slots: z.object({ target_id: nodeId, end_colour: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }), limits: {}, css: UI_HOST_CSS, js: WHIP_ZOOM }
};

export const PEAK_SHOTS: ReadonlySet<string> = new Set(Object.values(SHOTS).filter((s) => s.peak).map((s) => s.name));

export const SHOT_NAMES: ReadonlySet<string> = new Set(Object.values(SHOTS).map((s) => s.name));

export type ShotSource = { html: string; css: string; js: string };

const JS_MARGIN = 200;

export function shotSource(id: ShotId, ui: VectorUi | null): ShotSource {
  const spec = SHOTS[id];
  if (spec.ui !== ShotUi.Required || !ui) {
    return { html: '', css: spec.css, js: `${PRELUDE}\n${spec.js}` };
  }
  const cursor = spec.cursor === ShotCursor.Scripted ? CURSOR_LAYER.replace('CURSOR_MATH', () => cursorSource()) : '';
  const fixed = PRELUDE.length + vectorRuntime().length + UI_PRELUDE.length + cursor.length + spec.js.length + JS_MARGIN;
  const fitted = withinBudget(ui, MAX_JS - fixed, (u) => vectorJson(u).length);
  return { html: '', css: spec.css, js: `${PRELUDE}\n${vectorRuntime()}\n${UI_PRELUDE.replace('VECTOR_UI', () => vectorJson(fitted))}\n${cursor}\n${spec.js}` };
}

export const SHOT_PREVIEWS = '/motion/shots';

export const shotPreview = (id: ShotId) => `${SHOT_PREVIEWS}/${id}.jpg`;

const SHOT_BY_NAME = new Map(Object.values(SHOTS).map((s) => [s.name, s]));

export function shotWords(name: string, props: Record<string, unknown>): string | null {
  const spec = [...SHOT_BY_NAME.entries()].find(([n]) => name.startsWith(n))?.[1];
  if (!spec) {
    return null;
  }
  return Object.keys(spec.limits).filter((k) => typeof props[k] === 'string').map((k) => String(props[k]).replace(/\|/g, ' ')).join(' ');
}

const wordsOf = (copy: string) => copy.split(/[\s|]+/).filter(Boolean);

function cut(copy: string, room: SlotLimit): string {
  const words = wordsOf(copy).slice(0, room.words);
  while (words.length > 1 && words.join(' ').length > room.chars) {
    words.pop();
  }
  return words.join(' ');
}

export function overLimits(id: ShotId, slots: Record<string, unknown>): string | null {
  const over = Object.entries(SHOTS[id].limits).flatMap(([slot, room]) => {
    const copy = slots[slot];
    if (typeof copy !== 'string') {
      return [];
    }
    const words = wordsOf(copy).length;
    if (words <= room.words && copy.length <= room.chars) {
      return [];
    }
    return [`${slot} "${copy}" is ${words} words, ${copy.length} characters: at most ${room.words} words and ${room.chars} characters stay readable on screen; cut to "${cut(copy, room)}" or similar`];
  });
  return over.length ? `${id}: ${over.join('; ')}` : null;
}

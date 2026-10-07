import { DEFAULT_REEL } from './reel';
import { reelSource } from './seam';

export const REEL_COMPONENT = 'UiMorphReel';
export const REEL_FONT = 'Geist';

const CSS = `
:scope { position: absolute; inset: 0; overflow: hidden; }
.um-world { position: absolute; left: 50%; top: 50%; transform-origin: 0 0; }
.um-centre { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
.um-shape { position: absolute; left: 0; top: 0; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 24px 48px -20px rgba(0,0,0,0.22); }
.um-layer { position: absolute; left: 50%; top: 50%; }
.um-host { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
.um-host > * { position: absolute; }
.um-knob { position: absolute; }
.um-label { white-space: nowrap; line-height: 1; letter-spacing: -0.01em; }
.um-cursor { position: absolute; left: 0; top: 0; width: 34px; height: 34px; transform-origin: 4px 3px; }
svg { overflow: visible; }
`;

const JS = `
const statesText = param('states', '${DEFAULT_REEL.join(',')}', { type: 'text', group: 'Content', label: 'States in order' });
const bpm = param('bpm', 120, { type: 'number', min: 60, max: 200, step: 0.1, group: 'Motion', label: 'Tempo (BPM)' });
const pace = param('pace', 2, { type: 'number', min: 1, max: 8, step: 1, group: 'Motion', label: 'Beats per change' });
const offset = param('offset', 0, { type: 'number', min: 0, max: 4, step: 0.001, group: 'Motion', label: 'First beat (s)' });
const font = param('font', 'Geist', { type: 'font', group: 'Style' });
const ink = param('ink', '#0a0a0a', { type: 'color', group: 'Style', label: 'Ink' });
const paper = param('paper', '#ffffff', { type: 'color', group: 'Style', label: 'Paper' });
const accent = param('accent', '#ff5a1f', { type: 'color', group: 'Style' });
const mute = param('line', '#c9c3b9', { type: 'color', group: 'Style', label: 'Borders and resting surfaces' });
const canvas = param('canvas', '#efece7', { type: 'color', group: 'Style', label: 'Background' });
const buttonText = param('button', 'Export report', { type: 'text', group: 'Content' });
const toastText = param('toast', 'Report exported', { type: 'text', group: 'Content' });
const track = param('track', 'Midnight Drive', { type: 'text', group: 'Content' });
const artist = param('artist', 'Feega Radio', { type: 'text', group: 'Content' });
const reel = ${'${REEL}'};
const side = param('frame', 1080, { type: 'number', min: 16, max: 1920, group: 'Layout', label: 'Frame side (px)' });
const states = String(statesText).split(',').map((s) => s.trim()).filter(Boolean);
const plan = reel.plan({ states, bpm, offset, frame: side, palette: { ink, paper, accent, mute }, beatsPerStep: pace });
const SVG = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hex = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16));
const rgb = (c, a) => 'rgba(' + c.map((v) => Math.round(clamp(v, 0, 255))).join(',') + ',' + (a === undefined ? 1 : a) + ')';
const mix = (a, b, p) => a.map((v, i) => v + (b[i] - v) * p);
const INK = hex(ink);
const PAPER = hex(paper);
const ACCENT = hex(accent);
const MUTE = hex(mute);
const make = (tag, cls, host, text) => {
  const n = document.createElement(tag);
  if (cls) {
    n.className = cls;
  }
  if (text !== undefined) {
    n.textContent = text;
  }
  host.appendChild(n);
  return n;
};
const svg = (tag, attrs, host) => {
  const n = document.createElementNS(SVG, tag);
  for (const k in attrs) {
    n.setAttribute(k, String(attrs[k]));
  }
  host.appendChild(n);
  return n;
};
const at = (el, x, y, anchor) => {
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.transform = anchor === 'left' ? 'translate(0, -50%)' : anchor === 'right' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)';
  return el;
};
const text = (host, value, size, weight, colour) => {
  const n = make('div', 'um-label', host, value);
  n.style.fontSize = size + 'px';
  n.style.fontWeight = String(weight);
  n.style.color = rgb(colour);
  return n;
};
const drawn = (path, p) => {
  path.setAttribute('pathLength', '1');
  path.setAttribute('stroke-dasharray', '1 1');
  path.setAttribute('stroke-dashoffset', String(1 - clamp(p, 0, 1)));
};

root.style.background = canvas;
root.style.fontFamily = String(font) + ', Inter, system-ui, sans-serif';
const world = make('div', 'um-world', root);
const shape = make('div', 'um-shape', world);
const knob = make('div', 'um-knob', shape);

const BUILD = {
  button: (layer) => {
    const label = at(text(layer, buttonText, 30, 500, PAPER), -14, 0);
    const arrow = svg('svg', { width: 22, height: 22, viewBox: '-11 -11 22 22' }, layer);
    at(arrow, 108, 1);
    const head = svg('path', { d: 'M-6 0 L6 0 M1 -5 L6 0 L1 5', fill: 'none', stroke: paper, 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, arrow);
    return (v) => {
      label.style.transform = 'translate(calc(-50% - ' + 4 * v.hover + 'px), -50%)';
      head.setAttribute('transform', 'translate(' + 4 * v.hover + ' 0)');
    };
  },
  loader: (layer) => {
    const ring = at(svg('svg', { width: 60, height: 60, viewBox: '-30 -30 60 60' }, layer), 0, 0);
    svg('circle', { r: 21, fill: 'none', stroke: rgb(PAPER, 0.18), 'stroke-width': 6 }, ring);
    const arc = svg('circle', { r: 21, fill: 'none', stroke: paper, 'stroke-width': 6, 'stroke-linecap': 'round', pathLength: 1 }, ring);
    return (v) => {
      arc.setAttribute('stroke-dasharray', clamp(v.arc, 0.02, 0.98) + ' 1');
      arc.setAttribute('transform', 'rotate(' + (v.t * 400 - 90) + ')');
    };
  },
  check: (layer) => {
    const mark = at(svg('svg', { width: 60, height: 60, viewBox: '-30 -30 60 60' }, layer), 0, 0);
    const tick = svg('path', { d: 'M-15 1 L-5 11 L16 -11', fill: 'none', stroke: paper, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mark);
    return (v) => drawn(tick, v.tick);
  },
  island: (layer) => {
    const art = make('div', '', layer);
    art.style.width = '40px';
    art.style.height = '40px';
    art.style.borderRadius = '12px';
    art.style.background = accent;
    at(art, -136, 0);
    at(text(layer, 'Now playing', 24, 500, PAPER), -104, 0, 'left');
    const bars = [0, 1, 2, 3].map((i) => {
      const bar = make('div', '', layer);
      bar.style.width = '5px';
      bar.style.borderRadius = '3px';
      bar.style.background = paper;
      at(bar, 108 + i * 10, 0);
      return bar;
    });
    return (v) => bars.forEach((bar, i) => (bar.style.height = 8 + 16 * (0.5 + 0.5 * Math.sin(v.t * 9 + i * 1.7)) + 'px'));
  },
  player: (layer) => {
    const art = make('div', '', layer);
    art.style.width = '112px';
    art.style.height = '112px';
    art.style.borderRadius = '22px';
    art.style.background = accent;
    at(art, -226, -36);
    at(text(layer, track, 30, 600, PAPER), -154, -56, 'left');
    at(text(layer, artist, 22, 400, mix(PAPER, INK, 0.45)), -154, -18, 'left');
    const button = make('div', '', layer);
    button.style.width = '76px';
    button.style.height = '76px';
    button.style.borderRadius = '38px';
    button.style.background = paper;
    at(button, 150, -40);
    const icon = svg('svg', { width: 40, height: 40, viewBox: '-20 -20 40 40' }, button);
    icon.style.position = 'absolute';
    icon.style.left = '18px';
    icon.style.top = '18px';
    const left = svg('path', { fill: ink }, icon);
    const right = svg('path', { fill: ink }, icon);
    const PLAY_L = [[-9, -15], [3, -8.2], [3, 8.2], [-9, 15]];
    const PLAY_R = [[3, -8.2], [15, 0], [15, 0], [3, 8.2]];
    const PAUSE_L = [[-12, -14], [-3, -14], [-3, 14], [-12, 14]];
    const PAUSE_R = [[3, -14], [12, -14], [12, 14], [3, 14]];
    const poly = (a, b, p) => 'M' + a.map((pt, i) => (pt[0] + (b[i][0] - pt[0]) * p).toFixed(2) + ' ' + (pt[1] + (b[i][1] - pt[1]) * p).toFixed(2)).join(' L') + ' Z';
    const speaker = at(svg('svg', { width: 36, height: 36, viewBox: '-18 -18 36 36' }, layer), 244, -40);
    svg('path', { d: 'M-12 -5 L-6 -5 L1 -11 L1 11 L-6 5 L-12 5 Z', fill: paper }, speaker);
    svg('path', { d: 'M6 -6 Q10 0 6 6 M10 -10 Q16 0 10 10', fill: 'none', stroke: paper, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, speaker);
    const P = reel.progress;
    const span = P.x1 - P.x0;
    const rail = make('div', '', layer);
    rail.style.height = '8px';
    rail.style.width = span + 'px';
    rail.style.borderRadius = '4px';
    rail.style.background = rgb(PAPER, 0.2);
    at(rail, P.x0, P.y, 'left');
    const fill = make('div', '', layer);
    fill.style.height = '8px';
    fill.style.borderRadius = '4px';
    fill.style.background = paper;
    const thumb = make('div', '', layer);
    thumb.style.width = '24px';
    thumb.style.height = '24px';
    thumb.style.borderRadius = '12px';
    thumb.style.background = paper;
    return (v) => {
      left.setAttribute('d', poly(PLAY_L, PAUSE_L, clamp(v.play, 0, 1)));
      right.setAttribute('d', poly(PLAY_R, PAUSE_R, clamp(v.play, 0, 1)));
      const x = P.x0 + clamp(v.prog, 0, 1) * span;
      fill.style.width = x - P.x0 + 'px';
      at(fill, P.x0, P.y, 'left');
      at(thumb, x, P.y);
      thumb.style.transform += ' scale(' + (1 + 0.3 * v.held) + ')';
    };
  },
  slider: (layer) => {
    const V = reel.volume;
    const span = V.x1 - V.x0;
    const speaker = svg('svg', { width: 40, height: 40, viewBox: '-20 -20 40 40' }, layer);
    svg('path', { d: 'M-13 -5 L-7 -5 L0 -12 L0 12 L-7 5 L-13 5 Z', fill: ink }, speaker);
    const waves = svg('path', { d: 'M6 -6 Q10 0 6 6 M10 -11 Q17 0 10 11', fill: 'none', stroke: ink, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, speaker);
    const rail = make('div', '', layer);
    rail.style.height = '14px';
    rail.style.borderRadius = '7px';
    rail.style.background = mute;
    const fill = make('div', '', layer);
    fill.style.height = '14px';
    fill.style.borderRadius = '7px';
    fill.style.background = ink;
    return (v) => {
      const stretch = Math.max(0, v.vol - 1) * span;
      const shift = -stretch / 2;
      at(speaker, V.x0 - 46 + shift, V.y);
      rail.style.width = span + stretch + 'px';
      at(rail, V.x0 + shift, V.y, 'left');
      fill.style.width = clamp(v.vol, 0, 1) * span + stretch + 'px';
      at(fill, V.x0 + shift, V.y, 'left');
      waves.setAttribute('opacity', String(clamp(v.vol * 1.6, 0.25, 1)));
    };
  },
  toggle: () => () => {},
  tabs: (layer) => {
    const labels = ['Day', 'Week', 'Month'].map((name, i) => at(text(layer, name, 28, 500, INK), [-180, 0, 180][i], 2));
    return (v) => labels.forEach((label, i) => (label.style.color = rgb(mix(INK, PAPER, v.cover[i]))));
  },
  chart: (layer) => {
    const C = reel.chart;
    const labels = ['Day', 'Week', 'Month'].map((name, i) => at(text(layer, name, 26, 500, INK), [-236, -120, -4][i], -186));
    at(text(layer, 'Revenue', 26, 500, mix(INK, PAPER, 0.55)), 296, -186, 'right');
    const plot = at(svg('svg', { width: 680, height: 480, viewBox: '-340 -240 680 480' }, layer), 0, 0);
    [0, 1, 2, 3].forEach((i) => svg('line', { x1: C.x0, x2: C.x1, y1: C.y0 + (i / 3) * (C.y1 - C.y0), y2: C.y0 + (i / 3) * (C.y1 - C.y0), stroke: mute, 'stroke-width': 1.5 }, plot));
    const line = svg('path', { fill: 'none', stroke: ink, 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, plot);
    const dot = svg('circle', { r: 9, fill: ink, stroke: paper, 'stroke-width': 4 }, plot);
    const tip = svg('g', {}, plot);
    svg('rect', { x: -72, y: -72, width: 144, height: 54, rx: 14, fill: ink }, tip);
    const value = svg('text', { x: 0, y: -36, 'text-anchor': 'middle', fill: paper, 'font-size': 27, 'font-weight': 600 }, tip);
    const S = reel.series;
    const point = (i, d) => {
      const y = S[0][i] + (S[1][i] - S[0][i]) * d;
      return [C.x0 + (i / (S[0].length - 1)) * (C.x1 - C.x0), C.y0 + y * (C.y1 - C.y0), y];
    };
    return (v) => {
      labels.forEach((label, i) => (label.style.color = rgb(mix(INK, PAPER, v.cover[i]))));
      const pts = S[0].map((_, i) => point(i, clamp(v.data, 0, 1)));
      line.setAttribute('d', 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L'));
      drawn(line, v.draw);
      const i = clamp(v.tipI, 0, S[0].length - 1);
      const a = point(Math.floor(i), v.data);
      const b = point(Math.min(S[0].length - 1, Math.floor(i) + 1), v.data);
      const f = i - Math.floor(i);
      const x = a[0] + (b[0] - a[0]) * f;
      const y = a[1] + (b[1] - a[1]) * f;
      const shown = clamp(v.tip, 0, 1);
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', y.toFixed(1));
      dot.setAttribute('opacity', String(shown));
      tip.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + (y - 6 * (1 - shown)).toFixed(1) + ')');
      tip.setAttribute('opacity', String(shown));
      value.textContent = '$' + (12 + (a[2] + (b[2] - a[2]) * f) * 40).toFixed(1) + 'k';
    };
  },
  palette: (layer) => {
    const glass = at(svg('svg', { width: 32, height: 32, viewBox: '-16 -16 32 32' }, layer), -286, -184);
    svg('circle', { cx: -2, cy: -2, r: 9, fill: 'none', stroke: ink, 'stroke-width': 2.6 }, glass);
    svg('path', { d: 'M5 5 L11 11', stroke: ink, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, glass);
    const typed = at(text(layer, '', 36, 500, INK), -252, -184, 'left');
    const hint = at(text(layer, 'Search commands', 36, 400, mix(INK, PAPER, 0.6)), -252, -184, 'left');
    const caret = make('div', '', layer);
    caret.style.width = '2.5px';
    caret.style.height = '40px';
    caret.style.background = accent;
    const chip = at(text(layer, '⌘K', 24, 500, mix(INK, PAPER, 0.5)), 296, -184, 'right');
    chip.style.padding = '8px 10px';
    chip.style.borderRadius = '9px';
    chip.style.background = mute;
    const rule = make('div', '', layer);
    rule.style.width = '660px';
    rule.style.height = '1.5px';
    rule.style.background = mute;
    at(rule, 0, -136);
    const ROW = 70;
    const TOP = -100;
    const highlight = make('div', '', layer);
    highlight.style.width = '620px';
    highlight.style.height = '60px';
    highlight.style.borderRadius = '14px';
    const rows = reel.items.map((item) => {
      const row = make('div', '', layer);
      const box = make('div', '', row);
      box.style.cssText = 'position:absolute;left:0;top:-14px;width:28px;height:28px;border-radius:8px;border:2.5px solid currentColor;box-sizing:border-box;opacity:0.5';
      const label = make('div', 'um-label', row, item);
      label.style.cssText += ';position:absolute;left:50px;top:0;transform:translateY(-50%);font-size:31px;font-weight:500';
      return row;
    });
    return (v) => {
      hint.style.opacity = v.typed ? '0' : '1';
      typed.textContent = v.typed;
      const end = -252 + (v.typed ? typed.offsetWidth + 3 : 0);
      at(caret, end, -184);
      caret.style.opacity = Math.floor(v.t * 2.4) % 2 === 0 ? '1' : '0';
      let y = TOP;
      const ys = rows.map((row, i) => {
        const p = clamp(v['row' + i], 0, 1);
        const here = y + (ROW / 2) * p;
        y += ROW * p;
        row.style.left = '-292px';
        row.style.top = here + 'px';
        row.style.opacity = String(p);
        row.style.transform = 'scale(' + (0.96 + 0.04 * p) + ')';
        return here;
      });
      const s = clamp(v.sel, 0, ys.length - 1);
      const hy = ys[Math.floor(s)] + (ys[Math.min(ys.length - 1, Math.floor(s) + 1)] - ys[Math.floor(s)]) * (s - Math.floor(s));
      at(highlight, 0, hy);
      highlight.style.background = rgb(mix(MUTE, INK, clamp(v.flash, 0, 1)));
      rows.forEach((row, i) => (row.style.color = rgb(mix(INK, PAPER, clamp(v.flash, 0, 1) * clamp(1 - Math.abs(i - s), 0, 1)))));
    };
  },
  toast: (layer) => {
    const badge = make('div', '', layer);
    badge.style.width = '46px';
    badge.style.height = '46px';
    badge.style.borderRadius = '23px';
    badge.style.background = accent;
    at(badge, -164, 0);
    const mark = svg('svg', { width: 46, height: 46, viewBox: '-23 -23 46 46' }, badge);
    const tick = svg('path', { d: 'M-9 1 L-3 7 L10 -7', fill: 'none', stroke: paper, 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mark);
    at(text(layer, toastText, 27, 500, PAPER), -126, 0, 'left');
    return (v) => drawn(tick, v.toastTick);
  }
};

const layers = Object.keys(BUILD).map((kind) => {
  const box = reel.library[kind].box;
  const layer = make('div', 'um-layer', shape);
  layer.style.width = box.w + 'px';
  layer.style.height = box.h + 'px';
  layer.style.marginLeft = -box.w / 2 + 'px';
  layer.style.marginTop = -box.h / 2 + 'px';
  const host = make('div', 'um-host', layer);
  return { kind, layer, host, update: BUILD[kind](host) };
});

const pointer = make('div', 'um-cursor', make('div', 'um-centre', root));
const arrow = svg('svg', { width: 34, height: 34, viewBox: '0 0 34 34' }, pointer);
svg('path', { d: 'M4 3 L4 27 L10.5 21 L15 30.5 L19.5 28.5 L15 19.5 L23.5 19.5 Z', fill: ink, stroke: paper, 'stroke-width': 2, 'stroke-linejoin': 'round' }, arrow);

const STAGGER = 0.035;
const CURSOR_SCALE = side / 1080;
const coverOf = (lo, hi, centers, half) => centers.map((c) => clamp((Math.min(hi, c + half) - Math.max(lo, c - half)) / (2 * half), 0, 1));

const paint = (time) => {
  const frame = reel.frameAt(plan, time);
  const v = Object.assign({}, frame.values);
  v.typed = frame.typed;
  const inTabs = clamp(v['in:tabs'] || 0, 0, 1);
  const inChart = clamp(v['in:chart'] || 0, 0, 1);
  const cam = v.cam;
  const stretch = Math.max(0, v.vol - 1) * (reel.volume.x1 - reel.volume.x0) * clamp(v['in:slider'] || 0, 0, 1);
  v.held = v.press * (v['in:player'] || 0);
  v.cover = inChart > inTabs ? coverOf(v.knobLo, v.knobHi, [-236, -120, -4], 56) : coverOf(v.knobLo, v.knobHi, [-180, 0, 180], 86);

  world.style.transform = 'scale(' + cam + ')';
  const w = v.w + stretch;
  const h = v.h * (1 - 0.18 * clamp(stretch / 260, 0, 1));
  shape.style.width = w + 'px';
  shape.style.height = h + 'px';
  shape.style.borderRadius = Math.min(v.r, h / 2) + 'px';
  shape.style.background = rgb(mix([v.bgR, v.bgG, v.bgB], ACCENT, clamp(v.on, 0, 1)));
  shape.style.transform = 'translate(' + (-w / 2 + stretch / 2) + 'px,' + -h / 2 + 'px) scale(' + (1 - 0.025 * v.press) + ')';
  shape.style.transformOrigin = '50% 50%';

  const lo = v.knobLo;
  const hi = v.knobHi;
  knob.style.left = w / 2 + lo + 'px';
  knob.style.width = Math.max(0, hi - lo) + 'px';
  knob.style.top = h / 2 + v.knobY - v.knobH / 2 + 'px';
  knob.style.height = v.knobH + 'px';
  knob.style.borderRadius = v.knobH / 2 + 'px';
  knob.style.background = rgb(mix(PAPER, INK, clamp(inTabs + inChart, 0, 1)));
  knob.style.opacity = String(clamp(v.knob, 0, 1));
  knob.style.boxShadow = '0 3px 10px rgba(0,0,0,' + (0.28 * clamp(v['in:toggle'] || 0, 0, 1)) + ')';

  for (const l of layers) {
    const p = clamp(v['in:' + l.kind] || 0, 0, 1);
    l.layer.style.display = p < 0.003 ? 'none' : 'block';
    if (p < 0.003) {
      continue;
    }
    l.layer.style.transform = 'scale(' + (0.94 + 0.06 * p) + ')';
    Array.from(l.host.children).forEach((child, i) => {
      const q = clamp(reel.channel(plan, 'in:' + l.kind, time - i * STAGGER), 0, 1);
      child.style.opacity = String(q);
      child.style.filter = q > 0.995 ? 'none' : 'blur(' + (1 - q) * 10 + 'px)';
      child.style.translate = '0 ' + (1 - q) * 10 + 'px';
    });
    l.update(v);
  }

  pointer.style.transform = 'translate(' + (cam * v.curX - 4) + 'px,' + (cam * v.curY - 3) + 'px) scale(' + (CURSOR_SCALE * (1 - 0.16 * clamp(v.press, 0, 1))) + ')';
};

paint(0);
tl.to({}, { duration, ease: 'none', onUpdate() { paint(this.time()); } }, 0);
`;

export const REEL_PIECE = { name: REEL_COMPONENT, html: '', css: CSS, js: JS.replace('${REEL}', () => reelSource()) };

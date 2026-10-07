import { z } from 'zod';

export enum UiKind {
  LinkShortener = 'link-shortener',
  LinkList = 'link-list',
  StatCards = 'stat-cards',
  Funnel = 'funnel',
  Payouts = 'payouts',
  Qr = 'qr',
  Window = 'window'
}

export const UI_KINDS = Object.values(UiKind) as [UiKind, ...UiKind[]];

export type UiSize = { width: number; height: number };

export type UiPiece = { name: string; about: string; size: UiSize; html: string; css: string; js: string };

export const UI_SAFE = 0.9;

export function uiScale(piece: Pick<UiPiece, 'size'>, frame: UiSize, zoom: number): number {
  return zoom * Math.min(1, (frame.width * UI_SAFE) / piece.size.width, (frame.height * UI_SAFE) / piece.size.height);
}

const STYLE_PARAMS = `
const font = param('font', 'sans', { type: 'font', group: 'Style' });
const ink = param('ink', '#0a0a0a', { type: 'color', group: 'Style', label: 'Text' });
const muted = param('muted', '#737373', { type: 'color', group: 'Style', label: 'Muted text' });
const paper = param('paper', '#ffffff', { type: 'color', group: 'Style', label: 'Card' });
const line = param('line', '#e5e5e5', { type: 'color', group: 'Style', label: 'Borders' });
const accent = param('accent', '#3b82f6', { type: 'color', group: 'Style' });
const radius = param('radius', 14, { type: 'number', min: 0, max: 40, group: 'Style', label: 'Corner radius (px)' });
const zoom = param('zoom', 1, { type: 'number', min: 0.4, max: 3, step: 0.05, group: 'Layout', label: 'Size' });
const speed = param('speed', 1, { type: 'number', min: 0.4, max: 3, step: 0.05, group: 'Motion' });
const family = String(font) + ', Inter, sans-serif';
root.style.fontFamily = family;
root.style.color = ink;
root.style.setProperty('--ink', ink);
root.style.setProperty('--muted', muted);
root.style.setProperty('--paper', paper);
root.style.setProperty('--line', line);
root.style.setProperty('--accent', accent);
root.style.setProperty('--r', radius + 'px');
const clamp = (v, a, b) => Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v));
const span = (t, at, len) => clamp((t - at / speed) / Math.max(0.001, len / speed));
const out = (p) => 1 - Math.pow(1 - p, 4);
const inOut = (p) => (p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2);
const make = (tag, cls, host, text) => {
  const n = document.createElement(tag);
  if (cls) {
    n.className = cls;
  }
  if (text !== undefined) {
    n.textContent = text;
  }
  (host || stage).appendChild(n);
  return n;
};
const svg = (tag, attrs, host) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) {
    n.setAttribute(k, attrs[k]);
  }
  host.appendChild(n);
  return n;
};
const rows = (text) => String(text).split('\\n').map((r) => r.split('|').map((c) => c.trim())).filter((r) => r[0]);
const number = (text) => {
  const m = /^([^0-9.]*)([0-9.,]+)([kKmM%]?)(.*)$/.exec(String(text));
  if (!m) {
    return { pre: '', value: 0, unit: '', post: String(text), digits: 0 };
  }
  const raw = m[2].replace(/,/g, '');
  return { pre: m[1], value: Number(raw), unit: m[3], post: m[4], digits: (raw.split('.')[1] || '').length };
};
const counted = (n, p) => n.pre + (n.value * p).toFixed(n.digits).replace(/\\B(?=(\\d{3})+(?!\\d))/g, n.digits ? '' : ',') + n.unit + n.post;
const stage = document.createElement('div');
stage.className = 'stage';
stage.style.fontFamily = family;
root.appendChild(stage);
const fit = Math.min(1, ((root.clientWidth || DESIGN_W) * SAFE) / DESIGN_W, ((root.clientHeight || DESIGN_H) * SAFE) / DESIGN_H);
stage.style.transform = 'translate(-50%, -50%) scale(' + zoom * fit + ')';
const drive = (render) => {
  render(0);
  tl.to({}, { duration, ease: 'none', onUpdate() { render(this.time()); } }, 0);
};
`;

const BASE_CSS = `
:scope { position: absolute; inset: 0; }
.stage { position: absolute; left: 50%; top: 50%; transform-origin: 50% 50%; font-family: inherit; }
.stage * { font-family: inherit; }
.card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r); box-shadow: 0 30px 80px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06); }
.muted { color: var(--muted); }
`;

const piece = (name: string, about: string, size: UiSize, css: string, js: string): UiPiece => ({ name, about, size, html: '', css: BASE_CSS + css, js: `const DESIGN_W = ${size.width};\nconst DESIGN_H = ${size.height};\nconst SAFE = ${UI_SAFE};\n` + STYLE_PARAMS + js });

const SHORTENER = piece(
  'UiLinkShortener',
  'A link shortener: the long url types itself into the field, a cursor clicks the button, the short link appears with a "Copied" toast. Params url, short, button, label.',
  { width: 1180, height: 420 },
  `
.box { width: 1180px; padding: 40px 44px; }
.label { font-size: 22px; font-weight: 600; margin-bottom: 14px; }
.row { display: flex; gap: 16px; align-items: stretch; }
.field { flex: 1; height: 76px; border: 1.5px solid var(--line); border-radius: calc(var(--r) * 0.7); display: flex; align-items: center; padding: 0 24px; font-size: 28px; white-space: nowrap; overflow: hidden; }
.caret { display: inline-block; width: 2px; height: 34px; background: var(--ink); margin-left: 2px; }
.button { height: 76px; padding: 0 36px; border-radius: calc(var(--r) * 0.7); background: var(--ink); color: var(--paper); font-size: 26px; font-weight: 600; display: flex; align-items: center; transform-origin: 50% 50%; }
.result { margin-top: 26px; display: flex; align-items: center; gap: 18px; font-size: 34px; font-weight: 700; }
.dot { width: 54px; height: 54px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28px; }
.toast { position: absolute; right: 44px; bottom: -86px; background: var(--ink); color: var(--paper); font-size: 22px; font-weight: 600; padding: 16px 24px; border-radius: calc(var(--r) * 0.7); }
.cursor { position: absolute; width: 40px; height: 40px; }
`,
  `
const url = param('url', 'https://dub.co/blog/introducing-partners', { type: 'text', group: 'Content' });
const short = param('short', 'dub.sh/partners', { type: 'text', group: 'Content' });
const button = param('button', 'Create link', { type: 'text', group: 'Content' });
const label = param('label', 'Destination URL', { type: 'text', group: 'Content' });
const toastText = param('toast', 'Copied to clipboard', { type: 'text', group: 'Content' });
const box = make('div', 'card box');
box.style.transform = 'translate(-50%, -50%)';
box.style.position = 'absolute';
make('div', 'label', box, label);
const row = make('div', 'row', box);
const field = make('div', 'field', row);
const typed = make('span', '', field);
const caret = make('span', 'caret', field);
const btn = make('div', 'button', row, button);
const result = make('div', 'result', box);
make('div', 'dot', result, '✓');
make('div', '', result, short);
const toast = make('div', 'toast', box, toastText);
const cursor = make('div', 'cursor', box);
cursor.innerHTML = '<svg viewBox="0 0 24 24" width="40" height="40"><path d="M4 2l16 9-7 2-3 7z" fill="#111" stroke="#fff" stroke-width="1.5"/></svg>';
const TYPE_AT = 0.2;
const TYPE_LEN = Math.min(1.6, duration * 0.35);
const CLICK = TYPE_AT + TYPE_LEN + 0.45;
drive((t) => {
  const typing = span(t, TYPE_AT, TYPE_LEN);
  typed.textContent = url.slice(0, Math.round(url.length * typing));
  caret.style.opacity = typing < 1 || Math.floor(t * 2.5) % 2 === 0 ? '1' : '0';
  const travel = inOut(span(t, CLICK - 0.55, 0.5));
  cursor.style.left = (1080 - 140 * travel) + 'px';
  cursor.style.top = (300 - 240 * travel + 14) + 'px';
  cursor.style.opacity = String(span(t, CLICK - 0.7, 0.15));
  const press = span(t, CLICK, 0.08) - span(t, CLICK + 0.08, 0.12);
  btn.style.transform = 'scale(' + (1 - 0.06 * press) + ')';
  const shown = out(span(t, CLICK + 0.1, 0.4));
  result.style.opacity = String(shown);
  result.style.transform = 'translateY(' + (24 * (1 - shown)) + 'px)';
  const pop = out(span(t, CLICK + 0.35, 0.35));
  toast.style.opacity = String(pop);
  toast.style.transform = 'translateY(' + (20 * (1 - pop)) + 'px) scale(' + (0.94 + 0.06 * pop) + ')';
});
`
);

const LINK_LIST = piece(
  'UiLinkList',
  'A list of short links filling in one row after another, each with its destination and a click count that counts up. Param links: one row per line "short|destination|clicks".',
  { width: 1180, height: 420 },
  `
.list { position: absolute; width: 1180px; transform: translate(-50%, -50%); padding: 14px; }
.item { display: flex; align-items: center; gap: 20px; padding: 22px 26px; border-bottom: 1px solid var(--line); }
.item:last-child { border-bottom: 0; }
.fav { width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 22px; }
.names { flex: 1; }
.short { font-size: 28px; font-weight: 700; }
.dest { font-size: 20px; margin-top: 4px; }
.clicks { font-size: 22px; padding: 10px 18px; border: 1px solid var(--line); border-radius: 999px; font-variant-numeric: tabular-nums; }
`,
  `
const links = param('links', 'dub.sh/launch|dub.co/blog/launch|12,480 clicks\\ndub.sh/partners|dub.co/partners|8,214 clicks\\ndub.sh/pricing|dub.co/pricing|3,902 clicks\\ndub.sh/demo|cal.com/dub/demo|1,377 clicks', { type: 'textarea', group: 'Content' });
const STAGGER = 0.14;
const list = make('div', 'card list');
const items = rows(links).map((r) => {
  const item = make('div', 'item', list);
  make('div', 'fav', item, r[0].replace(/^.*\\//, '').slice(0, 1).toUpperCase());
  const names = make('div', 'names', item);
  make('div', 'short', names, r[0]);
  make('div', 'dest muted', names, '↳ ' + (r[1] || ''));
  const clicks = make('div', 'clicks', item);
  return { item, clicks, n: number(r[2] || '0') };
});
drive((t) => {
  items.forEach((it, i) => {
    const p = out(span(t, 0.15 + i * STAGGER, 0.45));
    it.item.style.opacity = String(p);
    it.item.style.transform = 'translateY(' + (30 * (1 - p)) + 'px)';
    it.clicks.textContent = counted(it.n, out(span(t, 0.35 + i * STAGGER, 1.2)));
  });
});
`
);

const STAT_CARDS = piece(
  'UiStatCards',
  'Analytics: stat cards whose numbers count up, over a line chart that draws itself (or bars that grow). Params stats (one per line "label|value", e.g. "Sales|$506"), chart line|bar.',
  { width: 1300, height: 520 },
  `
.board { position: absolute; width: 1300px; transform: translate(-50%, -50%); padding: 34px; }
.stats { display: flex; gap: 0; border-bottom: 1px solid var(--line); }
.stat { flex: 1; padding: 6px 26px 26px; border-right: 1px solid var(--line); }
.stat:last-child { border-right: 0; }
.stat .name { font-size: 22px; display: flex; align-items: center; gap: 10px; }
.stat .swatch { width: 12px; height: 12px; border-radius: 3px; }
.stat .value { font-size: 64px; font-weight: 700; letter-spacing: -0.03em; margin-top: 8px; font-variant-numeric: tabular-nums; }
.chart { margin-top: 26px; }
`,
  `
const stats = param('stats', 'Clicks|7.2K\\nLeads|165\\nSales|$506', { type: 'textarea', group: 'Content' });
const chart = param('chart', 'line', { type: 'select', options: ['line', 'bar'], group: 'Content' });
const COLORS = [accent, '#a855f7', '#14b8a6', '#f59e0b'];
const W = 1232;
const H = 300;
const board = make('div', 'card board');
const strip = make('div', 'stats', board);
const cards = rows(stats).map((r, i) => {
  const stat = make('div', 'stat', strip);
  const name = make('div', 'name muted', stat);
  make('span', 'swatch', name).style.background = COLORS[i % COLORS.length];
  make('span', '', name, r[0]);
  return { value: make('div', 'value', stat), n: number(r[1] || '0') };
});
const plot = svg('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, class: 'chart' }, board);
const POINTS = 24;
const ys = Array.from({ length: POINTS }, (_, i) => 0.25 + 0.55 * (i / (POINTS - 1)) + 0.12 * Math.sin(i * 1.3) + 0.06 * rand());
const xy = ys.map((v, i) => [(i / (POINTS - 1)) * W, H - v * H * 0.9]);
const path = 'M' + xy.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
const area = svg('path', { d: path + ' L' + W + ' ' + H + ' L0 ' + H + ' Z', fill: accent, opacity: '0' }, plot);
const stroke = svg('path', { d: path, fill: 'none', stroke: accent, 'stroke-width': '5', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, plot);
const length = xy.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - xy[i - 1][0], p[1] - xy[i - 1][1]) : 0), 0);
stroke.setAttribute('stroke-dasharray', String(length));
const bars = xy.map((p, i) => svg('rect', { x: String(p[0] - 16), width: '32', y: String(H), height: '0', rx: '4', fill: COLORS[i % 2 ? 0 : 1] }, plot));
drive((t) => {
  cards.forEach((c, i) => {
    c.value.textContent = counted(c.n, out(span(t, 0.2 + i * 0.12, 1.3)));
  });
  const drawn = inOut(span(t, 0.35, 1.5));
  const isLine = chart === 'line';
  stroke.style.display = isLine ? '' : 'none';
  area.style.display = isLine ? '' : 'none';
  stroke.setAttribute('stroke-dashoffset', String(length * (1 - drawn)));
  area.setAttribute('opacity', String(0.12 * out(span(t, 1.85, 0.5))));
  bars.forEach((b, i) => {
    b.style.display = isLine ? 'none' : '';
    const g = out(span(t, 0.3 + i * 0.04, 0.6));
    const h = (H - xy[i][1]) * g;
    b.setAttribute('y', String(H - h));
    b.setAttribute('height', String(h));
  });
});
`
);

const FUNNEL = piece(
  'UiFunnel',
  'A conversion funnel filling stage by stage (clicks to leads to sales), each bar growing to its share while its number and percentage count up. Param stages: one per line "label|value|percent".',
  { width: 1300, height: 380 },
  `
.funnel { position: absolute; width: 1300px; transform: translate(-50%, -50%); padding: 40px 44px; }
.stage-row { display: grid; grid-template-columns: 200px 1fr 170px; align-items: center; gap: 24px; margin: 16px 0; }
.stage-row .name { font-size: 26px; font-weight: 600; }
.track { height: 64px; background: color-mix(in srgb, var(--line) 60%, transparent); border-radius: calc(var(--r) * 0.6); overflow: hidden; }
.fill { height: 100%; border-radius: calc(var(--r) * 0.6); }
.num { text-align: right; font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; }
.num .pct { display: block; font-size: 20px; font-weight: 500; }
`,
  `
const stages = param('stages', 'Clicks|7,200|100%\\nLeads|165|36%\\nSales|$506|1.3%', { type: 'textarea', group: 'Content' });
const COLORS = [accent, '#a855f7', '#14b8a6', '#f59e0b'];
const box = make('div', 'card funnel');
const parts = rows(stages).map((r, i) => {
  const row = make('div', 'stage-row', box);
  make('div', 'name', row, r[0]);
  const fill = make('div', 'fill', make('div', 'track', row));
  fill.style.background = COLORS[i % COLORS.length];
  const num = make('div', 'num', row);
  const value = make('span', '', num);
  const pct = make('span', 'pct muted', num);
  return { fill, value, pct, n: number(r[1] || '0'), p: number(r[2] || '100%') };
});
drive((t) => {
  parts.forEach((s, i) => {
    const g = inOut(span(t, 0.25 + i * 0.45, 0.8));
    s.fill.style.width = Math.max(1.5, s.p.value * g) + '%';
    s.value.textContent = counted(s.n, out(span(t, 0.25 + i * 0.45, 0.9)));
    s.pct.textContent = counted(s.p, g);
  });
});
`
);

const PAYOUTS = piece(
  'UiPayouts',
  'A payouts table: rows slide in one after another and each status turns from Pending to Paid. Param rows: one per line "period|partner|amount".',
  { width: 1320, height: 400 },
  `
.table { position: absolute; width: 1320px; transform: translate(-50%, -50%); padding: 22px 0; }
.head, .tr { display: grid; grid-template-columns: 1.3fr 1.3fr 1fr 0.8fr; padding: 18px 36px; align-items: center; }
.head { font-size: 20px; border-bottom: 1px solid var(--line); }
.tr { font-size: 24px; border-bottom: 1px solid var(--line); }
.tr:last-child { border-bottom: 0; }
.pill { justify-self: start; font-size: 19px; font-weight: 600; padding: 6px 14px; border-radius: 999px; }
.amount { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
`,
  `
const data = param('rows', 'Oct 2025|Sophie Anderson|$680.00\\nOct 2025|Luca Romano|$412.50\\nSep 2025|Emma Stevenson|$1,240.00\\nSep 2025|Logan Rivers|$95.00', { type: 'textarea', group: 'Content' });
const PENDING = ['#fef3c7', '#b45309', 'Pending'];
const PAID = ['#dcfce7', '#15803d', 'Paid'];
const box = make('div', 'card table');
const head = make('div', 'head muted', box);
['Period', 'Partner', 'Status', 'Amount'].forEach((h, i) => (make('div', i === 3 ? 'amount' : '', head, h).style.fontWeight = '500'));
const lines = rows(data).map((r) => {
  const tr = make('div', 'tr', box);
  make('div', 'muted', tr, r[0]);
  make('div', '', tr, r[1]);
  const pill = make('div', 'pill', tr);
  const amount = make('div', 'amount', tr);
  return { tr, pill, amount, n: number(r[2] || '0') };
});
const mix = (a, b, p) => {
  const c = (h, s) => parseInt(h.slice(s, s + 2), 16);
  return 'rgb(' + [1, 3, 5].map((s) => Math.round(c(a, s) + (c(b, s) - c(a, s)) * p)).join(',') + ')';
};
drive((t) => {
  lines.forEach((l, i) => {
    const p = out(span(t, 0.15 + i * 0.12, 0.45));
    l.tr.style.opacity = String(p);
    l.tr.style.transform = 'translateX(' + (-40 * (1 - p)) + 'px)';
    l.amount.textContent = counted(l.n, out(span(t, 0.2 + i * 0.12, 0.9)));
    const paid = inOut(span(t, 1.1 + i * 0.25, 0.3));
    l.pill.style.background = mix(PENDING[0], PAID[0], paid);
    l.pill.style.color = mix(PENDING[1], PAID[1], paid);
    l.pill.textContent = (paid < 0.5 ? PENDING[2] : PAID[2]);
    l.pill.style.transform = 'scale(' + (1 + 0.12 * Math.sin(Math.PI * paid)) + ')';
  });
});
`
);

const QR = piece(
  'UiQr',
  'A QR code building itself: the three corner squares land first, then the modules pop in, the short link under it. Params text (encoded look), caption.',
  { width: 640, height: 720 },
  `
.qr { position: absolute; transform: translate(-50%, -50%); padding: 44px; display: flex; flex-direction: column; align-items: center; gap: 26px; }
.caption { font-size: 30px; font-weight: 700; }
`,
  `
const text = param('text', 'dub.sh/launch', { type: 'text', group: 'Content' });
const caption = param('caption', 'dub.sh/launch', { type: 'text', group: 'Content' });
const N = 25;
const CELL = 22;
const box = make('div', 'card qr');
const code = svg('svg', { width: N * CELL, height: N * CELL, viewBox: '0 0 ' + N + ' ' + N }, box);
make('div', 'caption', box, caption);
let seed = 7;
for (const ch of String(text)) {
  seed = (seed * 31 + ch.charCodeAt(0)) % 100003;
}
const bit = (x, y) => ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) % 7 < 3;
const finder = (x, y) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
const corners = [[0, 0], [N - 7, 0], [0, N - 7]].map(([x, y]) => {
  const g = svg('g', {}, code);
  svg('rect', { x: String(x + 0.5), y: String(y + 0.5), width: '6', height: '6', fill: 'none', stroke: ink, 'stroke-width': '1' }, g);
  svg('rect', { x: String(x + 2), y: String(y + 2), width: '3', height: '3', fill: ink }, g);
  g.style.transformOrigin = (x + 3.5) + 'px ' + (y + 3.5) + 'px';
  return g;
});
const modules = [];
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    if (!finder(x, y) && bit(x, y)) {
      modules.push({ node: svg('rect', { x: String(x + 0.08), y: String(y + 0.08), width: '0.84', height: '0.84', fill: ink }, code), at: rand(), x, y });
    }
  }
}
drive((t) => {
  corners.forEach((g, i) => {
    const p = out(span(t, 0.1 + i * 0.12, 0.4));
    g.style.opacity = String(p);
    g.style.transform = 'scale(' + (0.4 + 0.6 * p) + ')';
  });
  modules.forEach((m) => {
    const p = out(span(t, 0.5 + m.at * 1.1, 0.25));
    m.node.setAttribute('opacity', String(p));
  });
});
`
);

const WINDOW = piece(
  'UiWindow',
  'Vector device chrome to put other clips in: a browser window with a url bar, or a phone frame. Params kind browser|phone, address. Put UI clips on a track above it.',
  { width: 1500, height: 960 },
  `
.browser { position: absolute; width: 1500px; height: 900px; transform: translate(-50%, -50%); overflow: hidden; }
.bar { height: 64px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 12px; padding: 0 22px; }
.light { width: 15px; height: 15px; border-radius: 50%; background: var(--line); }
.address { margin-left: 24px; flex: 1; max-width: 640px; height: 38px; border-radius: 999px; background: color-mix(in srgb, var(--line) 50%, transparent); font-size: 18px; display: flex; align-items: center; padding: 0 18px; }
.phone { position: absolute; width: 470px; height: 960px; transform: translate(-50%, -50%); border-radius: 72px; border: 14px solid #111; background: var(--paper); box-shadow: 0 40px 100px rgba(0,0,0,0.35); }
.notch { position: absolute; left: 50%; top: 14px; width: 130px; height: 36px; border-radius: 20px; background: #111; transform: translateX(-50%); }
`,
  `
const kind = param('kind', 'browser', { type: 'select', options: ['browser', 'phone'], group: 'Content' });
const address = param('address', 'app.dub.co', { type: 'text', group: 'Content' });
const frame = kind === 'phone' ? make('div', 'phone') : make('div', 'card browser');
if (kind === 'phone') {
  make('div', 'notch', frame);
} else {
  const bar = make('div', 'bar', frame);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c) => (make('div', 'light', bar).style.background = c));
  make('div', 'address muted', bar, address);
}
drive((t) => {
  const p = out(span(t, 0, 0.5));
  frame.style.opacity = String(p);
});
`
);

export const UI_KIT: Record<UiKind, UiPiece> = {
  [UiKind.LinkShortener]: SHORTENER,
  [UiKind.LinkList]: LINK_LIST,
  [UiKind.StatCards]: STAT_CARDS,
  [UiKind.Funnel]: FUNNEL,
  [UiKind.Payouts]: PAYOUTS,
  [UiKind.Qr]: QR,
  [UiKind.Window]: WINDOW
};

export enum UiBlock {
  Nav = 'nav',
  Heading = 'heading',
  Text = 'text',
  Input = 'input',
  Button = 'button',
  Stat = 'stat',
  Card = 'card',
  List = 'list',
  Picture = 'picture'
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_BLOCKS = 12;
const MAX_ITEMS = 6;

export const UI_STRUCTURE = z.object({
  layout: z.enum(['landing', 'app', 'dashboard', 'form', 'chat']),
  colors: z.object({ ink: z.string().regex(HEX), muted: z.string().regex(HEX), paper: z.string().regex(HEX), line: z.string().regex(HEX), accent: z.string().regex(HEX) }),
  font: z.string().max(60),
  radius: z.number().min(0).max(40),
  blocks: z.array(z.object({ kind: z.enum(UiBlock), text: z.string().max(140), items: z.array(z.string().max(60)).max(MAX_ITEMS).optional() })).min(1).max(MAX_BLOCKS)
});

export type UiStructure = z.infer<typeof UI_STRUCTURE>;

export const RECREATE_STATES = [
  'enter: the blocks rise in one after another',
  'type: the input types its text with a caret',
  'count: numbers count up',
  'click: a cursor travels to the button and presses it'
] as const;

const RECREATED_SIZE: UiSize = { width: 1400, height: 860 };

const RECREATED_CSS = `
.screen { position: absolute; width: 1400px; height: 860px; transform: translate(-50%, -50%); overflow: hidden; display: flex; flex-direction: column; }
.nav { height: 76px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 34px; padding: 0 40px; font-size: 22px; }
.brand { font-weight: 800; font-size: 26px; margin-right: auto; }
.body { flex: 1; padding: 44px 64px; display: flex; flex-direction: column; gap: 26px; }
.heading { font-size: 62px; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; }
.text { font-size: 26px; line-height: 1.4; }
.input { height: 80px; border: 1.5px solid var(--line); border-radius: calc(var(--r) * 0.8); display: flex; align-items: center; padding: 0 26px; font-size: 28px; white-space: nowrap; overflow: hidden; }
.caret { display: inline-block; width: 2px; height: 34px; background: var(--ink); margin-left: 2px; }
.button { align-self: flex-start; height: 72px; padding: 0 40px; border-radius: calc(var(--r) * 0.8); background: var(--accent); color: var(--paper); font-size: 26px; font-weight: 700; display: flex; align-items: center; }
.stat { font-size: 54px; font-weight: 800; font-variant-numeric: tabular-nums; }
.box { border: 1px solid var(--line); border-radius: var(--r); padding: 24px 28px; }
.box-title { font-size: 24px; font-weight: 700; margin-bottom: 14px; }
.chips { display: flex; gap: 14px; flex-wrap: wrap; }
.chip { font-size: 20px; padding: 10px 18px; border-radius: 999px; border: 1px solid var(--line); }
.row { font-size: 24px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.picture { height: 200px; border-radius: var(--r); overflow: hidden; }
.cursor { position: absolute; width: 40px; height: 40px; left: 0; top: 0; }
`;

const RECREATED_JS = `
const S = STRUCTURE;
const screen = make('div', 'card screen');
const body = make('div', 'body', screen);
const parts = [];
const typers = [];
const counters = [];
let button = null;
S.blocks.forEach((b) => {
  if (b.kind === 'nav') {
    const nav = make('div', 'nav', screen);
    screen.insertBefore(nav, body);
    make('div', 'brand', nav, b.text);
    (b.items || []).forEach((i) => make('div', 'muted', nav, i));
    parts.push(nav);
    return;
  }
  if (b.kind === 'input') {
    const field = make('div', 'input', body);
    typers.push({ text: make('span', '', field), caret: make('span', 'caret', field), full: b.text });
    parts.push(field);
    return;
  }
  if (b.kind === 'button') {
    button = make('div', 'button', body, b.text);
    parts.push(button);
    return;
  }
  if (b.kind === 'stat') {
    const n = make('div', 'stat', body);
    counters.push({ node: n, n: number(b.text) });
    parts.push(n);
    return;
  }
  if (b.kind === 'card' || b.kind === 'list') {
    const box = make('div', 'box', body);
    make('div', 'box-title', box, b.text);
    const host = b.kind === 'card' ? make('div', 'chips', box) : box;
    (b.items || []).forEach((i) => make('div', b.kind === 'card' ? 'chip' : 'row', host, i));
    parts.push(box);
    return;
  }
  if (b.kind === 'picture') {
    const pic = make('div', 'picture', body);
    const art = svg('svg', { viewBox: '0 0 1200 200', width: '100%', height: '100%', preserveAspectRatio: 'none' }, pic);
    svg('rect', { x: 0, y: 0, width: 1200, height: 200, fill: accent, opacity: 0.12 }, art);
    svg('circle', { cx: 980, cy: 100, r: 70, fill: accent, opacity: 0.5 }, art);
    svg('rect', { x: 60, y: 60, width: 420, height: 24, fill: ink, opacity: 0.2 }, art);
    svg('rect', { x: 60, y: 110, width: 300, height: 24, fill: ink, opacity: 0.12 }, art);
    parts.push(pic);
    return;
  }
  parts.push(make('div', b.kind === 'heading' ? 'heading' : 'text muted', body, b.text));
});
const cursor = make('div', 'cursor', screen);
cursor.innerHTML = '<svg viewBox="0 0 24 24" width="40" height="40"><path d="M4 2l16 9-7 2-3 7z" fill="#111" stroke="#fff" stroke-width="1.5"/></svg>';
const STAGGER = 0.12;
const TYPE_AT = 0.3 + parts.length * STAGGER;
const TYPE_LEN = Math.min(1.4, duration * 0.3);
const CLICK = TYPE_AT + TYPE_LEN + 0.5;
drive((t) => {
  parts.forEach((p, i) => {
    const s = out(span(t, 0.1 + i * STAGGER, 0.45));
    p.style.opacity = String(s);
    p.style.transform = 'translateY(' + (28 * (1 - s)) + 'px)';
  });
  typers.forEach((ty) => {
    const k = span(t, TYPE_AT, TYPE_LEN);
    ty.text.textContent = ty.full.slice(0, Math.round(ty.full.length * k));
    ty.caret.style.opacity = k < 1 || Math.floor(t * 2.5) % 2 === 0 ? '1' : '0';
  });
  counters.forEach((c, i) => {
    c.node.textContent = counted(c.n, out(span(t, 0.4 + i * STAGGER, 1.4)));
  });
  if (!button) {
    cursor.style.opacity = '0';
    return;
  }
  const travel = inOut(span(t, CLICK - 0.6, 0.55));
  const bx = button.offsetLeft + button.offsetWidth * 0.6;
  const by = button.offsetTop + (screen.offsetHeight - body.offsetHeight) + button.offsetHeight * 0.6;
  cursor.style.transform = 'translate(' + (1300 + (bx - 1300) * travel) + 'px, ' + (800 + (by - 800) * travel) + 'px)';
  cursor.style.opacity = String(span(t, CLICK - 0.75, 0.15));
  const press = span(t, CLICK, 0.08) - span(t, CLICK + 0.08, 0.12);
  button.style.transform = 'scale(' + (1 - 0.06 * press) + ')';
});
`;

export function recreatedUi(name: string, structure: UiStructure): UiPiece {
  const about = `${structure.layout} UI recreated from a capture: ${structure.blocks.map((b) => b.kind).join(', ')}`;
  return piece(name, about, RECREATED_SIZE, RECREATED_CSS, RECREATED_JS.replace('STRUCTURE', () => JSON.stringify(structure)));
}

export const recreatedStyle = (structure: UiStructure, fontUsable: boolean) => ({ ...structure.colors, radius: structure.radius, ...(fontUsable ? { font: structure.font } : {}) });

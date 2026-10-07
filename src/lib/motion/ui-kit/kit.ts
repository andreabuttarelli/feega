export enum UiKind {
  LinkShortener = 'link-shortener',
  LinkList = 'link-list',
  StatCards = 'stat-cards',
  Funnel = 'funnel',
  Payouts = 'payouts',
  Qr = 'qr',
  Window = 'window',
  Sidebar = 'sidebar',
  Hero = 'hero',
  PromptBox = 'prompt-box',
  EditorCanvas = 'editor-canvas',
  CardGrid = 'card-grid',
  Pricing = 'pricing',
  Chat = 'chat',
  Modal = 'modal',
  Toggle = 'toggle',
  Upload = 'upload',
  GeneratedResult = 'generated-result',
  Cursor = 'cursor'
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

const POINTER = `
const pointer = (host) => {
  const n = make('div', 'pointer', host);
  n.innerHTML = '<svg viewBox="0 0 24 24" width="40" height="40"><path d="M4 2l16 9-7 2-3 7z" fill="#111" stroke="#fff" stroke-width="1.5"/></svg>';
  return n;
};
const glide = (n, from, to, at, len, t) => {
  const p = inOut(span(t, at, len));
  n.style.left = (from[0] + (to[0] - from[0]) * p) + 'px';
  n.style.top = (from[1] + (to[1] - from[1]) * p) + 'px';
  n.style.opacity = String(span(t, at - 0.2, 0.15));
};
const press = (t, at) => span(t, at, 0.08) - span(t, at + 0.08, 0.12);
const rise = (n, p, dy) => {
  n.style.opacity = String(p);
  n.style.transform = 'translateY(' + (dy * (1 - p)) + 'px)';
};
`;

const POINTER_CSS = `
.pointer { position: absolute; width: 40px; height: 40px; opacity: 0; z-index: 5; }
`;

const generic = (name: string, about: string, size: UiSize, css: string, js: string) => piece(name, about, size, POINTER_CSS + css, POINTER + js);

const SIDEBAR = generic(
  'UiSidebar',
  'An app shell: the sidebar nav slides in item by item, the active highlight walks down to the chosen item, the content rows fill in. Params brand, items (one per line), active (index from 0), title.',
  { width: 1400, height: 800 },
  `
.shell { position: absolute; width: 1400px; height: 800px; transform: translate(-50%, -50%); display: flex; overflow: hidden; }
.side { width: 300px; border-right: 1px solid var(--line); padding: 30px 20px; position: relative; }
.brand { font-size: 28px; font-weight: 800; margin: 0 14px 30px; }
.nav { position: relative; height: 58px; display: flex; align-items: center; padding: 0 18px; font-size: 23px; font-weight: 500; z-index: 1; }
.glow { position: absolute; left: 20px; right: 20px; height: 58px; border-radius: calc(var(--r) * 0.7); background: color-mix(in srgb, var(--accent) 16%, transparent); }
.main { flex: 1; padding: 44px 52px; }
.title { font-size: 40px; font-weight: 700; margin-bottom: 30px; }
.bar { height: 64px; border: 1px solid var(--line); border-radius: calc(var(--r) * 0.7); margin-bottom: 16px; display: flex; align-items: center; gap: 18px; padding: 0 22px; }
.chip { width: 30px; height: 30px; border-radius: 50%; background: var(--accent); }
.stroke { height: 14px; border-radius: 7px; background: var(--line); }
`,
  `
const brand = param('brand', 'Acme', { type: 'text', group: 'Content' });
const items = param('items', 'Home\\nProjects\\nAnalytics\\nTeam\\nSettings', { type: 'textarea', group: 'Content' });
const active = param('active', 2, { type: 'number', min: 0, max: 12, group: 'Content' });
const title = param('title', 'Analytics', { type: 'text', group: 'Content' });
const shell = make('div', 'card shell');
const side = make('div', 'side', shell);
make('div', 'brand', side, brand);
const glow = make('div', 'glow', side);
const navs = rows(items).map((r) => make('div', 'nav', side, r[0]));
const main = make('div', 'main', shell);
const head = make('div', 'title', main, title);
const bars = [0.62, 0.48, 0.71, 0.4, 0.55].map((w) => {
  const b = make('div', 'bar', main);
  make('div', 'chip', b);
  make('div', 'stroke', b).style.width = Math.round(w * 100) + '%';
  return b;
});
const target = Math.min(navs.length - 1, Math.max(0, Math.round(active)));
drive((t) => {
  navs.forEach((n, i) => {
    const p = out(span(t, 0.1 + i * 0.08, 0.4));
    n.style.opacity = String(p);
    n.style.transform = 'translateX(' + (-30 * (1 - p)) + 'px)';
    n.style.color = i === target && t > 1.2 / speed ? accent : ink;
  });
  const walk = inOut(span(t, 0.6, 0.6));
  glow.style.top = (86 + 58 * target * walk) + 'px';
  glow.style.opacity = String(span(t, 0.5, 0.2));
  rise(head, out(span(t, 1.1, 0.4)), 20);
  bars.forEach((b, i) => rise(b, out(span(t, 1.3 + i * 0.1, 0.4)), 24));
});
`
);

const HERO = generic(
  'UiHero',
  'A landing page hero: the kicker fades in, the headline lands word by word, the subline follows, the call-to-action button pops and a cursor clicks it. Params kicker, headline, sub, cta.',
  { width: 1400, height: 680 },
  `
.hero { position: absolute; width: 1400px; height: 680px; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 90px; }
.kicker { font-size: 22px; font-weight: 600; color: var(--accent); padding: 8px 18px; border: 1px solid var(--line); border-radius: 999px; margin-bottom: 30px; }
.headline { font-size: 82px; font-weight: 800; letter-spacing: -0.035em; line-height: 1.05; }
.word { display: inline-block; margin: 0 0.12em; }
.sub { font-size: 28px; margin-top: 26px; max-width: 900px; }
.cta { margin-top: 40px; padding: 22px 40px; font-size: 26px; font-weight: 700; background: var(--accent); color: #fff; border-radius: calc(var(--r) * 0.7); position: relative; }
`,
  `
const kicker = param('kicker', 'New', { type: 'text', group: 'Content' });
const headline = param('headline', 'Ship your site in minutes', { type: 'text', group: 'Content' });
const sub = param('sub', 'Describe it, see it, publish it.', { type: 'text', group: 'Content' });
const cta = param('cta', 'Get started', { type: 'text', group: 'Content' });
const hero = make('div', 'card hero');
const kick = make('div', 'kicker', hero, kicker);
const h = make('div', 'headline', hero);
const words = String(headline).split(' ').map((w) => make('span', 'word', h, w));
const s = make('div', 'sub muted', hero, sub);
const button = make('div', 'cta', hero, cta);
const cursor = pointer(hero);
const CLICK = 1.3 + words.length * 0.12;
drive((t) => {
  rise(kick, out(span(t, 0.1, 0.4)), 16);
  words.forEach((w, i) => {
    const p = out(span(t, 0.3 + i * 0.12, 0.4));
    w.style.opacity = String(p);
    w.style.transform = 'translateY(' + (40 * (1 - p)) + 'px) scale(' + (1.25 - 0.25 * p) + ')';
  });
  rise(s, out(span(t, 0.5 + words.length * 0.12, 0.4)), 16);
  const pop = out(span(t, 0.8 + words.length * 0.12, 0.35));
  button.style.opacity = String(pop);
  button.style.transform = 'scale(' + ((0.8 + 0.2 * pop) * (1 - 0.06 * press(t, CLICK))) + ')';
  glide(cursor, [1100, 640], [760, 590], CLICK - 0.5, 0.45, t);
});
`
);

const PROMPT_BOX = generic(
  'UiPromptBox',
  'A form or prompt box: the request types itself into the field, a cursor presses send, a progress line runs and a done state appears. Params label, prompt, button, done.',
  { width: 1240, height: 400 },
  `
.box { position: absolute; width: 1240px; transform: translate(-50%, -50%); padding: 36px 40px; }
.label { font-size: 22px; font-weight: 600; margin-bottom: 16px; }
.field { min-height: 130px; border: 1.5px solid var(--line); border-radius: calc(var(--r) * 0.8); padding: 22px 24px; font-size: 30px; line-height: 1.35; position: relative; }
.caret { display: inline-block; width: 2px; height: 34px; background: var(--accent); vertical-align: middle; margin-left: 2px; }
.send { position: absolute; right: 18px; bottom: 18px; width: 64px; height: 64px; border-radius: calc(var(--r) * 0.7); background: var(--accent); display: flex; align-items: center; justify-content: center; }
.track { height: 6px; border-radius: 3px; background: var(--line); margin-top: 22px; overflow: hidden; }
.run { height: 100%; background: var(--accent); }
.done { margin-top: 16px; font-size: 24px; font-weight: 600; display: flex; align-items: center; gap: 12px; }
.tick { width: 34px; height: 34px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; }
`,
  `
const label = param('label', 'What do you want to change?', { type: 'text', group: 'Content' });
const prompt = param('prompt', 'Make the pricing page dark and add a yearly plan', { type: 'textarea', group: 'Content' });
const doneText = param('done', 'Done in 4 seconds', { type: 'text', group: 'Content' });
const box = make('div', 'card box');
make('div', 'label', box, label);
const field = make('div', 'field', box);
const typed = make('span', '', field);
const caret = make('span', 'caret', field);
const send = make('div', 'send', field);
send.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 12h12M12 6l6 6-6 6" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>';
const run = make('div', 'run', make('div', 'track', box));
const done = make('div', 'done', box);
make('div', 'tick', done, '✓');
make('div', '', done, doneText);
const cursor = pointer(box);
const TYPE_LEN = Math.min(1.8, duration * 0.4);
const CLICK = 0.2 + TYPE_LEN + 0.45;
drive((t) => {
  const typing = span(t, 0.2, TYPE_LEN);
  typed.textContent = String(prompt).slice(0, Math.round(String(prompt).length * typing));
  caret.style.opacity = typing < 1 || Math.floor(t * 2.5) % 2 === 0 ? '1' : '0';
  glide(cursor, [900, 380], [1150, 200], CLICK - 0.5, 0.45, t);
  send.style.transform = 'scale(' + (1 - 0.1 * press(t, CLICK)) + ')';
  run.style.width = (100 * inOut(span(t, CLICK + 0.1, 0.8))) + '%';
  rise(done, out(span(t, CLICK + 0.9, 0.35)), 14);
});
`
);

const EDITOR_CANVAS = generic(
  'UiEditorCanvas',
  'A design or page editor: toolbar on top, blocks drop onto the canvas one by one, a selection box wraps one block and the cursor drags it into place. Params title, blocks (one label per line).',
  { width: 1440, height: 840 },
  `
.editor { position: absolute; width: 1440px; height: 840px; transform: translate(-50%, -50%); overflow: hidden; }
.tools { height: 70px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 14px; padding: 0 24px; font-size: 22px; font-weight: 600; }
.tool { width: 40px; height: 40px; border-radius: calc(var(--r) * 0.5); border: 1px solid var(--line); }
.tool.on { background: var(--accent); border-color: var(--accent); }
.board { position: absolute; left: 40px; right: 40px; top: 110px; bottom: 40px; background-image: radial-gradient(var(--line) 1.5px, transparent 1.5px); background-size: 28px 28px; }
.block { position: absolute; border-radius: calc(var(--r) * 0.6); background: var(--paper); border: 1px solid var(--line); box-shadow: 0 10px 30px rgba(0,0,0,0.08); font-size: 24px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.block.hot { background: color-mix(in srgb, var(--accent) 14%, var(--paper)); }
.select { position: absolute; border: 2.5px solid var(--accent); }
`,
  `
const title = param('title', 'Landing page', { type: 'text', group: 'Content' });
const blocks = param('blocks', 'Header\\nHero\\nFeatures\\nPricing\\nFooter', { type: 'textarea', group: 'Content' });
const editor = make('div', 'card editor');
const bar = make('div', 'tools', editor);
['on', '', '', ''].forEach((c) => make('div', 'tool ' + c, bar));
make('div', 'muted', bar, title).style.marginLeft = '18px';
const board = make('div', 'board', editor);
const SLOTS = [[30, 30, 1300, 80], [30, 140, 760, 300], [820, 140, 510, 300], [30, 470, 640, 170], [700, 470, 630, 170]];
const placed = rows(blocks).slice(0, SLOTS.length).map((r, i) => {
  const b = make('div', 'block' + (i === 1 ? ' hot' : ''), board, r[0]);
  const [x, y, w, h] = SLOTS[i];
  Object.assign(b.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  return b;
});
const sel = make('div', 'select', board);
const cursor = pointer(board);
const GRAB = 0.4 + placed.length * 0.15 + 0.3;
drive((t) => {
  placed.forEach((b, i) => {
    const p = out(span(t, 0.2 + i * 0.15, 0.4));
    b.style.opacity = String(p);
    b.style.transform = 'scale(' + (0.9 + 0.1 * p) + ')';
  });
  const drag = inOut(span(t, GRAB + 0.3, 0.7));
  const hot = placed[1];
  if (hot) {
    hot.style.transform = 'translate(' + (40 * drag) + 'px, ' + (-20 * drag) + 'px)';
    sel.style.left = (26 + 40 * drag) + 'px';
    sel.style.top = (136 - 20 * drag) + 'px';
    sel.style.width = '768px';
    sel.style.height = '308px';
  }
  sel.style.opacity = String(span(t, GRAB, 0.15));
  glide(cursor, [1000, 600], [420 + 40 * drag, 290 - 20 * drag], GRAB - 0.5, 0.5, t);
});
`
);

const CARD_GRID = generic(
  'UiCardGrid',
  'A grid of cards (projects, templates, products) arriving in a stagger, each with an accent thumbnail, title and subtitle; one card lifts as the cursor hovers it. Params cards: one per line "title|subtitle".',
  { width: 1440, height: 800 },
  `
.grid { position: absolute; width: 1440px; transform: translate(-50%, -50%); display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.tile { overflow: hidden; }
.thumb { height: 190px; }
.meta { padding: 20px 24px; }
.name { font-size: 26px; font-weight: 700; }
.note { font-size: 20px; margin-top: 4px; }
`,
  `
const cards = param('cards', 'Portfolio|Updated 2 min ago\\nShop|12 pages\\nBlog|Draft\\nDocs|Published\\nLanding|A/B test\\nEvents|Scheduled', { type: 'textarea', group: 'Content' });
const grid = make('div', 'grid');
const tiles = rows(cards).slice(0, 6).map((r, i) => {
  const tile = make('div', 'card tile', grid);
  const thumb = make('div', 'thumb', tile);
  thumb.style.background = 'linear-gradient(135deg, ' + accent + ', color-mix(in srgb, ' + accent + ' ' + (30 + i * 10) + '%, ' + paper + '))';
  const meta = make('div', 'meta', tile);
  make('div', 'name', meta, r[0]);
  make('div', 'note muted', meta, r[1] || '');
  return tile;
});
const cursor = pointer(grid);
const HOVER = 0.3 + tiles.length * 0.1 + 0.4;
drive((t) => {
  tiles.forEach((tile, i) => {
    const p = out(span(t, 0.2 + i * 0.1, 0.45));
    const lift = i === 1 ? inOut(span(t, HOVER, 0.3)) : 0;
    tile.style.opacity = String(p);
    tile.style.transform = 'translateY(' + (40 * (1 - p) - 12 * lift) + 'px) scale(' + (1 + 0.03 * lift) + ')';
  });
  glide(cursor, [1300, 760], [720, 200], HOVER - 0.5, 0.5, t);
});
`
);

const PRICING = generic(
  'UiPricing',
  'A pricing table: plan cards rise in, prices count up, the featured plan lifts with an accent border and the cursor clicks its button. Params plans: one per line "name|price|feature; feature; feature", featured (index from 0), cta.',
  { width: 1440, height: 760 },
  `
.plans { position: absolute; width: 1440px; transform: translate(-50%, -50%); display: flex; gap: 28px; align-items: stretch; }
.plan { flex: 1; padding: 36px 34px; display: flex; flex-direction: column; gap: 14px; position: relative; }
.plan.top { border: 2.5px solid var(--accent); }
.pname { font-size: 26px; font-weight: 700; }
.price { font-size: 68px; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.feat { font-size: 21px; display: flex; gap: 10px; }
.feat b { color: var(--accent); }
.buy { margin-top: auto; text-align: center; padding: 18px; font-size: 22px; font-weight: 700; border-radius: calc(var(--r) * 0.7); border: 1.5px solid var(--line); }
.plan.top .buy { background: var(--accent); color: #fff; border-color: var(--accent); }
`,
  `
const plans = param('plans', 'Free|$0|1 site; Subdomain; Community support\\nPro|$12|Unlimited sites; Custom domain; AI edits\\nTeam|$39|Everything in Pro; Roles; Priority support', { type: 'textarea', group: 'Content' });
const featured = param('featured', 1, { type: 'number', min: 0, max: 3, group: 'Content' });
const cta = param('cta', 'Choose plan', { type: 'text', group: 'Content' });
const wrap = make('div', 'plans');
const top = Math.round(featured);
const cards = rows(plans).slice(0, 4).map((r, i) => {
  const plan = make('div', 'card plan' + (i === top ? ' top' : ''), wrap);
  make('div', 'pname', plan, r[0]);
  const price = make('div', 'price', plan);
  String(r[2] || '').split(';').filter((f) => f.trim()).forEach((f) => {
    const row = make('div', 'feat', plan);
    make('b', '', row, '✓');
    make('span', 'muted', row, f.trim());
  });
  const buy = make('div', 'buy', plan, cta);
  return { plan, price, buy, n: number(r[1] || '0') };
});
const cursor = pointer(wrap);
const CLICK = 0.4 + cards.length * 0.15 + 1;
drive((t) => {
  cards.forEach((c, i) => {
    const p = out(span(t, 0.2 + i * 0.15, 0.45));
    const lift = i === top ? out(span(t, 1, 0.4)) : 0;
    c.plan.style.opacity = String(p);
    c.plan.style.transform = 'translateY(' + (50 * (1 - p) - 18 * lift) + 'px) scale(' + (1 + 0.04 * lift) + ')';
    c.price.textContent = counted(c.n, out(span(t, 0.3 + i * 0.15, 1)));
    c.buy.style.transform = i === top ? 'scale(' + (1 - 0.06 * press(t, CLICK)) + ')' : '';
  });
  glide(cursor, [1300, 760], [720, 660], CLICK - 0.5, 0.45, t);
});
`
);

const CHAT = generic(
  'UiChat',
  'A chat with an assistant: messages arrive in turn, the user bubble on the right, the assistant reply showing typing dots then writing itself. Params title, messages: one per line "user|text" or "bot|text".',
  { width: 1000, height: 800 },
  `
.chat { position: absolute; width: 1000px; height: 800px; transform: translate(-50%, -50%); display: flex; flex-direction: column; overflow: hidden; }
.top { padding: 24px 30px; border-bottom: 1px solid var(--line); font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 14px; }
.avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--accent); }
.feed { flex: 1; padding: 30px; display: flex; flex-direction: column; gap: 18px; }
.msg { max-width: 72%; padding: 18px 22px; font-size: 25px; line-height: 1.35; border-radius: calc(var(--r) * 0.9); }
.msg.user { align-self: flex-end; background: var(--accent); color: #fff; }
.msg.bot { align-self: flex-start; background: color-mix(in srgb, var(--line) 60%, var(--paper)); }
`,
  `
const title = param('title', 'Assistant', { type: 'text', group: 'Content' });
const messages = param('messages', 'user|Add a contact form to my homepage\\nbot|Done. The form is live under the hero, and replies go to your inbox.\\nuser|Make the button orange', { type: 'textarea', group: 'Content' });
const chat = make('div', 'card chat');
const top = make('div', 'top', chat);
make('div', 'avatar', top);
make('div', '', top, title);
const feed = make('div', 'feed', chat);
let at = 0.2;
const turns = rows(messages).slice(0, 6).map((r) => {
  const bot = r[0] === 'bot';
  const text = r[1] || '';
  const msg = make('div', 'msg ' + (bot ? 'bot' : 'user'), feed);
  const turn = { msg, text, bot, at: at + (bot ? 0.5 : 0) };
  at = turn.at + (bot ? Math.min(1.2, text.length * 0.02) : 0.3) + 0.35;
  return turn;
});
drive((t) => {
  turns.forEach((m) => {
    const shownAt = m.bot ? m.at - 0.5 : m.at;
    rise(m.msg, out(span(t, shownAt, 0.3)), 18);
    const typing = m.bot ? span(t, m.at, Math.min(1.2, m.text.length * 0.02)) : 1;
    m.msg.textContent = typing > 0 ? m.text.slice(0, Math.round(m.text.length * typing)) : '•••';
  });
});
`
);

const MODAL = generic(
  'UiModal',
  'A modal dialog: the page dims, the dialog scales in with its title and body, the cursor clicks confirm and it turns into a success state. Params title, body, confirm, cancel, success.',
  { width: 1300, height: 760 },
  `
.page { position: absolute; width: 1300px; height: 760px; transform: translate(-50%, -50%); overflow: hidden; }
.ghost { margin: 40px; height: 120px; border-radius: var(--r); background: color-mix(in srgb, var(--line) 50%, transparent); }
.dim { position: absolute; inset: 0; background: rgba(0,0,0,0.45); }
.dialog { position: absolute; left: 50%; top: 50%; width: 700px; padding: 40px; margin-left: -350px; margin-top: -190px; }
.dtitle { font-size: 34px; font-weight: 700; }
.dbody { font-size: 23px; margin-top: 14px; line-height: 1.4; }
.actions { display: flex; justify-content: flex-end; gap: 14px; margin-top: 34px; }
.btn { padding: 16px 28px; font-size: 22px; font-weight: 600; border-radius: calc(var(--r) * 0.7); border: 1.5px solid var(--line); }
.btn.go { background: var(--accent); color: #fff; border-color: var(--accent); }
`,
  `
const title = param('title', 'Publish your site?', { type: 'text', group: 'Content' });
const body = param('body', 'Your changes go live on your domain right away.', { type: 'textarea', group: 'Content' });
const confirm = param('confirm', 'Publish', { type: 'text', group: 'Content' });
const cancel = param('cancel', 'Cancel', { type: 'text', group: 'Content' });
const success = param('success', 'Published ✓', { type: 'text', group: 'Content' });
const page = make('div', 'card page');
[0, 1, 2, 3].forEach(() => make('div', 'ghost', page));
const dim = make('div', 'dim', page);
const dialog = make('div', 'card dialog', page);
make('div', 'dtitle', dialog, title);
make('div', 'dbody muted', dialog, body);
const actions = make('div', 'actions', dialog);
make('div', 'btn', actions, cancel);
const go = make('div', 'btn go', actions, confirm);
const cursor = pointer(page);
const CLICK = 1.5;
drive((t) => {
  dim.style.opacity = String(out(span(t, 0.1, 0.3)));
  const p = out(span(t, 0.2, 0.4));
  dialog.style.opacity = String(p);
  dialog.style.transform = 'scale(' + (0.88 + 0.12 * p) + ')';
  glide(cursor, [1200, 720], [905, 520], CLICK - 0.5, 0.45, t);
  go.style.transform = 'scale(' + (1 - 0.06 * press(t, CLICK)) + ')';
  go.textContent = t >= (CLICK + 0.15) / speed ? success : confirm;
});
`
);

const TOGGLE = generic(
  'UiToggle',
  'A settings panel: rows appear and their switches flip on one after another, the knob sliding and the track filling with the accent. Params title, settings (one label per line).',
  { width: 1000, height: 560 },
  `
.panel { position: absolute; width: 1000px; transform: translate(-50%, -50%); padding: 34px 40px; }
.ptitle { font-size: 30px; font-weight: 700; margin-bottom: 14px; }
.set { display: flex; align-items: center; justify-content: space-between; padding: 20px 0; border-bottom: 1px solid var(--line); font-size: 25px; }
.set:last-child { border-bottom: 0; }
.track { width: 80px; height: 44px; border-radius: 22px; position: relative; }
.knob { position: absolute; top: 4px; width: 36px; height: 36px; border-radius: 50%; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.25); }
`,
  `
const title = param('title', 'Settings', { type: 'text', group: 'Content' });
const settings = param('settings', 'Auto-publish\\nDark mode\\nAnalytics\\nCustom domain', { type: 'textarea', group: 'Content' });
const panel = make('div', 'card panel');
make('div', 'ptitle', panel, title);
const switches = rows(settings).slice(0, 6).map((r) => {
  const set = make('div', 'set', panel);
  make('div', '', set, r[0]);
  const track = make('div', 'track', set);
  return { set, track, knob: make('div', 'knob', track) };
});
drive((t) => {
  switches.forEach((s, i) => {
    rise(s.set, out(span(t, 0.1 + i * 0.1, 0.4)), 16);
    const on = inOut(span(t, 0.8 + i * 0.3, 0.25));
    s.knob.style.left = (4 + 36 * on) + 'px';
    s.track.style.background = 'color-mix(in srgb, ' + accent + ' ' + Math.round(on * 100) + '%, ' + line + ')';
  });
});
`
);

const UPLOAD = generic(
  'UiUpload',
  'An upload: a file card drops into the dashed zone, its progress bar fills while the percentage counts, then it turns to a check. Params label, file, size, done.',
  { width: 1100, height: 600 },
  `
.zone { position: absolute; width: 1100px; transform: translate(-50%, -50%); padding: 36px; }
.drop { height: 220px; border: 2.5px dashed var(--line); border-radius: var(--r); display: flex; align-items: center; justify-content: center; font-size: 25px; }
.file { margin-top: 24px; display: flex; align-items: center; gap: 20px; padding: 20px 24px; border: 1px solid var(--line); border-radius: calc(var(--r) * 0.8); }
.icon { width: 56px; height: 66px; border-radius: 8px; background: color-mix(in srgb, var(--accent) 18%, var(--paper)); border: 2px solid var(--accent); }
.info { flex: 1; }
.fname { font-size: 24px; font-weight: 700; }
.bar { height: 10px; border-radius: 5px; background: var(--line); margin-top: 12px; overflow: hidden; }
.fill { height: 100%; background: var(--accent); }
.pct { width: 110px; text-align: right; font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
`,
  `
const label = param('label', 'Drop your files here', { type: 'text', group: 'Content' });
const file = param('file', 'brand-assets.zip', { type: 'text', group: 'Content' });
const size = param('size', '24 MB', { type: 'text', group: 'Content' });
const doneText = param('done', 'Uploaded', { type: 'text', group: 'Content' });
const zone = make('div', 'card zone');
const drop = make('div', 'drop muted', zone, label);
const card = make('div', 'file', zone);
make('div', 'icon', card);
const info = make('div', 'info', card);
make('div', 'fname', info, file);
const status = make('div', 'muted', info, size);
const fill = make('div', 'fill', make('div', 'bar', info));
const pct = make('div', 'pct', card);
const total = number('100%');
drive((t) => {
  const land = out(span(t, 0.2, 0.5));
  card.style.opacity = String(land);
  card.style.transform = 'translateY(' + (-160 * (1 - land)) + 'px) rotate(' + (-4 * (1 - land)) + 'deg)';
  drop.style.borderColor = land > 0 && land < 1 ? accent : line;
  const p = inOut(span(t, 0.7, 1.6));
  fill.style.width = (100 * p) + '%';
  pct.textContent = p < 1 ? counted(total, p) : '✓';
  pct.style.color = p < 1 ? ink : accent;
  status.textContent = p < 1 ? size : doneText;
});
`
);

const GENERATED_RESULT = generic(
  'UiGeneratedResult',
  'An AI result appearing: a skeleton card shimmers, then the picture block fills with the accent, the title and lines write themselves and a "Generated" badge pops. Params badge, title, lines (one per line).',
  { width: 1200, height: 720 },
  `
.result { position: absolute; width: 1200px; transform: translate(-50%, -50%); padding: 34px; display: grid; grid-template-columns: 460px 1fr; gap: 34px; overflow: hidden; }
.pic { height: 460px; border-radius: calc(var(--r) * 0.8); background: color-mix(in srgb, var(--line) 60%, var(--paper)); position: relative; overflow: hidden; }
.paint { position: absolute; inset: 0; }
.sheen { position: absolute; top: 0; bottom: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent); }
.badge { justify-self: start; font-size: 19px; font-weight: 700; color: var(--accent); padding: 6px 14px; border: 1.5px solid var(--accent); border-radius: 999px; }
.rtitle { font-size: 44px; font-weight: 800; letter-spacing: -0.02em; margin: 18px 0 14px; min-height: 54px; }
.rline { font-size: 24px; line-height: 1.5; min-height: 36px; }
`,
  `
const badge = param('badge', 'Generated', { type: 'text', group: 'Content' });
const title = param('title', 'Your new homepage', { type: 'text', group: 'Content' });
const lines = param('lines', 'Hero with your headline and photo\\nThree features in your words\\nContact form wired to your inbox', { type: 'textarea', group: 'Content' });
const result = make('div', 'card result');
const pic = make('div', 'pic', result);
const paint = make('div', 'paint', pic);
paint.style.background = 'linear-gradient(160deg, ' + accent + ', color-mix(in srgb, ' + accent + ' 35%, ' + paper + '))';
const sheen = make('div', 'sheen', pic);
const copy = make('div', '', result);
const tag = make('div', 'badge', copy, badge);
const head = make('div', 'rtitle', copy);
const body = rows(lines).slice(0, 5).map((r) => ({ node: make('div', 'rline muted', copy), text: r[0] }));
drive((t) => {
  sheen.style.left = (-40 + 180 * ((t * speed * 0.9) % 1)) + '%';
  sheen.style.opacity = String(1 - span(t, 1, 0.3));
  const fillIn = inOut(span(t, 0.8, 0.6));
  paint.style.clipPath = 'inset(' + (100 * (1 - fillIn)) + '% 0 0 0)';
  head.textContent = String(title).slice(0, Math.round(String(title).length * span(t, 1, 0.6)));
  body.forEach((b, i) => {
    b.node.textContent = b.text.slice(0, Math.round(b.text.length * span(t, 1.5 + i * 0.35, 0.4)));
  });
  const pop = out(span(t, 1.4, 0.3));
  tag.style.opacity = String(pop);
  tag.style.transform = 'scale(' + (0.7 + 0.3 * pop) + ')';
});
`
);

const CURSOR = generic(
  'UiCursor',
  'A lone cursor to lay over any UI clip: it glides through the points on a smooth ease and clicks at each with a ripple in the accent. Param path: one point per line "x|y" as shares of the frame (0..1).',
  { width: 1600, height: 900 },
  `
.layer { position: absolute; width: 1600px; height: 900px; transform: translate(-50%, -50%); }
.ripple { position: absolute; width: 80px; height: 80px; margin: -40px 0 0 -40px; border-radius: 50%; border: 3px solid var(--accent); opacity: 0; }
`,
  `
const path = param('path', '0.7|0.8\\n0.45|0.4\\n0.6|0.55', { type: 'textarea', group: 'Content' });
const layer = make('div', 'layer');
const points = rows(path).map((r) => [Number(r[0]) * 1600, Number(r[1] || 0) * 900]);
const ripple = make('div', 'ripple', layer);
const cursor = pointer(layer);
const LEG = Math.max(0.4, (duration * speed - 0.4) / Math.max(1, points.length));
drive((t) => {
  const leg = Math.min(points.length - 1, Math.floor((t * speed) / LEG));
  const from = points[Math.max(0, leg - 1)] || [800, 450];
  const to = points[Math.max(0, leg)] || [800, 450];
  glide(cursor, from, to, Math.max(0, leg - 1) * LEG + 0.2, LEG * 0.6, t);
  if (leg === 0) {
    cursor.style.left = to[0] + 'px';
    cursor.style.top = to[1] + 'px';
  }
  cursor.style.opacity = '1';
  const click = (Math.max(0, leg - 1) * LEG + 0.2 + LEG * 0.6);
  const r = span(t, click, 0.4);
  ripple.style.left = to[0] + 'px';
  ripple.style.top = to[1] + 'px';
  ripple.style.opacity = String(r > 0 && r < 1 ? 1 - r : 0);
  ripple.style.transform = 'scale(' + (0.3 + r) + ')';
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
  [UiKind.Window]: WINDOW,
  [UiKind.Sidebar]: SIDEBAR,
  [UiKind.Hero]: HERO,
  [UiKind.PromptBox]: PROMPT_BOX,
  [UiKind.EditorCanvas]: EDITOR_CANVAS,
  [UiKind.CardGrid]: CARD_GRID,
  [UiKind.Pricing]: PRICING,
  [UiKind.Chat]: CHAT,
  [UiKind.Modal]: MODAL,
  [UiKind.Toggle]: TOGGLE,
  [UiKind.Upload]: UPLOAD,
  [UiKind.GeneratedResult]: GENERATED_RESULT,
  [UiKind.Cursor]: CURSOR
};

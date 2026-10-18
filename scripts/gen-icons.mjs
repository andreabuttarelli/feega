import fs from 'node:fs';
import path from 'node:path';

const [, , iconsDir, outFile] = process.argv;
const NAMES = ['arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'arrow-up-right', 'chevron-right', 'chevron-left', 'chevron-up', 'chevron-down', 'check', 'x', 'plus', 'minus', 'menu', 'search', 'user', 'users', 'star', 'heart', 'play', 'pause', 'shopping-cart', 'shopping-bag', 'home', 'settings', 'bell', 'mail', 'phone', 'calendar', 'clock', 'camera', 'image', 'video', 'music', 'mic', 'volume-2', 'lock', 'unlock', 'eye', 'download', 'upload', 'share-2', 'link', 'trash-2', 'pencil', 'copy', 'filter', 'globe', 'map-pin', 'message-circle', 'send', 'bookmark', 'zap', 'sun', 'moon', 'cloud', 'credit-card', 'gift', 'tag', 'thumbs-up', 'info', 'circle-alert', 'circle-check', 'refresh-cw', 'log-out', 'external-link', 'sparkles', 'grid-3x3', 'list', 'more-horizontal', 'file', 'folder'];

const S = 1 / 24;
const r4 = (n) => String(Math.round(n * S * 10000) / 10000);
const pt = (x, y) => `${r4(x)} ${r4(y)}`;

function arcToCubics(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];
  const rad = (phi * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sign = fa === fs ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  const segs = Math.ceil(Math.abs(dt) / (Math.PI / 2));
  const d = dt / segs, k = (4 / 3) * Math.tan(d / 4);
  const out = [];
  const at = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const der = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  for (let i = 0; i < segs; i++) {
    const a = t1 + i * d, b = a + d;
    const p0 = at(a), p1 = at(b), d0 = der(a), d1 = der(b);
    out.push([p0[0] + k * d0[0], p0[1] + k * d0[1], p1[0] - k * d1[0], p1[1] - k * d1[1], p1[0], p1[1]]);
  }
  return out;
}

function convertPath(d) {
  const toks = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g);
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null;
  const out = [];
  const n = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    let nlc = null, nlq = null;
    if (C === 'M') { x = ox + n(); y = oy + n(); sx = x; sy = y; out.push(`M${pt(x, y)}`); cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') { x = ox + n(); y = oy + n(); out.push(`L${pt(x, y)}`); }
    else if (C === 'H') { x = ox + n(); out.push(`L${pt(x, y)}`); }
    else if (C === 'V') { y = (rel ? y : 0) + n(); out.push(`L${pt(x, y)}`); }
    else if (C === 'C') { const a = [ox + n(), oy + n(), ox + n(), oy + n(), ox + n(), oy + n()]; out.push(`C${pt(a[0], a[1])} ${pt(a[2], a[3])} ${pt(a[4], a[5])}`); nlc = [a[2], a[3]]; x = a[4]; y = a[5]; }
    else if (C === 'S') { const c1 = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y]; const a = [ox + n(), oy + n(), ox + n(), oy + n()]; out.push(`C${pt(c1[0], c1[1])} ${pt(a[0], a[1])} ${pt(a[2], a[3])}`); nlc = [a[0], a[1]]; x = a[2]; y = a[3]; }
    else if (C === 'Q' || C === 'T') {
      const q = C === 'Q' ? [ox + n(), oy + n()] : lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y];
      const e = [ox + n(), oy + n()];
      out.push(`C${pt(x + (2 / 3) * (q[0] - x), y + (2 / 3) * (q[1] - y))} ${pt(e[0] + (2 / 3) * (q[0] - e[0]), e[1] + (2 / 3) * (q[1] - e[1]))} ${pt(e[0], e[1])}`);
      nlq = q; x = e[0]; y = e[1];
    }
    else if (C === 'A') {
      const [rx, ry, phi, fa, fsw] = [n(), n(), n(), n(), n()];
      const ex = ox + n(), ey = oy + n();
      for (const c of arcToCubics(x, y, rx, ry, phi, fa, fsw, ex, ey)) out.push(`C${pt(c[0], c[1])} ${pt(c[2], c[3])} ${pt(c[4], c[5])}`);
      x = ex; y = ey;
    }
    else if (C === 'Z') { out.push('Z'); x = sx; y = sy; }
    else throw new Error(`unknown ${cmd}`);
    lc = nlc; lq = nlq;
  }
  return out.join('');
}

const circle = (cx, cy, rx, ry) => `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;

function elementPath([tag, a]) {
  const f = (k, d = 0) => (a[k] === undefined ? d : Number(a[k]));
  if (tag === 'path') return a.d;
  if (tag === 'circle') return circle(f('cx'), f('cy'), f('r'), f('r'));
  if (tag === 'ellipse') return circle(f('cx'), f('cy'), f('rx'), f('ry'));
  if (tag === 'line') return `M${f('x1')} ${f('y1')}L${f('x2')} ${f('y2')}`;
  if (tag === 'polyline' || tag === 'polygon') { const p = a.points.trim().split(/[\s,]+/).map(Number); let s = `M${p[0]} ${p[1]}`; for (let j = 2; j < p.length; j += 2) s += `L${p[j]} ${p[j + 1]}`; return tag === 'polygon' ? `${s}Z` : s; }
  if (tag === 'rect') {
    const x = f('x'), y = f('y'), w = f('width'), h = f('height'), r = Math.min(f('rx', f('ry')), w / 2, h / 2);
    if (!r) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
    return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  }
  throw new Error(`tag ${tag}`);
}

const ALIAS = { x: 'close', 'home': 'home', 'more-horizontal': 'more', 'circle-alert': 'alert', 'circle-check': 'check-circle', 'grid-3x3': 'grid', 'volume-2': 'volume', 'share-2': 'share', 'trash-2': 'trash', 'shopping-cart': 'cart', 'shopping-bag': 'bag', 'message-circle': 'message', 'refresh-cw': 'refresh', 'map-pin': 'pin' };
const FILE_ALIAS = { home: 'house', 'more-horizontal': 'ellipsis', 'grid-3x3': 'grid-3x3', filter: 'funnel', unlock: 'lock-open' };

const rows = [];
for (const name of NAMES) {
  let file = path.join(iconsDir, `${name}.svelte`);
  if (!fs.existsSync(file)) file = path.join(iconsDir, `${FILE_ALIAS[name] ?? name}.svelte`);
  const src = fs.readFileSync(file, 'utf8');
  const node = JSON.parse(src.match(/const iconNode = (\[.*\]);/)[1]);
  rows.push(`  '${ALIAS[name] ?? name}': '${node.map((e) => convertPath(elementPath(e))).join('')}'`);
}
fs.writeFileSync(outFile, `export const ICON_PATHS: Record<string, string> = {\n${rows.join(',\n')}\n};\n`);
console.log(rows.length);

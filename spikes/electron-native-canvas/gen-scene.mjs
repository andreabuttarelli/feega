// ponytail: throwaway spike generator. Writes a gpu-core scene: groups (DisplayList per frame),
// uses (top-level placements), images (clip -> file), motion (animated uses).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire('/Users/andreabuttarelli/Documents/GitHub/feega/package.json');
const opentype = require('opentype.js');

const out = process.argv[2];
mkdirSync(join(out, 'images'), { recursive: true });
const SAMPLES = '/Users/andreabuttarelli/Documents/GitHub/feega/static/component-previews/samples';
const photos = readdirSync(SAMPLES).filter((f) => f.endsWith('.jpg'));
photos.forEach((f) => copyFileSync(join(SAMPLES, f), join(out, 'images', f)));

const FONTS = {
  regular: opentype.loadSync('/System/Library/Fonts/Supplemental/Arial.ttf'),
  bold: opentype.loadSync('/System/Library/Fonts/Supplemental/Arial Bold.ttf'),
  black: opentype.loadSync('/System/Library/Fonts/Supplemental/Arial Black.ttf'),
  serif: opentype.loadSync('/System/Library/Fonts/Supplemental/Georgia.ttf')
};

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const hex = (h, a = 1) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, a];
const I = [1, 0, 0, 1, 0, 0];
let clipN = 0;
const clip = (p) => `${p}${clipN++}`;
const images = {};
let nodes = 0;

const solid = (c) => ({ kind: 'solid', color: c });
const path = (contours, color, opacity = 1) => {
  nodes++;
  return { kind: 'path', clip: clip('p'), contours: contours.map((c) => c.map((v) => Math.round(v * 10) / 10)), rule: 'nonzero', paint: solid(color), opacity, matrix: I, blend: 'normal' };
};

function rrect(x, y, w, h, r = 0) {
  if (r <= 0) return [x, y, x + w, y, x + w, y + h, x, y + h];
  r = Math.min(r, w / 2, h / 2);
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return pts;
}
const circle = (cx, cy, r) => Array.from({ length: 32 }, (_, i) => [cx + Math.cos((i / 32) * 2 * Math.PI) * r, cy + Math.sin((i / 32) * 2 * Math.PI) * r]).flat();
const rect = (x, y, w, h, color, r = 0) => path([rrect(x, y, w, h, r)], color);

function glyphContours(font, str, x, y, size) {
  const contours = [];
  let cur = [];
  let px = 0, py = 0;
  const SEG = 5;
  for (const c of font.getPath(str, x, y, size).commands) {
    if (c.type === 'M') {
      if (cur.length > 4) contours.push(cur);
      cur = [c.x, c.y];
    } else if (c.type === 'L') cur.push(c.x, c.y);
    else if (c.type === 'Q') {
      for (let i = 1; i <= SEG; i++) {
        const t = i / SEG, u = 1 - t;
        cur.push(u * u * px + 2 * u * t * c.x1 + t * t * c.x, u * u * py + 2 * u * t * c.y1 + t * t * c.y);
      }
    } else if (c.type === 'C') {
      for (let i = 1; i <= SEG; i++) {
        const t = i / SEG, u = 1 - t;
        cur.push(u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y);
      }
    } else if (c.type === 'Z') {
      if (cur.length > 4) contours.push(cur);
      cur = [];
    }
    if (c.x !== undefined) [px, py] = [c.x, c.y];
  }
  if (cur.length > 4) contours.push(cur);
  return contours;
}

// One path item per wrapped line; returns [items, height].
function text(str, x, y, size, color, { font = 'regular', width = 1e9, lh = 1.3, align = 'left' } = {}) {
  const f = FONTS[font];
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (f.getAdvanceWidth(t, size) > width && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  lines.push(line);
  const items = lines.map((l, i) => {
    const adv = f.getAdvanceWidth(l, size);
    const lx = align === 'center' ? x + (width - adv) / 2 : x;
    return path(glyphContours(f, l, lx, y + size + i * size * lh, size), color);
  });
  return [items, lines.length * size * lh];
}

function image(file, x, y, w, h, r = 0) {
  nodes++;
  const c = clip('img');
  images[c] = `images/${file}`;
  const it = { kind: 'image', clip: c, src: c, video: false, mediaTime: 0, size: { width: w, height: h }, fit: 'cover', focus: [0.5, 0.5], zoom: 1, clipped: true, inner: I, opacity: 1, matrix: [1, 0, 0, 1, x, y], blend: 'normal' };
  return it;
}

const BRANDS = ['Northwind', 'Lumen', 'Atlas Pay', 'Orbit CRM', 'Fernwood', 'Quanta', 'Helio', 'Driftwood', 'Kestrel', 'Monolith', 'Solace', 'Verdant', 'Arcadia', 'Pulse Health', 'Tidal', 'Cobalt'];
const PALETTES = [['#0f172a', '#6366f1', '#f8fafc'], ['#111827', '#f59e0b', '#fffbeb'], ['#052e16', '#22c55e', '#f0fdf4'], ['#1e1b4b', '#ec4899', '#fdf2f8'], ['#0c4a6e', '#38bdf8', '#f0f9ff'], ['#3f1d0b', '#fb923c', '#fff7ed'], ['#18181b', '#a3e635', '#fafafa'], ['#2e1065', '#a78bfa', '#faf5ff']];
const HEAD = ['Ship faster with less overhead', 'The calm way to run your money', 'Everything your team needs, in one place', 'Design, build and launch in days', 'Customer support that feels human', 'Analytics without the spreadsheets', 'Grow your store on autopilot', 'Health insights you can trust'];
const LOREM = 'Built for teams that care about craft. Connect your tools, automate the busywork and see every metric that matters in real time, with security you never have to think about again.';
const FEATS = ['Realtime sync', 'Smart automations', 'Bank-grade security', 'Instant reports', 'Global CDN', 'Team spaces', 'AI assistant', 'Open API', 'Audit logs'];
const QUOTES = ['It replaced four tools and our team finally works from the same page.', 'We cut onboarding time in half the first month we switched.', 'The fastest product I have used in years. Support is outstanding.'];
const NAMES = ['Maya Chen, Head of Ops at Brightline', 'Jonas Weber, CTO at Kiln', 'Sara Okafor, Founder of Loop'];

function landing(i) {
  const [dark, accent, light] = PALETTES[i % PALETTES.length].map((h) => hex(h));
  const brand = BRANDS[i % BRANDS.length];
  const W = 1440;
  const it = [];
  const push = (x) => (Array.isArray(x) ? it.push(...x) : it.push(x));
  let y = 0;
  // nav
  push(rect(0, 0, W, 80, dark));
  push(text(brand, 80, 22, 26, light, { font: 'black' })[0]);
  ['Product', 'Pricing', 'Customers', 'Docs', 'Blog'].forEach((n, k) => push(text(n, 560 + k * 120, 28, 17, hex('#cbd5e1'))[0]));
  push(rect(1200, 20, 160, 42, accent, 21));
  push(text('Get started', 1200, 31, 16, dark, { font: 'bold', width: 160, align: 'center' })[0]);
  // hero
  y = 80;
  push(rect(0, y, W, 820, dark));
  push(text(HEAD[i % HEAD.length], 80, y + 120, 76, light, { font: 'black', width: 640, lh: 1.08 })[0]);
  push(text(LOREM, 80, y + 470, 21, hex('#94a3b8'), { width: 560, lh: 1.55 })[0]);
  push(rect(80, y + 640, 200, 56, accent, 10));
  push(text('Start free trial', 80, y + 656, 18, dark, { font: 'bold', width: 200, align: 'center' })[0]);
  push(rect(300, y + 640, 180, 56, hex('#ffffff', 0.08), 10));
  push(text('Book a demo', 300, y + 656, 18, light, { font: 'bold', width: 180, align: 'center' })[0]);
  push(image(photos[i % photos.length], 780, y + 90, 580, 640, 24));
  // logos strip
  y += 820;
  push(rect(0, y, W, 140, light));
  BRANDS.slice(0, 6).forEach((b, k) => push(text(b, 110 + k * 210, y + 52, 26, hex('#94a3b8'), { font: 'bold' })[0]));
  // feature grid
  y += 140;
  push(rect(0, y, W, 980, hex('#ffffff')));
  push(text('Why teams choose ' + brand, 80, y + 90, 52, dark, { font: 'black', width: 1280, align: 'center' })[0]);
  FEATS.forEach((f, k) => {
    const cx = 80 + (k % 3) * 440, cy = y + 230 + Math.floor(k / 3) * 240;
    push(rect(cx, cy, 400, 210, light, 18));
    push(path([circle(cx + 52, cy + 52, 26)], accent));
    push(text(f, cx + 32, cy + 96, 24, dark, { font: 'bold' })[0]);
    push(text(LOREM.slice(0, 110), cx + 32, cy + 134, 15, hex('#64748b'), { width: 336, lh: 1.5 })[0]);
  });
  // image band
  y += 980;
  push(image(photos[(i + 3) % photos.length], 0, y, W / 2, 620));
  push(rect(W / 2, y, W / 2, 620, accent));
  push(text('Your whole workflow, beautifully connected.', W / 2 + 80, y + 150, 48, dark, { font: 'black', width: 560, lh: 1.1 })[0]);
  push(text(LOREM, W / 2 + 80, y + 380, 19, dark, { width: 520, lh: 1.55 })[0]);
  // pricing
  y += 620;
  push(rect(0, y, W, 960, light));
  push(text('Simple, transparent pricing', 80, y + 90, 52, dark, { font: 'black', width: 1280, align: 'center' })[0]);
  [['Starter', '$0'], ['Pro', '$29'], ['Business', '$99']].forEach(([n, p], k) => {
    const cx = 120 + k * 420, cy = y + 230, hot = k === 1;
    push(rect(cx, cy, 380, 640, hot ? dark : hex('#ffffff'), 22));
    const fg = hot ? light : dark;
    push(text(n, cx + 40, cy + 40, 26, fg, { font: 'bold' })[0]);
    push(text(p, cx + 40, cy + 100, 72, fg, { font: 'black' })[0]);
    push(text('per seat / month', cx + 40, cy + 200, 16, hex('#94a3b8'))[0]);
    FEATS.slice(0, 6).forEach((f, j) => {
      push(path([circle(cx + 50, cy + 272 + j * 48, 8)], accent));
      push(text(f, cx + 72, cy + 260 + j * 48, 17, fg)[0]);
    });
    push(rect(cx + 40, cy + 560, 300, 52, hot ? accent : dark, 10));
    push(text('Choose ' + n, cx + 40, cy + 575, 17, hot ? dark : light, { font: 'bold', width: 300, align: 'center' })[0]);
  });
  // testimonials
  y += 960;
  push(rect(0, y, W, 620, hex('#ffffff')));
  QUOTES.forEach((q, k) => {
    const cx = 80 + k * 440, cy = y + 100;
    push(rect(cx, cy, 400, 420, light, 18));
    push(text('“' + q + '”', cx + 36, cy + 40, 24, dark, { font: 'serif', width: 330, lh: 1.4 })[0]);
    push(image(photos[(i + k + 5) % photos.length], cx + 36, cy + 320, 56, 56));
    push(text(NAMES[k], cx + 108, cy + 336, 14, hex('#64748b'), { width: 260 })[0]);
  });
  // footer
  y += 620;
  push(rect(0, y, W, 420, dark));
  push(text(brand, 80, y + 80, 32, light, { font: 'black' })[0]);
  ['Product', 'Company', 'Resources', 'Legal'].forEach((h, k) => {
    push(text(h, 560 + k * 200, y + 84, 16, light, { font: 'bold' })[0]);
    ['Overview', 'Features', 'Changelog', 'Careers', 'Contact'].forEach((l, j) => push(text(l, 560 + k * 200, y + 130 + j * 36, 15, hex('#94a3b8'))[0]));
  });
  push(text(`© 2026 ${brand} Inc. All rights reserved.`, 80, y + 360, 14, hex('#64748b'))[0]);
  y += 420;
  return { width: W, height: y, background: light, items: it };
}

function appUi(i) {
  const mobile = i % 2 === 0;
  const W = mobile ? 1290 : 1600, H = mobile ? 900 : 1000;
  const [dark, accent, light] = PALETTES[(i + 2) % PALETTES.length].map((h) => hex(h));
  const it = [];
  const push = (x) => (Array.isArray(x) ? it.push(...x) : it.push(x));
  if (mobile) {
    for (let s = 0; s < 3; s++) {
      const ox = 30 + s * 420;
      push(rect(ox, 30, 390, 844, hex('#ffffff'), 44));
      push(text('9:41', ox + 30, 44, 15, dark, { font: 'bold' })[0]);
      push(text(['Home', 'Activity', 'Profile'][s], ox + 24, 90, 32, dark, { font: 'black' })[0]);
      push(image(photos[(i + s) % photos.length], ox + 24, 150, 342, 200, 18));
      for (let r = 0; r < 6; r++) {
        const ry = 370 + r * 66;
        push(path([circle(ox + 48, ry + 26, 20)], r % 2 ? accent : hex('#e2e8f0')));
        push(text(pick(FEATS), ox + 80, ry + 8, 16, dark, { font: 'bold' })[0]);
        push(text('Updated ' + (r + 2) + ' min ago', ox + 80, ry + 30, 13, hex('#64748b'))[0]);
        push(text('$' + (rnd() * 900).toFixed(2), ox + 290, ry + 16, 15, dark, { font: 'bold' })[0]);
      }
      push(rect(ox, 790, 390, 84, light, 0));
      for (let t = 0; t < 4; t++) push(path([circle(ox + 60 + t * 90, 826, 12)], t === s ? accent : hex('#94a3b8')));
    }
  } else {
    push(rect(0, 0, 260, H, dark));
    push(text(BRANDS[i % BRANDS.length], 28, 28, 22, light, { font: 'black' })[0]);
    ['Dashboard', 'Projects', 'Customers', 'Invoices', 'Reports', 'Settings'].forEach((n, k) => {
      if (k === 0) push(rect(16, 92 + k * 48, 228, 40, hex('#ffffff', 0.1), 8));
      push(text(n, 32, 100 + k * 48, 16, light)[0]);
    });
    push(text('Dashboard', 300, 30, 34, dark, { font: 'black' })[0]);
    [0, 1, 2, 3].forEach((k) => {
      push(rect(300 + k * 320, 100, 296, 130, hex('#ffffff'), 14));
      push(text(['Revenue', 'Users', 'Churn', 'NPS'][k], 324 + k * 320, 120, 15, hex('#64748b'))[0]);
      push(text(['$84.2k', '12,480', '2.1%', '68'][k], 324 + k * 320, 150, 36, dark, { font: 'black' })[0]);
    });
    push(rect(300, 260, 900, 380, hex('#ffffff'), 14));
    const bars = 24;
    for (let b = 0; b < bars; b++) {
      const h = 60 + rnd() * 260;
      push(rect(330 + b * 36, 610 - h, 22, h, b % 4 ? accent : dark, 4));
    }
    push(rect(1220, 260, 340, 380, hex('#ffffff'), 14));
    push(image(photos[i % photos.length], 1240, 280, 300, 180, 10));
    push(text(LOREM.slice(0, 120), 1240, 480, 14, hex('#475569'), { width: 300, lh: 1.5 })[0]);
    push(rect(300, 670, 1260, 300, hex('#ffffff'), 14));
    for (let r = 0; r < 6; r++) {
      const ry = 690 + r * 46;
      push(text(BRANDS[(r + i) % BRANDS.length], 324, ry + 12, 15, dark, { font: 'bold' })[0]);
      push(text(pick(FEATS), 600, ry + 12, 15, hex('#475569'))[0]);
      push(text('$' + (rnd() * 9000).toFixed(0), 1000, ry + 12, 15, dark)[0]);
      push(rect(1300, ry + 10, 90, 26, r % 3 ? accent : hex('#fecaca'), 13));
    }
  }
  return { width: W, height: H, background: light, items: it };
}

function poster(i) {
  const W = 1080, H = 1350;
  const [dark, accent, light] = PALETTES[(i + 5) % PALETTES.length].map((h) => hex(h));
  const it = [];
  const push = (x) => (Array.isArray(x) ? it.push(...x) : it.push(x));
  push(rect(0, 0, W, H, i % 2 ? dark : accent));
  for (let k = 0; k < 40; k++) push(path([circle(rnd() * W, rnd() * H, 10 + rnd() * 120)], k % 2 ? light : dark, 0.15 + rnd() * 0.5));
  push(image(photos[(i + 7) % photos.length], 120, 360, 840, 620, 0));
  push(text(['SUMMER', 'NOISE', 'FORMA', 'BLOOM', 'VOLT'][i % 5] + ' ' + (2026 + i), 60, 60, 150, i % 2 ? accent : dark, { font: 'black', width: 960, lh: 0.95 })[0]);
  push(text('An evening of sound, light and design. Doors open at 8pm. Limited tickets available online now.', 60, 1020, 34, i % 2 ? light : dark, { font: 'serif', width: 900, lh: 1.3 })[0]);
  push(text('FEEGA.APP / LIVE / ' + BRANDS[i % BRANDS.length].toUpperCase(), 60, 1260, 22, i % 2 ? light : dark, { font: 'bold' })[0]);
  return { width: W, height: H, background: light, items: it };
}

const groups = {};
const uses = [];
const motion = [];
const place = (key, list, x, y) => {
  groups[key] = list;
  uses.push({ kind: 'use', clip: `u:${key}`, group: key, matrix: [1, 0, 0, 1, x, y], cache: true });
};

const GAP = 200;
let x = 0;
for (let i = 0; i < 16; i++) {
  const l = landing(i);
  place(`landing${i}`, l, x, 0);
  x += l.width + GAP;
}
x = 0;
const ROW2 = 6200;
for (let i = 0; i < 12; i++) {
  const a = appUi(i);
  place(`app${i}`, a, x, ROW2);
  x += a.width + GAP;
}
x = 0;
const ROW3 = 7600;
for (let i = 0; i < 10; i++) {
  place(`poster${i}`, poster(i), x, ROW3);
  x += 1080 + GAP;
}
x = 0;
const ROW4 = 9300;
for (let i = 0; i < 6; i++) {
  const [dark, accent, light] = PALETTES[i % PALETTES.length].map((h) => hex(h));
  const fx = x, W = 1920, H = 1080;
  const bg = [rect(0, 0, W, H, dark), image(photos[i % photos.length], 1100, 140, 680, 800, 30)];
  bg.push(...text('Motion ' + (i + 1) + ': ' + HEAD[i], 120, 160, 84, light, { font: 'black', width: 900, lh: 1.05 })[0]);
  place(`motion${i}`, { width: W, height: H, background: dark, items: bg }, fx, ROW4);
  for (let s = 0; s < 14; s++) {
    const key = `motion${i}_s${s}`;
    const size = 80 + (s % 4) * 30;
    const items = s % 3 === 0 ? text(pick(FEATS), 0, 0, 40, accent, { font: 'black' })[0] : [rect(0, 0, size, size, s % 2 ? accent : light, size / 4)];
    groups[key] = { width: s % 3 === 0 ? 420 : size, height: s % 3 === 0 ? 60 : size, background: null, items };
    const bx = fx + 120 + (s % 7) * 130, by = ROW4 + 640 + Math.floor(s / 7) * 180;
    const anim = ['orbit', 'pulse', 'slide'][s % 3];
    uses.push({ kind: 'use', clip: `u:${key}`, group: key, matrix: [1, 0, 0, 1, bx, by], cache: false });
    motion.push({ clip: `u:${key}`, group: key, x: bx, y: by, anim, period: 1200 + s * 90, amp: 60 + s * 4 });
  }
  x += W + GAP;
}

const frames = Object.keys(groups).filter((k) => !k.includes('_s')).length;
const scene = { format: 'gpu-core-scene/1', note: 'groups = gpu-core DisplayList per frame; uses = World patch; images = clip -> file; motion = animated uses (orbit|pulse|slide, see METHOD.md)', frames, nodes, groups, uses, images, motion };
writeFileSync(join(out, 'scene.json'), JSON.stringify(scene));
console.log({ frames, nodes, groups: Object.keys(groups).length, images: Object.keys(images).length });

#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = resolve(ROOT, 'tests/e2e/fixtures/heavy-canvas-landings.json');
const PROJECT_ID = 'e472ff3c-4b1f-4b95-8f31-695e7940b40a';
const CANVAS_ID = 'b5a892f3-3112-41b3-ab8c-5f7d0d69887d';
const APP_URL = (process.env.PUBLIC_APP_URL || 'https://oh.feega.app').replace(/\/$/, '');
const SHOTS_DIR = process.env.LANDING_SHOTS_DIR;

const ORIGIN = { x: 5200, y: 0 };
const PAIR_STEP = 2000;
const MOBILE_OFFSET = 1540;
const DESKTOP_W = 1440;
const MOBILE_W = 390;
const CLIP_SECONDS = 3;
const STILL_AT = 1;
const OPS_PER_BATCH = 180;
const HTTP_OK = 200;

function envFile() {
  const path = [resolve(ROOT, '.env'), resolve(ROOT, '../../../.env')].find((p) => existsSync(p));
  if (!path) {
    return {};
  }
  const pairs = readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_0-9]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]);
  return Object.fromEntries(pairs);
}

const env = { ...envFile(), ...process.env };

async function token() {
  if (env.FEEGA_TOKEN) {
    return env.FEEGA_TOKEN;
  }
  const res = await fetch(`${env.PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.PUBLIC_SUPABASE_ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.E2E_TEST_EMAIL, password: env.E2E_TEST_PASSWORD })
  });
  const body = await res.json();
  if (!body.access_token) {
    throw new Error(`login failed: ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

const bearer = await token();
const headers = { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' };

async function post(path, body) {
  const res = await fetch(`${APP_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (res.status !== HTTP_OK || json.error) {
    throw new Error(`${path} ${res.status}: ${JSON.stringify(json).slice(0, 600)}`);
  }
  return json;
}

const canvasOp = (op, input) => post('/api/v1/org/canvas', { project_id: PROJECT_ID, op, input });
const onCanvas = (op, input) => canvasOp(op, { canvasId: CANVAS_ID, ...input });

async function batch(nodeId, ops) {
  const results = [];
  for (let i = 0; i < ops.length; i += OPS_PER_BATCH) {
    const ran = await post(`/api/v1/motion/${nodeId}/tools`, { tool: 'batch', input: { ops: ops.slice(i, i + OPS_PER_BATCH) } });
    results.push(...ran.output.results);
  }
  return results;
}

const tool = (nodeId, name, input) => post(`/api/v1/motion/${nodeId}/tools`, { tool: name, input });

const T = (text, o = {}) => (text ? { k: 'text', text, ...o } : null);
const B = (o = {}) => ({ k: 'box', ...o });
const I = (name, o = {}) => ({ k: 'icon', name, ...o });
const Img = (src, o = {}) => ({ k: 'image', src, ...o });
const Row = (o, children) => ({ k: 'row', ...o, children: children.filter(Boolean) });
const Col = (o, children) => ({ k: 'col', ...o, children: children.filter(Boolean) });
const Grid = (o, children) => ({ k: 'grid', ...o, children: children.filter(Boolean) });

const isContainer = (n) => n.k === 'row' || n.k === 'col' || n.k === 'grid';
const pad = (n) => {
  const p = n.pad ?? 0;
  const [t, r, b, l] = Array.isArray(p) ? (p.length === 2 ? [p[0], p[1], p[0], p[1]] : p) : [p, p, p, p];
  return { t, r, b, l };
};

const FONT_WIDTH = { Inter: 0.53, 'Playfair Display': 0.5, Manrope: 0.54, 'Space Grotesk': 0.55 };

function charWidth(n) {
  const base = FONT_WIDTH[n.font] ?? 0.53;
  const bold = (n.weight ?? 400) >= 600 ? 1.05 : 1;
  const upper = n.upper ? 1.18 : 1;
  return n.size * (base * bold * upper + (n.tracking ?? 0));
}

function wrapLines(n, maxW) {
  const cw = charWidth(n);
  const lines = [];
  for (const para of n.text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && next.length * cw > maxW) {
        lines.push(line);
        line = word;
        continue;
      }
      line = next;
    }
    lines.push(line);
  }
  return lines;
}

const TEXT_FLOOR_SHARE = 0.0101;
let textFloor = 0;

function measure(n, availW) {
  if (n.k === 'text') {
    n.size = Math.max(n.size, textFloor);
    const maxW = typeof n.w === 'number' ? n.w : availW;
    const lines = wrapLines(n, maxW);
    const longest = Math.max(...lines.map((l) => l.length)) * charWidth(n);
    n.mw = n.w === 'fill' || typeof n.w === 'number' ? maxW : Math.min(maxW, Math.ceil(longest * 1.06 + 4));
    n.mw = Math.max(n.mw, textFloor * 3);
    n.mh = Math.ceil(lines.length * n.size * (n.leading ?? 1.25));
    return;
  }
  if (n.k === 'icon') {
    n.mw = n.size;
    n.mh = n.size;
    return;
  }
  if (!isContainer(n)) {
    n.mw = n.w === 'fill' || n.w === undefined ? availW : n.w;
    n.mh = n.h;
    return;
  }

  const p = pad(n);
  const gap = n.gap ?? 0;
  const outerW = typeof n.w === 'number' ? n.w : availW;
  const innerW = outerW - p.l - p.r;

  if (n.k === 'grid') {
    const cols = n.columns;
    const cellW = (innerW - gap * (cols - 1)) / cols;
    for (const c of n.children) {
      if (c.w === undefined) {
        c.w = 'fill';
      }
      measure(c, cellW);
      c.mw = cellW;
    }
    let h = 0;
    for (let i = 0; i < n.children.length; i += cols) {
      const row = n.children.slice(i, i + cols);
      const tall = Math.max(...row.map((c) => c.mh));
      row.forEach((c) => (c.mh = isContainer(c) ? tall : c.mh));
      h += tall + (i ? n.crossGap ?? gap : 0);
    }
    n.mw = outerW;
    n.mh = (n.h ?? h + p.t + p.b);
    return;
  }

  if (n.k === 'col') {
    for (const c of n.children) {
      measure(c, innerW);
    }
    const hug = n.hug && n.w === undefined;
    n.mw = hug ? Math.max(...n.children.map((c) => c.mw)) + p.l + p.r : outerW;
    n.mh = n.h ?? n.children.reduce((s, c) => s + c.mh, 0) + gap * (n.children.length - 1) + p.t + p.b;
    return;
  }

  const fills = n.children.filter((c) => c.w === 'fill');
  for (const c of n.children.filter((c) => c.w !== 'fill')) {
    measure(c, innerW);
  }
  const used = n.children.filter((c) => c.w !== 'fill').reduce((s, c) => s + c.mw, 0) + gap * (n.children.length - 1);
  for (const c of fills) {
    measure(c, Math.max(40, (innerW - used) / fills.length));
  }
  const fixedW = typeof n.w === 'number' || n.w === 'fill';
  n.mw = fixedW ? outerW : n.children.reduce((s, c) => s + c.mw, 0) + gap * (n.children.length - 1) + p.l + p.r;
  n.mh = n.h ?? Math.max(...n.children.map((c) => c.mh)) + p.t + p.b;
}

function place(n, x, y) {
  n.x = Math.round(x);
  n.y = Math.round(y);
  n.mw = Math.round(n.mw);
  n.mh = Math.round(n.mh);
  if (!isContainer(n)) {
    return;
  }
  const p = pad(n);
  const gap = n.gap ?? 0;
  const innerW = n.mw - p.l - p.r;
  const innerH = n.mh - p.t - p.b;

  if (n.k === 'grid') {
    const cols = n.columns;
    let top = y + p.t;
    for (let i = 0; i < n.children.length; i += cols) {
      const row = n.children.slice(i, i + cols);
      row.forEach((c, j) => place(c, x + p.l + j * (c.mw + gap), top));
      top += Math.max(...row.map((c) => c.mh)) + (n.crossGap ?? gap);
    }
    return;
  }

  if (n.k === 'col') {
    let top = y + p.t;
    for (const c of n.children) {
      const left = n.align === 'center' ? x + p.l + (innerW - c.mw) / 2 : n.align === 'end' ? x + p.l + innerW - c.mw : x + p.l;
      place(c, left, top);
      top += c.mh + gap;
    }
    return;
  }

  const total = n.children.reduce((s, c) => s + c.mw, 0);
  const between = n.justify === 'space-between' && n.children.length > 1 ? (innerW - total) / (n.children.length - 1) : gap;
  let left = x + p.l + (n.justify === 'center' ? (innerW - total - gap * (n.children.length - 1)) / 2 : 0);
  for (const c of n.children) {
    const top = n.align === 'start' ? y + p.t : y + p.t + (innerH - c.mh) / 2;
    place(c, left, top);
    left += c.mw + between;
  }
}

function flatten(n, out = []) {
  out.push(n);
  for (const c of n.children ?? []) {
    flatten(c, out);
  }
  return out;
}

const span = { start: 0, duration: CLIP_SECONDS };
const box = (n) => ({ left: n.x, top: n.y, width: Math.max(2, n.mw), height: Math.max(2, n.mh) });

function paint(n) {
  const props = { shape: 'rect', ...box(n), radius: n.radius ?? 0 };
  if (n.gradient) {
    Object.assign(props, { fillKind: 'linear', fill: n.gradient[0], fill2: n.gradient[1], gradientAngle: n.gradient[2] ?? 135 });
  } else if (n.fill) {
    Object.assign(props, { fillKind: 'solid', fill: n.fill });
  } else {
    props.fillKind = 'none';
  }
  if (n.stroke) {
    Object.assign(props, { strokeKind: 'solid', stroke: n.stroke, strokeWidth: n.sw ?? 1 });
  }
  if (n.opacity) {
    props.opacity = n.opacity;
  }
  return props;
}

function clipOp(n, frame, assets) {
  if (n.k === 'text') {
    const props = { text: n.text, ...box(n), size: n.size, weight: n.weight ?? 400, color: n.color, font: n.font, align: n.align ?? 'left', leading: n.leading ?? 1.25, tracking: n.tracking ?? 0, sizing: 'fixed', move: 'none' };
    if (n.upper) {
      props.textCase = 'upper';
    }
    return { tool: 'add_clip', input: { component: 'Text', ...span, props } };
  }
  if (n.k === 'icon') {
    const short = Math.min(frame.w, frame.h);
    return { tool: 'add_icon', input: { name: n.name, x: (n.x + n.mw / 2) / frame.w, y: (n.y + n.mh / 2) / frame.h, size: Math.max(0.01, n.size / short), color: n.color, ...span } };
  }
  if (n.k === 'image' && assets[n.src]) {
    return { tool: 'add_clip', input: { component: 'Image', ...span, props: { assetId: assets[n.src], fit: 'cover', ...box(n), move: 'none' } } };
  }
  if (n.k === 'image') {
    return { tool: 'add_clip', input: { component: 'Shape', ...span, props: paint({ ...n, gradient: n.fallback ?? ['#c7c7c7', '#8a8a8a'] }) } };
  }
  return { tool: 'add_clip', input: { component: 'Shape', ...span, props: paint(n) } };
}

const DIRECTION = { row: 'horizontal', col: 'vertical', grid: 'grid' };

function layoutOps(n) {
  const p = pad(n);
  const ids = n.children.map((c) => c.id);
  const layout = { clip_id: n.id, direction: DIRECTION[n.k], gap: n.gap ?? 0, padding: { top: p.t, right: p.r, bottom: p.b, left: p.l } };
  if (n.k === 'grid') {
    Object.assign(layout, { columns: n.columns, crossGap: n.crossGap ?? n.gap ?? 0 });
  }
  if (n.justify) {
    layout.justify = n.justify;
  }
  layout.align = n.k === 'row' ? (n.align ?? 'center') : (n.align ?? 'start');
  return [
    { tool: 'parent_clips', input: { clip_ids: ids, parent_id: n.id } },
    { tool: 'add_auto_layout', input: { clip_id: n.id } },
    { tool: 'set_auto_layout', input: layout },
    ...n.children.map((c) => ({ tool: 'set_layout_item', input: { clip_id: c.id, width: 'fixed', height: 'fixed' } }))
  ];
}

const TEXT_STYLE_MIN_SHARE = 0.01;
const TEXT_STYLE_NAMES = ['Display', 'Heading'];

function styleOps(theme, nodes, frame) {
  const ops = [
    { tool: 'named_style', input: { action: 'define', name: 'Ink', style: { kind: 'colour', color: theme.ink } } },
    { tool: 'named_style', input: { action: 'define', name: 'Accent', style: { kind: 'colour', color: theme.accent } } }
  ];
  const ink = nodes.filter((n) => n.k === 'text' && n.color === theme.ink).map((n) => n.id);
  const accent = nodes.filter((n) => n.k === 'box' && n.fill === theme.accent).map((n) => n.id);
  if (ink.length) {
    ops.push({ tool: 'named_style', input: { action: 'apply', name: 'Ink', clip_ids: ink } });
  }
  if (accent.length) {
    ops.push({ tool: 'named_style', input: { action: 'apply', name: 'Accent', clip_ids: accent } });
  }
  const short = Math.min(frame.w, frame.h);
  const display = nodes.filter((n) => n.k === 'text' && n.display && n.size / short >= TEXT_STYLE_MIN_SHARE);
  const sizes = [...new Set(display.map((n) => n.size))].sort((a, b) => b - a);
  sizes.slice(0, TEXT_STYLE_NAMES.length).forEach((size, i) => {
    const same = display.filter((n) => n.size === size);
    const d = same[0];
    const name = TEXT_STYLE_NAMES[i];
    ops.push({ tool: 'named_style', input: { action: 'define', name, style: { kind: 'text', font: d.font, size: size / short, weight: d.weight, tracking: d.tracking ?? 0, leading: d.leading ?? 1.1, color: d.color } } });
    ops.push({ tool: 'named_style', input: { action: 'apply', name, clip_ids: same.map((n) => n.id) } });
  });
  return ops;
}

function decorationOps(theme, frame) {
  const s = frame.w / DESKTOP_W;
  const blob = (left, top, size, color, opacity) => ({ tool: 'add_clip', input: { component: 'Shape', ...span, props: { shape: 'circle', left, top, width: size, height: size, fillKind: 'solid', fill: color, opacity } } });
  return [blob(frame.w - 420 * s, 120 * s, 260 * s, theme.accent, 18), blob(frame.w - 300 * s, 260 * s, 160 * s, theme.accent2, 22), blob(frame.w - 520 * s, 330 * s, 90 * s, theme.ink, 8)];
}

function landing(theme, W) {
  const m = W < 600;
  const s = (d, mo) => (m ? mo : d);
  const side = s(120, 20);
  const content = W - side * 2;
  const f = theme.font;
  const ff = theme.display ?? theme.font;
  const ink = theme.ink;
  const muted = theme.muted;
  const card = theme.card;
  const r = theme.radius;

  const button = (label, primary, icon) =>
    Row({ pad: s([16, 28], [14, 22]), gap: 10, radius: theme.pill ? 999 : r, fill: primary ? theme.accent : undefined, stroke: primary ? undefined : theme.line, sw: 1.5 }, [
      T(label, { size: s(17, 15), weight: 600, color: primary ? theme.onAccent : ink, font: f }),
      icon && I(icon, { size: s(18, 16), color: primary ? theme.onAccent : ink })
    ]);

  const nav = Row({ w: W, pad: [s(28, 18), side], justify: 'space-between', fill: theme.bg, stroke: theme.line, sw: 1 }, [
    Row({ gap: 10 }, [B({ w: 28, h: 28, radius: theme.pill ? 14 : 6, gradient: [theme.accent, theme.accent2, 135] }), T(theme.name, { size: s(22, 19), weight: 700, color: ink, font: ff, tracking: -0.02 })]),
    !m && Row({ gap: 36 }, theme.links.map((l) => T(l, { size: 15, weight: 500, color: muted, font: f }))),
    m ? I('menu', { size: 24, color: ink }) : Row({ gap: 12 }, [T('Log in', { size: 15, weight: 500, color: ink, font: f }), button(theme.navCta, true)])
  ]);

  const heroCopy = Col({ w: s(600, content), gap: s(28, 20) }, [
    Row({ pad: [6, 14], gap: 8, radius: 999, fill: theme.chip, stroke: theme.line, sw: 1 }, [I('sparkles', { size: 14, color: theme.accent }), T(theme.badge, { size: 13, weight: 600, color: ink, font: f })]),
    T(theme.headline, { size: s(theme.heroSize ?? 76, 42), weight: theme.heroWeight ?? 700, color: ink, font: ff, w: 'fill', leading: 1.04, tracking: -0.035, display: true }),
    T(theme.sub, { size: s(20, 17), color: muted, font: f, w: 'fill', leading: 1.5 }),
    (m ? Col : Row)({ gap: 14, hug: true }, [button(theme.cta, true, 'arrow-right'), button(theme.cta2, false, 'play')]),
    Row({ gap: 12, w: 'fill' }, [
      Row({ gap: 4 }, [0, 1, 2, 3].map((i) => B({ w: 32, h: 32, radius: 16, fill: theme.avatars[i % theme.avatars.length], stroke: theme.bg, sw: 2 }))),
      T(theme.proof, { size: 14, color: muted, font: f, w: 'fill' })
    ])
  ]);

  const heroArt = Col({ w: s(520, content), gap: 0, radius: r * 2, fill: card, stroke: theme.line, sw: 1, pad: 12 }, [
    Img(theme.heroImage, { w: 'fill', h: s(520, 300), fallback: [theme.accent, theme.accent2, 135] }),
    Row({ w: 'fill', pad: [16, 8, 4, 8], justify: 'space-between' }, [
      Col({ gap: 4, hug: true }, [T(theme.statLabel, { size: 13, color: muted, font: f }), T(theme.stat, { size: 26, weight: 700, color: ink, font: ff })]),
      Row({ pad: [8, 12], radius: 999, fill: theme.chip, gap: 6 }, [I('arrow-up-right', { size: 14, color: theme.accent }), T(theme.statDelta, { size: 13, weight: 600, color: theme.accent, font: f })])
    ])
  ]);

  const hero = (m ? Col : Row)({ w: W, pad: [s(110, 48), side, s(100, 56), side], gap: s(80, 40), fill: theme.bg, align: m ? 'start' : 'center' }, [heroCopy, heroArt]);

  const logos = Col({ w: W, pad: [s(56, 40), side], gap: 28, fill: theme.band, align: 'center' }, [
    T(theme.logoLine, { size: 14, weight: 500, color: muted, font: f, upper: true, tracking: 0.08 }),
    (m ? Grid : Row)({ w: content, columns: 3, gap: s(48, 16), crossGap: 20, justify: 'space-between' }, theme.logos.map((l, i) => Row({ gap: 8 }, [I(theme.logoIcons[i % theme.logoIcons.length], { size: s(22, 16), color: muted }), T(l, { size: s(20, 15), weight: 700, color: muted, font: ff, tracking: -0.02 })])))
  ]);

  const head = (eyebrow, title, sub) =>
    Col({ w: s(760, content), gap: 16, align: 'center' }, [
      T(eyebrow, { size: 13, weight: 700, color: theme.accent, font: f, upper: true, tracking: 0.1 }),
      T(title, { size: s(48, 32), weight: theme.heroWeight ?? 700, color: ink, font: ff, w: 'fill', align: 'center', leading: 1.1, tracking: -0.03, display: true }),
      sub && T(sub, { size: s(18, 16), color: muted, font: f, w: 'fill', align: 'center', leading: 1.5 })
    ]);

  const feature = (ft) =>
    Col({ pad: s(32, 24), gap: 16, radius: r * 1.5, fill: card, stroke: theme.line, sw: 1 }, [
      Row({ pad: 12, radius: theme.pill ? 999 : r, fill: theme.chip }, [I(ft.icon, { size: 24, color: theme.accent })]),
      T(ft.title, { size: 21, weight: 650, color: ink, font: ff, w: 'fill', tracking: -0.01 }),
      T(ft.body, { size: 16, color: muted, font: f, w: 'fill', leading: 1.55 }),
      Row({ gap: 6 }, [T('Learn more', { size: 15, weight: 600, color: theme.accent, font: f }), I('chevron-right', { size: 16, color: theme.accent })])
    ]);

  const features = Col({ w: W, pad: [s(120, 64), side], gap: s(64, 36), fill: theme.bg, align: 'center' }, [
    head(theme.featEyebrow, theme.featTitle, theme.featSub),
    Grid({ w: content, columns: s(3, 1), gap: 24 }, theme.features.map(feature))
  ]);

  const plan = (p, i) => {
    const hot = i === 1;
    const on = hot ? theme.onAccent : ink;
    const sub = hot ? theme.onAccentMuted : muted;
    return Col({ pad: s(36, 26), gap: 20, radius: r * 1.5, fill: hot ? theme.accent : card, stroke: hot ? undefined : theme.line, sw: 1 }, [
      Row({ w: 'fill', justify: 'space-between' }, [T(p.name, { size: 18, weight: 650, color: on, font: f }), hot && Row({ pad: [4, 10], radius: 999, fill: theme.onAccent }, [T('Popular', { size: 12, weight: 700, color: theme.accent, font: f })])]),
      Row({ gap: 6, align: 'end' }, [T(p.price, { size: s(52, 42), weight: 700, color: on, font: ff, tracking: -0.03 }), T(p.per ?? '/month', { size: 15, color: sub, font: f })]),
      T(p.blurb, { size: 15, color: sub, font: f, w: 'fill', leading: 1.5 }),
      B({ w: 'fill', h: 1, fill: hot ? theme.onAccentMuted : theme.line }),
      Col({ gap: 12, w: 'fill' }, p.perks.map((perk) => Row({ gap: 10 }, [I('check', { size: 18, color: hot ? theme.onAccent : theme.accent }), T(perk, { size: 15, color: on, font: f })]))),
      Row({ w: 'fill', pad: [14, 20], radius: theme.pill ? 999 : r, justify: 'center', fill: hot ? theme.onAccent : undefined, stroke: hot ? undefined : theme.line, sw: 1.5 }, [T(p.cta, { size: 16, weight: 600, color: hot ? theme.accent : ink, font: f })])
    ]);
  };

  const pricing = Col({ w: W, pad: [s(120, 64), side], gap: s(56, 32), fill: theme.band, align: 'center' }, [
    head('Pricing', theme.priceTitle, theme.priceSub),
    Grid({ w: content, columns: s(3, 1), gap: 24 }, theme.plans.map(plan))
  ]);

  const testimonial = Col({ w: W, pad: [s(120, 64), side], fill: theme.bg, align: 'center' }, [
    Col({ w: s(900, content), pad: s(56, 28), gap: 28, radius: r * 2, fill: card, stroke: theme.line, sw: 1, align: 'center' }, [
      Row({ gap: 4 }, [0, 1, 2, 3, 4].map(() => I('star', { size: 20, color: theme.star }))),
      T(theme.quote, { size: s(30, 22), weight: 500, color: ink, font: ff, w: 'fill', align: 'center', leading: 1.35, tracking: -0.015 }),
      Row({ gap: 14 }, [
        theme.avatarImage ? Img(theme.avatarImage, { w: 52, h: 52, fallback: [theme.accent2, theme.accent, 45] }) : B({ w: 52, h: 52, radius: 26, gradient: [theme.accent2, theme.accent, 45] }),
        Col({ gap: 2, hug: true }, [T(theme.quoteName, { size: 16, weight: 650, color: ink, font: f }), T(theme.quoteRole, { size: 14, color: muted, font: f })])
      ])
    ])
  ]);

  const faq = Col({ w: W, pad: [s(100, 56), side], gap: s(48, 28), fill: theme.bg, align: 'center' }, [
    head('FAQ', 'Questions, answered'),
    Col({ w: s(860, content), gap: 0 }, theme.faq.map((q, i) =>
      Col({ w: 'fill', pad: [24, 4], gap: 10, stroke: theme.line, sw: 1 }, [
        Row({ w: 'fill', justify: 'space-between' }, [T(q[0], { size: s(19, 16), weight: 600, color: ink, font: f, w: s(700, content - 50) }), I(i === 0 ? 'minus' : 'plus', { size: 20, color: muted })]),
        i === 0 && T(q[1], { size: 16, color: muted, font: f, w: 'fill', leading: 1.55 })
      ])
    ))
  ]);

  const footCol = (title, items) => Col({ gap: 12, hug: true }, [T(title, { size: 14, weight: 700, color: theme.footInk, font: f }), ...items.map((x) => T(x, { size: 14, color: theme.footMuted, font: f }))]);

  const footer = Col({ w: W, pad: [s(80, 48), side, 40, side], gap: 48, fill: theme.foot }, [
    (m ? Col : Row)({ w: content, gap: 40, justify: 'space-between', align: 'start' }, [
      Col({ w: s(340, content), gap: 16 }, [
        Row({ gap: 10 }, [B({ w: 26, h: 26, radius: theme.pill ? 13 : 6, gradient: [theme.accent, theme.accent2, 135] }), T(theme.name, { size: 20, weight: 700, color: theme.footInk, font: ff })]),
        T(theme.footLine, { size: 14, color: theme.footMuted, font: f, w: 'fill', leading: 1.6 }),
        Row({ gap: 10 }, ['globe', 'mail', 'message'].map((ic) => Row({ pad: 9, radius: 999, stroke: theme.footLineColor, sw: 1 }, [I(ic, { size: 16, color: theme.footInk })])))
      ]),
      (m ? Grid : Row)({ columns: 2, gap: s(72, 24), crossGap: 28, w: m ? content : undefined, align: 'start' }, [footCol('Product', ['Features', 'Pricing', 'Changelog', 'Roadmap']), footCol('Company', ['About', 'Careers', 'Press', 'Contact']), footCol('Resources', ['Docs', 'Guides', 'Community', 'Status'])])
    ]),
    B({ w: content, h: 1, fill: theme.footLineColor }),
    (m ? Col : Row)({ w: content, gap: 12, justify: 'space-between' }, [T(`© 2026 ${theme.name}. All rights reserved.`, { size: 13, color: theme.footMuted, font: f }), Row({ gap: 24 }, ['Privacy', 'Terms', 'Cookies'].map((x) => T(x, { size: 13, color: theme.footMuted, font: f })))])
  ]);

  return Col({ w: W, gap: 0, fill: theme.bg }, [nav, hero, logos, features, pricing, testimonial, faq, footer]);
}

const UNSPLASH = (id) => `https://images.unsplash.com/${id}?w=1100&q=60&auto=format&fit=crop`;

const COMMON_FAQ = (product) => [
  [`How long does it take to set up ${product}?`, 'Most teams are live in an afternoon. Import your data, invite the team and you are ready to go, no engineers needed.'],
  ['Can I cancel at any time?', 'Yes.'],
  ['Do you offer discounts for startups and non-profits?', 'Yes.'],
  ['Where is my data stored?', 'Yes.'],
  ['Is there an API?', 'Yes.']
];

const THEMES = [
  {
    key: 'saas',
    name: 'Northwind',
    font: 'Inter',
    bg: '#ffffff', band: '#f6f7fb', card: '#ffffff', chip: '#eef0ff', line: '#e4e6ef',
    ink: '#0f1222', muted: '#5b6178', accent: '#4f46e5', accent2: '#06b6d4', onAccent: '#ffffff', onAccentMuted: '#c7c9ff', star: '#f59e0b',
    foot: '#0f1222', footInk: '#ffffff', footMuted: '#9aa0b8', footLineColor: '#2a2f45',
    radius: 10, avatars: ['#fca5a5', '#93c5fd', '#86efac', '#fde68a'],
    links: ['Product', 'Solutions', 'Customers', 'Pricing', 'Docs'], navCta: 'Start free',
    badge: 'New: AI workflows are here', headline: 'Ship projects your team actually finishes', sub: 'Northwind brings plans, docs and roadmaps into one fast workspace, so every team knows what to build next and why.',
    cta: 'Start for free', cta2: 'Watch demo', proof: 'Loved by 12,000+ product teams',
    heroImage: UNSPLASH('photo-1460925895917-afdab827c52f'), statLabel: 'Cycle time this sprint', stat: '3.2 days', statDelta: '-41%',
    logoLine: 'Trusted by fast-moving teams', logos: ['Acme', 'Globex', 'Umbrella', 'Initech', 'Hooli', 'Vandelay'], logoIcons: ['zap', 'globe', 'cloud', 'grid', 'star', 'link'],
    featEyebrow: 'Features', featTitle: 'Everything you need to move fast', featSub: 'Purpose-built tools for planning, building and shipping, without the busywork.',
    features: [
      { icon: 'zap', title: 'Instant planning', body: 'Turn a rough idea into a scoped plan with owners and dates in seconds.' },
      { icon: 'users', title: 'Built for teams', body: 'Comments, mentions and live cursors keep everyone on the same page.' },
      { icon: 'lock', title: 'Secure by default', body: 'SSO, audit logs and granular permissions on every plan.' },
      { icon: 'calendar', title: 'Roadmaps that update', body: 'Timelines move as work moves, so the plan never lies.' },
      { icon: 'search', title: 'Find anything', body: 'One search across docs, issues and decisions, in milliseconds.' },
      { icon: 'link', title: '100+ integrations', body: 'GitHub, Slack, Figma and the rest of your stack, connected.' }
    ],
    priceTitle: 'Simple pricing that scales', priceSub: 'Start free. Upgrade when your team grows.',
    plans: [
      { name: 'Starter', price: '$0', blurb: 'For individuals trying things out.', perks: ['Up to 3 projects', 'Unlimited docs', 'Community support'], cta: 'Get started' },
      { name: 'Team', price: '$12', blurb: 'For growing teams that ship weekly.', perks: ['Unlimited projects', 'Roadmaps and timelines', 'Integrations', 'Priority support'], cta: 'Start free trial' },
      { name: 'Enterprise', price: 'Custom', per: '', blurb: 'For organisations with advanced needs.', perks: ['SSO and SCIM', 'Audit logs', 'Dedicated success manager'], cta: 'Contact sales' }
    ],
    quote: '“Northwind replaced four tools for us. Our planning meetings went from an hour to fifteen minutes.”', quoteName: 'Maya Chen', quoteRole: 'VP Product, Globex',
    avatarImage: UNSPLASH('photo-1494790108377-be9c29b29330'),
    faq: COMMON_FAQ('Northwind'), footLine: 'The workspace for teams that plan less and ship more.'
  },
  {
    key: 'fashion',
    name: 'MAISON VÉLIN',
    font: 'Inter', display: 'Playfair Display', heroWeight: 500, heroSize: 88,
    bg: '#f4efe6', band: '#ebe4d6', card: '#fbf8f2', chip: '#e7dfcf', line: '#d6ccb8',
    ink: '#1b1712', muted: '#6e6455', accent: '#1b1712', accent2: '#b08d57', onAccent: '#f4efe6', onAccentMuted: '#8f8576', star: '#b08d57',
    foot: '#1b1712', footInk: '#f4efe6', footMuted: '#a69c8c', footLineColor: '#3a332a',
    radius: 0, avatars: ['#c9b79c', '#8f7a5d', '#e2d5c0', '#5c4d3c'],
    links: ['New in', 'Women', 'Men', 'Atelier', 'Journal'], navCta: 'Shop now',
    badge: 'Autumn / Winter 2026', headline: 'Quiet luxury, made to last a lifetime', sub: 'Tailoring cut in our Florence atelier from undyed wool, cashmere and silk. Fewer pieces, better made.',
    cta: 'Shop the collection', cta2: 'Watch the film', proof: 'Free alterations on every piece',
    heroImage: UNSPLASH('photo-1515886657613-9f3515b0c78f'), statLabel: 'The Vélin coat', stat: '€1,290', statDelta: 'Back in stock',
    logoLine: 'As seen in', logos: ['VOGUE', 'Kinfolk', 'Monocle', 'Cereal', 'Apartamento', 'GQ'], logoIcons: ['star', 'bookmark', 'globe', 'sun', 'moon', 'heart'],
    featEyebrow: 'The house', featTitle: 'Made slowly, by hand', featSub: 'Every garment passes through eleven pairs of hands before it reaches yours.',
    features: [
      { icon: 'pencil', title: 'Atelier tailoring', body: 'Patterns drafted by hand and cut one at a time in Florence.' },
      { icon: 'sun', title: 'Natural fibres', body: 'Undyed wool, Mongolian cashmere and peace silk, traceable to the farm.' },
      { icon: 'refresh', title: 'Repaired for life', body: 'Send any piece back and we mend it, free, for as long as you own it.' }
    ],
    priceTitle: 'The membership', priceSub: 'Private appointments, early access and complimentary tailoring.',
    plans: [
      { name: 'Friend', price: '€0', per: '/year', blurb: 'Newsletter and journal.', perks: ['Early access to drops', 'Journal in print'], cta: 'Join' },
      { name: 'Patron', price: '€240', per: '/year', blurb: 'For those who live in our pieces.', perks: ['Free alterations', 'Private fittings', 'Archive sales', 'Gift wrapping'], cta: 'Become a patron' },
      { name: 'Atelier', price: '€1,200', per: '/year', blurb: 'Made to measure, season after season.', perks: ['Two bespoke pieces', 'Personal tailor', 'Atelier visit'], cta: 'Enquire' }
    ],
    quote: '“The only coat I have owned for ten winters. It looks better every year.”', quoteName: 'Isabelle Moreau', quoteRole: 'Client since 2016, Paris',
    avatarImage: UNSPLASH('photo-1529139574466-a303027c1d8b'),
    faq: COMMON_FAQ('a fitting'), footLine: 'Maison Vélin, Via dei Serragli 12, Florence. Atelier open by appointment.'
  },
  {
    key: 'fintech',
    name: 'Ledgerly',
    font: 'Manrope',
    bg: '#0b1220', band: '#0f1829', card: '#111b2e', chip: '#13263a', line: '#1f2c44',
    ink: '#eef3fb', muted: '#8a97ad', accent: '#22c55e', accent2: '#0ea5e9', onAccent: '#04130a', onAccentMuted: '#14532d', star: '#22c55e',
    foot: '#070c16', footInk: '#eef3fb', footMuted: '#6b7890', footLineColor: '#1a2438',
    radius: 14, avatars: ['#22c55e', '#0ea5e9', '#a78bfa', '#f472b6'],
    links: ['Accounts', 'Cards', 'Treasury', 'Developers', 'Pricing'], navCta: 'Open account',
    badge: 'Earn 4.6% APY on idle cash', headline: 'Banking for companies that move money fast', sub: 'Accounts, cards, payouts and treasury in one place, with real-time ledgers your finance team will actually trust.',
    cta: 'Open an account', cta2: 'Book a demo', proof: '$18B moved by 40,000 businesses',
    heroImage: UNSPLASH('photo-1554224155-6726b3ff858f'), statLabel: 'Total balance', stat: '$2,481,930.14', statDelta: '+12.4%',
    logoLine: 'Backed by and built with', logos: ['Stripe', 'Plaid', 'Visa', 'Mastercard', 'Ramp', 'Brex'], logoIcons: ['credit-card', 'link', 'globe', 'zap', 'lock', 'tag'],
    featEyebrow: 'Platform', featTitle: 'One balance. Every money movement.', featSub: 'From the first wire to the thousandth payout, without spreadsheets.',
    features: [
      { icon: 'credit-card', title: 'Corporate cards', body: 'Virtual and physical cards with per-team limits and instant receipts.' },
      { icon: 'send', title: 'Global payouts', body: 'Pay vendors in 140 countries with FX at the mid-market rate.' },
      { icon: 'lock', title: 'Bank-grade security', body: 'SOC 2 Type II, FDIC-insured up to $5M through partner banks.' },
      { icon: 'refresh', title: 'Auto-reconciliation', body: 'Every transaction matched to your ledger in real time.' },
      { icon: 'clock', title: 'Treasury', body: 'Sweep idle cash into T-bills automatically and earn daily.' },
      { icon: 'file', title: 'Accounting sync', body: 'Two-way sync with NetSuite, Xero and QuickBooks.' }
    ],
    priceTitle: 'Plans for every stage', priceSub: 'No minimum balance. No hidden fees.',
    plans: [
      { name: 'Essentials', price: '$0', blurb: 'Everything a new company needs.', perks: ['Business checking', '5 virtual cards', 'ACH and wires'], cta: 'Open account' },
      { name: 'Growth', price: '$49', blurb: 'For teams scaling spend.', perks: ['Unlimited cards', 'Global payouts', 'Treasury at 4.6%', 'Accounting sync'], cta: 'Start Growth' },
      { name: 'Scale', price: '$249', blurb: 'Controls for finance teams.', perks: ['Approval chains', 'Multi-entity', 'Dedicated support'], cta: 'Talk to us' }
    ],
    quote: '“We closed our books in two days instead of two weeks. Ledgerly is the first bank our CFO actually likes.”', quoteName: 'Daniel Okafor', quoteRole: 'Head of Finance, Ramp-up Labs',
    avatarImage: UNSPLASH('photo-1507003211169-0a1dd7228f2d'),
    faq: COMMON_FAQ('an account'), footLine: 'Ledgerly is a financial technology company, not a bank. Banking services provided by partner banks, Member FDIC.'
  },
  {
    key: 'app',
    name: 'Pulse',
    font: 'Space Grotesk', pill: true,
    bg: '#fff7fb', band: '#fdeef6', card: '#ffffff', chip: '#fde3f0', line: '#f3d3e4',
    ink: '#24061a', muted: '#7d5a6e', accent: '#e11d74', accent2: '#8b5cf6', onAccent: '#ffffff', onAccentMuted: '#ffc2dc', star: '#f59e0b',
    foot: '#24061a', footInk: '#fff7fb', footMuted: '#c39bb1', footLineColor: '#3f1530',
    radius: 18, avatars: ['#f9a8d4', '#c4b5fd', '#fdba74', '#67e8f9'],
    links: ['Features', 'Coaches', 'Stories', 'Pricing'], navCta: 'Get the app',
    badge: '#1 in Health & Fitness', headline: 'Your daily workout, planned in ten seconds', sub: 'Pulse builds a plan around your sleep, mood and calendar, then coaches you through it, minute by minute.',
    cta: 'Download free', cta2: 'See how it works', proof: '4.9 from 120k reviews',
    heroImage: UNSPLASH('photo-1512941937669-90a1b58e7e9c'), statLabel: 'Streak', stat: '48 days', statDelta: 'Personal best',
    logoLine: 'Featured in', logos: ['App Store', 'Wired', 'TechCrunch', 'Runner’s', 'Strava', 'Health'], logoIcons: ['heart', 'zap', 'star', 'play', 'music', 'sun'],
    featEyebrow: 'Why Pulse', featTitle: 'A coach in your pocket', featSub: 'Smart enough to adapt, simple enough to start today.',
    features: [
      { icon: 'heart', title: 'Adapts to you', body: 'Tired? Pulse swaps HIIT for mobility before you even ask.' },
      { icon: 'music', title: 'Beats that match', body: 'Playlists synced to your pace, from warm-up to cool-down.' },
      { icon: 'bell', title: 'Gentle nudges', body: 'Reminders that respect your calendar, never your sleep.' },
      { icon: 'users', title: 'Train together', body: 'Challenges with friends and a feed without the noise.' },
      { icon: 'clock', title: '7-minute mode', body: 'Short on time? Full-body sessions that fit any break.' },
      { icon: 'sparkles', title: 'Progress you feel', body: 'Weekly reports that show how far you have come.' }
    ],
    priceTitle: 'Start free, go Pro anytime', priceSub: 'Cancel in two taps.',
    plans: [
      { name: 'Free', price: '$0', blurb: 'Daily plan and core workouts.', perks: ['Daily plan', '50 workouts', 'Streaks'], cta: 'Download' },
      { name: 'Pro', price: '$7.99', blurb: 'The full coach, every day.', perks: ['Adaptive plans', '1,200 workouts', 'Music sync', 'Wearables'], cta: 'Try Pro free' },
      { name: 'Family', price: '$12.99', blurb: 'Pro for up to six people.', perks: ['Six Pro accounts', 'Shared challenges', 'Kids mode'], cta: 'Get Family' }
    ],
    quote: '“I have tried every fitness app. Pulse is the first one I have opened every single day for a year.”', quoteName: 'Sofia Ramos', quoteRole: 'Pro member since 2025',
    avatarImage: UNSPLASH('photo-1438761681033-6461ffad8d80'),
    faq: COMMON_FAQ('Pulse'), footLine: 'Pulse Labs, made with care in Lisbon and Brooklyn.'
  }
];

async function importImages(theme) {
  const urls = [theme.heroImage, theme.avatarImage].filter(Boolean);
  const assets = {};
  for (const url of urls) {
    const got = await canvasOp('import_link', { url }).catch((e) => ({ failed: e.message }));
    if (got.asset?.id) {
      assets[url] = got.asset.id;
    } else {
      console.warn(`image skipped: ${url} ${got.failed ?? ''}`);
    }
  }
  return assets;
}

async function buildFrame(theme, width, at, assets) {
  const tree = landing(theme, width);
  textFloor = width * TEXT_FLOOR_SHARE;
  measure(tree, width);
  place(tree, 0, 0);
  const frame = { w: width, h: tree.mh };
  const nodes = flatten(tree);

  const drawn = await onCanvas('draw_frame', { x: at.x, y: at.y, w: frame.w, h: frame.h });
  try {
    return await fillFrame(drawn.frame_id, theme, frame, nodes, assets);
  } catch (error) {
    await canvasOp('delete_node', { nodeId: drawn.frame_id });
    throw error;
  }
}

async function fillFrame(nodeId, theme, frame, nodes, assets) {
  const width = frame.w;
  const fonts = [...new Set([theme.font, theme.display].filter(Boolean))].map((family) => ({ tool: 'register_font', input: { family } }));
  const setup = [{ tool: 'set_canvas', input: { width: frame.w, height: frame.h, duration: CLIP_SECONDS, still: STILL_AT } }, ...fonts];
  await batch(nodeId, setup);

  const made = await batch(nodeId, nodes.map((n) => clipOp(n, frame, assets)));
  made.forEach((res, i) => (nodes[i].id = res.clip_id));

  const containers = nodes.filter(isContainer).reverse();
  await batch(nodeId, containers.flatMap(layoutOps));

  const deco = await batch(nodeId, decorationOps(theme, frame));
  await batch(nodeId, [{ tool: 'parent_clips', input: { clip_ids: deco.map((d) => d.clip_id) } }, ...styleOps(theme, nodes, frame)]);

  const shot = SHOTS_DIR ? await saveShot(nodeId, `${theme.key}-${width}`) : null;
  return { nodeId, width: frame.w, height: frame.h, clips: nodes.length + deco.length + 1, ...(shot ? { shot } : {}) };
}

async function saveShot(nodeId, name) {
  const exported = await tool(nodeId, 'export_image', { format: 'jpg', scale: 1 });
  const bytes = Buffer.from(await (await fetch(exported.output.url)).arrayBuffer());
  mkdirSync(SHOTS_DIR, { recursive: true });
  const path = resolve(SHOTS_DIR, `${name}.jpg`);
  writeFileSync(path, bytes);
  return path;
}

const FREE_W = 420;

async function freeElements(y) {
  const left = ORIGIN.x;
  const draw = async (shape, b, props) => {
    const made = await onCanvas('draw_element', { drawn: { tool: shape, box: b } });
    await tool(made.frame_id, 'set_props', { clip_id: made.clip_id, props });
    return made.frame_id;
  };

  const cardA = [
    await draw('rectangle', { left, top: y, width: FREE_W, height: 260 }, { fill: '#4f46e5', radius: 24 }),
    await draw('ellipse', { left: left + 300, top: y + 30, width: 90, height: 90 }, { fill: '#06b6d4' }),
    await draw('text', { left: left + 32, top: y + 150, width: 340, height: 60 }, { text: 'Free sticker group', color: '#ffffff', size: 34, weight: 700 })
  ];
  const cardB = [
    await draw('rectangle', { left: left + 520, top: y, width: FREE_W, height: 260 }, { fill: '#1b1712' }),
    await draw('rectangle', { left: left + 560, top: y + 40, width: 120, height: 180 }, { fill: '#b08d57' }),
    await draw('text', { left: left + 700, top: y + 100, width: 220, height: 60 }, { text: 'A/W 26', color: '#f4efe6', size: 40, weight: 500 })
  ];
  const loose = [
    await draw('ellipse', { left: left + 1040, top: y, width: 200, height: 200 }, { fill: '#22c55e' }),
    await draw('rectangle', { left: left + 1300, top: y, width: 240, height: 240 }, { fillKind: 'none', strokeKind: 'solid', stroke: '#e11d74', strokeWidth: 6, radius: 40 }),
    await draw('text', { left: left + 1600, top: y + 60, width: 500, height: 80 }, { text: 'Loose type on the canvas', color: '#24061a', size: 44, weight: 600 })
  ];

  const groupA = await onCanvas('group_elements', { nodeIds: cardA });
  const groupB = await onCanvas('group_elements', { nodeIds: cardB });
  return { loose, groups: [groupA.frame_id, groupB.frame_id] };
}

async function canvasNodeIds() {
  const listed = await onCanvas('list_nodes', {});
  return new Set((listed.nodes ?? listed).map((n) => n.id));
}

function readFixture() {
  return existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : null;
}

const fixtureComplete = (fixture, ids) => fixture && fixture.landings.length === THEMES.length && fixture.landings.every((l) => ids.has(l.desktop.nodeId) && ids.has(l.mobile.nodeId));

const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);

function overflows(theme, width) {
  const tree = landing(theme, width);
  textFloor = width * TEXT_FLOOR_SHARE;
  measure(tree, width);
  place(tree, 0, 0);
  return flatten(tree).filter((n) => n.x < 0 || n.x + n.mw > width).map((n) => `${n.k} ${n.text ?? n.name ?? ''} x=${n.x} w=${n.mw}`);
}

async function preview() {
  const theme = THEMES.find((t) => t.key === ONLY);
  const wide = [DESKTOP_W, MOBILE_W].flatMap((w) => overflows(theme, w));
  if (wide.length) {
    console.log(wide.join('\n'));
    return;
  }
  const assets = await importImages(theme);
  const desktop = await buildFrame(theme, DESKTOP_W, { x: ORIGIN.x, y: -8000 }, assets);
  const mobile = await buildFrame(theme, MOBILE_W, { x: ORIGIN.x + MOBILE_OFFSET, y: -8000 }, assets);
  console.log(JSON.stringify({ desktop, mobile }));
}

async function main() {
  if (ONLY) {
    await preview();
    return;
  }
  const existing = readFixture();
  if (fixtureComplete(existing, await canvasNodeIds())) {
    console.log('landings already on the canvas, nothing to do');
    return;
  }

  const landings = [];
  let bottom = 0;
  for (const [i, theme] of THEMES.entries()) {
    const at = { x: ORIGIN.x + i * PAIR_STEP, y: ORIGIN.y };
    const assets = await importImages(theme);
    const desktop = await buildFrame(theme, DESKTOP_W, at, assets);
    const mobile = await buildFrame(theme, MOBILE_W, { x: at.x + MOBILE_OFFSET, y: at.y }, assets);
    bottom = Math.max(bottom, desktop.height, mobile.height);
    landings.push({ key: theme.key, name: theme.name, desktop, mobile });
    console.log(`${theme.key}: desktop ${desktop.nodeId} (${desktop.clips} clips), mobile ${mobile.nodeId} (${mobile.clips} clips)`);
  }
  const free = await freeElements(ORIGIN.y + bottom + 300);

  const strip = (f) => ({ nodeId: f.nodeId, width: f.width, height: f.height, clips: f.clips });
  const fixture = { projectId: PROJECT_ID, canvasId: CANVAS_ID, landings: landings.map((l) => ({ ...l, desktop: strip(l.desktop), mobile: strip(l.mobile) })), free };
  writeFileSync(FIXTURE, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`wrote ${FIXTURE}`);
}

await main();

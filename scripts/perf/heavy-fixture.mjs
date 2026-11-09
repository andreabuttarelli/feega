import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const GPU_DOCS = ['asteroids', 'supasito', 'generative', 'post', 'easing'].map((name) => JSON.parse(readFileSync(`${ROOT}tests/e2e/fixtures/gpu-docs/${name}.json`, 'utf8')));
const PROJECT_ID = '00000000-0000-4000-8000-0000000be201';
const CANVAS_ID = '00000000-0000-4000-8000-0000000be202';
const EXPORTED_AT = '2026-11-09T00:00:00.000Z';
const FPS = 30;
const DURATION = 30;
const SEED = 20261109;
const IMAGES = 36;
const IMAGE_PX = 1024;
const JPEG_QUALITY = 82;
const GAP = 400;
const ROW_GAP = 1200;
const SECTION_PX = 900;
const PAGE_WIDTH = 1280;
const PAGE_HEIGHTS = [5400, 7200, 9000, 6300, 8100, 5000, 7600, 8800, 6000, 9000, 5800, 7000];
const POSTS = 14;
const SLIDES = 9;
const POST_PX = 1080;
const SLIDE = { width: 1920, height: 1080 };
const VIEWS = [
  { id: 'tablet', name: 'Tablet', width: 810 },
  { id: 'phone', name: 'Phone', width: 390 }
];
const PALETTES = [
  ['#0b0f17', '#1f5eff', '#7c3aed', '#f5f7fb', '#ffffff'],
  ['#111111', '#ff5a1f', '#ffb020', '#fff7ed', '#fffaf3'],
  ['#062a1f', '#12b981', '#a3e635', '#effdf6', '#ffffff'],
  ['#1b1030', '#e11d77', '#6366f1', '#fdf2f8', '#ffffff']
];
const HEADLINES = ['Close the month in three days', 'Ship the launch film tonight', 'Every frame, one canvas', 'Design that moves with you', 'Your brand, in motion', 'From brief to post in minutes'];
const BODY = 'Ledgers reconcile at six, the checklist assigns itself, and the reviewers see only the accounts that moved. Teams spend the week on decisions instead of tick-and-tie.';
const LINES = ['Auto-matched reconciliations', 'Flux analysis without pivots', 'Intercompany that nets out', 'Audit-ready by construction', 'Two-way ledger sync', 'Named owners on every task'];

const uuid = (kind, i) => `00000000-0000-4000-${kind}-${String(i).padStart(12, '0')}`;

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const solid = (color, opacity = 1) => ({ type: 'solid', color, opacity, visible: true, blend: 'normal' });
const linear = (from, to, angle) => ({ type: 'linear-gradient', stops: [{ color: from, pos: 0 }, { color: to, pos: 1 }], angle, opacity: 1, visible: true, blend: 'normal' });
const radial = (from, to) => ({ type: 'radial-gradient', stops: [{ color: from, pos: 0 }, { color: to, pos: 1 }], opacity: 1, visible: true, blend: 'normal' });
const effect = (id, kind, params) => ({ id, kind, enabled: true, params });
const blur = (id, radius) => effect(id, 'gaussian-blur', { radius });
const backdrop = (id, radius) => effect(id, 'background-blur', { radius });
const shadow = (id, y, size, opacity) => effect(id, 'drop-shadow', { distance: 0, angle: 90, x: 0, y, blur: size, spread: 0, color: '#0b1220', opacity, behind: 1 });
const ellipseMask = (feather) => ({ kind: 'ellipse', mode: 'add', x: 0.5, y: 0.5, width: 0.9, height: 0.9, rotation: 0, feather, expansion: 0, opacity: 1, invert: false, points: [[0, 0], [1, 0], [1, 1]], assetId: null, text: 'TEXT' });

class Doc {
  constructor(id, width, height) {
    this.id = id;
    this.width = width;
    this.height = height;
    this.clips = [];
    this.images = new Set();
    this.counts = { elements: 0, blur: 0, shadow: 0, backdrop: 0, mask: 0, clip: 0, gradient: 0, rotated: 0, opacity: 0, text: 0, image: 0 };
  }

  get unit() {
    return Math.min(this.width, this.height);
  }

  place(left, top, width, height) {
    return { x: (left + width / 2) / this.width, y: (top + height / 2) / this.height, width: width / this.width, height: height / this.height };
  }

  add(component, props, extra = {}) {
    const id = `${this.id}-${this.clips.length}`;
    this.clips.push({ id, from: 0, durationInFrames: DURATION, component, props, name: extra.name ?? component, parent: extra.parent ?? null, trimStart: 0, transitionIn: { kind: 'none', durationInFrames: 0 }, transitionOut: { kind: 'none', durationInFrames: 0 }, transform: extra.transform ?? {}, keyframes: {}, mask: null, maskStack: extra.maskStack ?? [], matte: 'none', depth: 0, space: 'world', parentOpacity: 'inherit', expressions: {}, effects: extra.effects ?? [], shaders: [], blend: 'normal', animators: [], textPath: null, motionBlur: true, path: null, ...(extra.clipContent ? { clipContent: true } : {}), ...(extra.overrides ? { overrides: extra.overrides } : {}) });
    this.counts.elements++;
    this.tally(extra, props);
    return id;
  }

  tally(extra, props) {
    for (const e of extra.effects ?? []) {
      const key = { 'gaussian-blur': 'blur', 'drop-shadow': 'shadow', 'background-blur': 'backdrop' }[e.kind];
      this.counts[key]++;
    }
    this.counts.mask += extra.maskStack?.length ? 1 : 0;
    this.counts.clip += extra.clipContent ? 1 : 0;
    this.counts.rotated += extra.transform?.rotateZ ? 1 : 0;
    this.counts.opacity += props.opacity !== undefined && props.opacity < 1 ? 1 : 0;
    this.counts.gradient += (props.fills ?? []).some((f) => f.type !== 'solid') ? 1 : 0;
  }

  rect(left, top, width, height, fills, extra = {}) {
    return this.add('Shape', { ...this.place(left, top, width, height), shape: extra.shape ?? 'rect', fills, strokes: [], roundness: extra.radius ? Math.min(0.5, extra.radius / Math.min(width, height)) : 0, ...(extra.opacity !== undefined ? { opacity: extra.opacity } : {}) }, extra);
  }

  text(left, top, width, height, text, size, color, extra = {}) {
    this.counts.text++;
    return this.add('Text', { ...this.place(left, top, width, height), text, size: size / this.unit, weight: extra.weight ?? 400, color, font: 'Inter', leading: 1.35, tracking: extra.tracking ?? 0, align: extra.align ?? 'left' }, extra);
  }

  image(left, top, width, height, assetId, extra = {}) {
    this.counts.image++;
    this.images.add(assetId);
    return this.add('Image', { ...this.place(left, top, width, height), assetId, fit: 'cover', ...(extra.radius ? { roundness: Math.min(0.5, extra.radius / Math.min(width, height)) } : {}) }, extra);
  }

  doc(breakpoints) {
    return { version: GPU_DOCS[0].version, fps: FPS, width: this.width, height: this.height, durationInFrames: DURATION, tracks: [{ id: 'v1', kind: 'visual', name: 'Layers', clips: this.clips }], comps: {}, assets: [...this.images].map((id) => ({ id, kind: 'image', name: '' })), camera: null, look: null, fonts: [{ family: 'Inter', source: 'google', category: 'sans', weights: [400, 500, 600, 700], italic: false, axes: [] }], background: 'transparent', motionBlur: GPU_DOCS[0].motionBlur, fields: [], components: {}, shaders: {}, still: { frame: 0 }, ...(breakpoints ? { breakpoints } : {}) };
  }
}

function hero(d, top, palette, pick) {
  const [ink, brand, accent, wash] = palette;
  const w = d.width;
  d.rect(0, top, w, SECTION_PX, [linear(ink, brand, 135)], { name: 'Hero background' });
  d.rect(w * 0.55, top + 80, 520, 520, [radial(accent, brand)], { name: 'Glow', shape: 'ellipse', effects: [blur(`${d.id}-g${top}`, 80)], opacity: 0.7 });
  d.text(80, top + 140, w - 160, 180, HEADLINES[pick(HEADLINES.length)], 72, '#ffffff', { weight: 600, tracking: -0.04, overrides: { tablet: { 'props.size': 52 / d.unit }, phone: { 'props.size': 36 / d.unit } } });
  d.text(80, top + 340, 640, 90, BODY, 20, wash, { opacity: 0.85 });
  d.rect(80, top + 460, 180, 52, [solid(accent)], { name: 'Button', radius: 10, effects: [shadow(`${d.id}-bs${top}`, 8, 24, 0.3)] });
  d.text(100, top + 474, 140, 24, 'Start free trial', 16, ink, { weight: 600 });
  const card = d.rect(80, top + 560, w - 160, 300, [solid('#ffffff', 0.12)], { name: 'Glass card', radius: 18, clipContent: true, effects: [backdrop(`${d.id}-bb${top}`, 24), shadow(`${d.id}-cs${top}`, 24, 64, 0.2)] });
  d.image(100, top + 580, (w - 200) / 2, 260, IMAGE_IDS[pick(IMAGES)], { parent: card, radius: 12 });
  LINES.slice(0, 4).forEach((line, i) => d.text(w / 2 + 40, top + 600 + i * 60, w / 2 - 160, 40, line, 18, '#ffffff', { parent: card, weight: 500 }));
}

function features(d, top, palette, pick) {
  const [ink, brand, , wash] = palette;
  const w = d.width;
  d.rect(0, top, w, SECTION_PX, [solid(wash)], { name: 'Features background' });
  d.text(80, top + 80, 800, 60, 'Every step of month-end in one place', 44, ink, { weight: 600, tracking: -0.03, overrides: { phone: { hidden: true } } });
  const cell = (w - 160 - 48) / 3;
  for (let i = 0; i < 6; i++) {
    const left = 80 + (i % 3) * (cell + 24);
    const y = top + 200 + Math.floor(i / 3) * 330;
    const card = d.rect(left, y, cell, 300, [solid('#ffffff')], { name: 'Feature card', radius: 16, clipContent: true, effects: [shadow(`${d.id}-f${top}-${i}`, 12, 32, 0.1)] });
    d.image(left, y, cell, 140, IMAGE_IDS[pick(IMAGES)], { parent: card });
    d.text(left + 24, y + 160, cell - 48, 20, `0${i + 1}`, 13, brand, { parent: card, weight: 600 });
    d.text(left + 24, y + 186, cell - 48, 30, LINES[i], 20, ink, { parent: card, weight: 600 });
    d.text(left + 24, y + 222, cell - 48, 60, BODY.slice(0, 90), 14, '#3d4451', { parent: card });
  }
}

function gallery(d, top, palette, pick) {
  const [ink, brand, accent] = palette;
  const w = d.width;
  d.rect(0, top, w, SECTION_PX, [linear('#ffffff', palette[3], 180)], { name: 'Gallery background' });
  const group = d.rect(w / 2 - 300, top + 120, 600, 600, [solid(brand, 0.08)], { name: 'Rotated group', radius: 40, transform: { rotateZ: -8 } });
  for (let i = 0; i < 4; i++) {
    d.image(w / 2 - 280 + (i % 2) * 290, top + 140 + Math.floor(i / 2) * 290, 270, 270, IMAGE_IDS[pick(IMAGES)], { parent: group, radius: 20, transform: { rotateZ: 4 * (i - 1.5) } });
  }
  d.image(80, top + 200, 320, 320, IMAGE_IDS[pick(IMAGES)], { name: 'Masked portrait', maskStack: [ellipseMask(12)] });
  d.image(w - 400, top + 260, 320, 420, IMAGE_IDS[pick(IMAGES)], { name: 'Masked still', maskStack: [ellipseMask(40)], effects: [shadow(`${d.id}-ms${top}`, 18, 40, 0.25)] });
  d.rect(w - 260, top + 60, 200, 200, [solid(accent)], { shape: 'star', opacity: 0.5, effects: [blur(`${d.id}-st${top}`, 12)], transform: { rotateZ: 18 } });
  d.text(80, top + 760, w - 160, 60, 'Controllers at 1,400 companies close with us', 28, ink, { weight: 500, align: 'center' });
}

function quote(d, top, palette) {
  const [ink, , accent] = palette;
  const w = d.width;
  d.rect(0, top, w, SECTION_PX, [solid(ink)], { name: 'Quote background' });
  d.rect(-100, top + 200, 600, 600, [radial(accent, ink)], { shape: 'ellipse', effects: [blur(`${d.id}-q${top}`, 120)], opacity: 0.5 });
  d.text(160, top + 220, w - 320, 280, `“${BODY}”`, 34, '#ffffff', { weight: 500, align: 'center' });
  d.text(160, top + 560, w - 320, 30, 'Dana Reyes · Corporate Controller', 16, '#c4cad6', { align: 'center' });
  for (let i = 0; i < 12; i++) {
    d.text(80 + (i % 4) * ((w - 160) / 4), top + 660 + Math.floor(i / 4) * 60, (w - 160) / 4 - 20, 40, LINES[i % LINES.length], 14, '#8a909c', { opacity: 0.6 + (i % 3) * 0.1 });
  }
}

const SECTIONS = [hero, features, gallery, quote];

function landing(i, pick) {
  const height = PAGE_HEIGHTS[i];
  const d = new Doc(`p${i}`, PAGE_WIDTH, height);
  const palette = PALETTES[i % PALETTES.length];
  for (let s = 0; s * SECTION_PX < height; s++) {
    SECTIONS[s % SECTIONS.length](d, s * SECTION_PX, palette, pick);
  }
  return d;
}

function post(i, pick) {
  const d = new Doc(`s${i}`, POST_PX, POST_PX);
  const [ink, brand, accent, wash] = PALETTES[i % PALETTES.length];
  d.rect(0, 0, POST_PX, POST_PX, [linear(brand, ink, 45 + i * 20)], { name: 'Background' });
  d.image(0, 0, POST_PX, POST_PX, IMAGE_IDS[pick(IMAGES)], { name: 'Photo', opacity: 0.55 });
  d.rect(700, -100, 500, 500, [radial(accent, brand)], { shape: 'ellipse', effects: [blur(`${d.id}-b`, 90)], opacity: 0.8 });
  const panel = d.rect(80, 600, 920, 400, [solid('#ffffff', 0.14)], { radius: 28, clipContent: true, effects: [backdrop(`${d.id}-bb`, 30), shadow(`${d.id}-sh`, 30, 80, 0.3)] });
  d.text(120, 640, 840, 200, HEADLINES[i % HEADLINES.length], 76, '#ffffff', { parent: panel, weight: 700, tracking: -0.05 });
  d.text(120, 860, 840, 100, BODY.slice(0, 110), 26, wash, { parent: panel });
  d.image(760, 120, 240, 240, IMAGE_IDS[pick(IMAGES)], { maskStack: [ellipseMask(8)], transform: { rotateZ: 12 } });
  d.text(80, 80, 400, 40, '@feega', 28, wash, { weight: 600 });
  return d;
}

function slide(i, pick) {
  const d = new Doc(`k${i}`, SLIDE.width, SLIDE.height);
  const [ink, brand, accent, wash] = PALETTES[i % PALETTES.length];
  d.rect(0, 0, SLIDE.width, SLIDE.height, [solid(wash)], { name: 'Background' });
  d.rect(1100, -200, 1000, 1000, [radial(brand, wash)], { shape: 'ellipse', effects: [blur(`${d.id}-b`, 140)], opacity: 0.6 });
  d.text(140, 140, 900, 260, HEADLINES[(i + 2) % HEADLINES.length], 96, ink, { weight: 600, tracking: -0.05 });
  LINES.forEach((line, n) => d.text(140, 480 + n * 70, 820, 50, `—  ${line}`, 30, '#3d4451'));
  const device = d.rect(1080, 160, 680, 760, [solid('#ffffff')], { radius: 32, clipContent: true, transform: { rotateZ: -4 }, effects: [shadow(`${d.id}-d`, 40, 100, 0.25)] });
  d.image(1100, 180, 640, 420, IMAGE_IDS[pick(IMAGES)], { parent: device, radius: 20 });
  d.rect(1100, 620, 640, 280, [linear(brand, accent, 90)], { parent: device, radius: 20, opacity: 0.9 });
  d.text(1130, 660, 580, 200, BODY.slice(0, 120), 26, '#ffffff', { parent: device, weight: 500 });
  return d;
}

const IMAGE_IDS = Array.from({ length: IMAGES }, (_, i) => uuid('8203', i));

const viewsWidth = (doc) => (doc.breakpoints ?? []).reduce((sum, view) => sum + view.width + GAP, 0);

function layout(docs) {
  const rows = [docs.filter((d) => d.kind === 'landing'), docs.filter((d) => d.kind !== 'landing')];
  const placed = [];
  let y = 0;
  for (const row of rows) {
    let x = 0;
    let tallest = 0;
    for (const d of row) {
      placed.push({ ...d, at: { x, y } });
      x += d.doc.width + GAP + viewsWidth(d.doc);
      tallest = Math.max(tallest, d.doc.height);
    }
    y += tallest + ROW_GAP;
  }
  return placed;
}

function frameNode(d, i) {
  const { doc, at } = d;
  const format = doc.width === doc.height ? '1:1' : doc.width > doc.height ? '16:9' : '4:5';
  return { node: { id: uuid('8201', i), type: 'motion', displayName: d.name, position: { ...at, z: i }, size: { width: doc.width, height: doc.height }, data: { format, docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, interactive: false } }, head: { version: 1, doc } };
}

function imageAsset(i) {
  return { id: IMAGE_IDS[i], type: 'image', mimeType: 'image/jpeg', width: IMAGE_PX, height: IMAGE_PX, durationS: null, content: null, url: null, file: `assets/heavy-${i}.jpg` };
}

async function picture(i) {
  const pixels = Buffer.alloc(IMAGE_PX * IMAGE_PX * 3);
  const cx = (i * 97) % IMAGE_PX;
  const cy = (i * 193) % IMAGE_PX;
  for (let y = 0; y < IMAGE_PX; y++) {
    for (let x = 0; x < IMAGE_PX; x++) {
      const at = (y * IMAGE_PX + x) * 3;
      const r = Math.hypot(x - cx, y - cy);
      pixels[at] = (128 + 127 * Math.sin(r / (18 + i))) & 255;
      pixels[at + 1] = ((x * (i + 3)) >> 3) & 255;
      pixels[at + 2] = ((y * (i + 5)) >> 3 ^ (i * 31)) & 255;
    }
  }
  return new Uint8Array(await sharp(pixels, { raw: { width: IMAGE_PX, height: IMAGE_PX, channels: 3 } }).jpeg({ quality: JPEG_QUALITY }).toBuffer());
}

export function heavyFixture() {
  const random = seeded(SEED);
  const pick = (n) => Math.floor(random() * n);
  const built = [
    ...PAGE_HEIGHTS.map((_, i) => ({ kind: 'landing', name: `Landing ${i + 1}`, doc: landing(i, pick).doc(i % 2 ? undefined : VIEWS) })),
    ...Array.from({ length: POSTS }, (_, i) => ({ kind: 'post', name: `Post ${i + 1}`, doc: post(i, pick).doc() })),
    ...Array.from({ length: SLIDES }, (_, i) => ({ kind: 'slide', name: `Slide ${i + 1}`, doc: slide(i, pick).doc() })),
    ...GPU_DOCS.map((doc, i) => ({ kind: 'motion', name: `Motion ${i + 1}`, doc }))
  ];
  const frames = layout(built).map(frameNode);
  const assets = IMAGE_IDS.map((_, i) => imageAsset(i));
  const canvas = { nodes: frames.map((f) => f.node), connections: [], heads: Object.fromEntries(frames.map((f) => [f.node.id, f.head])), assets };
  const manifest = { format: 'feega', version: 1, exportedAt: EXPORTED_AT, canvasName: 'heavy bench', source: { projectId: PROJECT_ID, canvasId: CANVAS_ID } };
  return { manifest, canvas, files: assets.map((a) => a.file) };
}

export function heavyStats() {
  const random = seeded(SEED);
  const pick = (n) => Math.floor(random() * n);
  const docs = [...PAGE_HEIGHTS.map((_, i) => landing(i, pick)), ...Array.from({ length: POSTS }, (_, i) => post(i, pick)), ...Array.from({ length: SLIDES }, (_, i) => slide(i, pick))];
  const totals = docs.reduce((sum, d) => Object.fromEntries(Object.entries(d.counts).map(([k, v]) => [k, (sum[k] ?? 0) + v])), {});
  return { frames: docs.length + GPU_DOCS.length, generated: totals };
}

export const HEAVY_FIXTURE_PLACE = { projectId: PROJECT_ID, canvasId: CANVAS_ID };
export const HEAVY_FIXTURE_CENTRE = { x: (PAGE_WIDTH + GAP) * 4, y: 3000 };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { manifest, canvas, files } = heavyFixture();
  const blobs = Object.fromEntries(await Promise.all(files.map(async (file, i) => [file, await picture(i)])));
  writeFileSync(process.argv[2], zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'canvas.json': strToU8(JSON.stringify(canvas)), ...blobs }));
  console.log(JSON.stringify(heavyStats()));
}

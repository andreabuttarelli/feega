export const MELT_VIEW = String.raw`
const PAGE_MARGIN = 0.04;
const SEGMENTS = 9;
const TAIL = 1.6;
const ERODE = 0.9;
const GRAIN_FLOOR = 0.22;
const GLOW = 'blur(3px)';
const GLOW_ALPHA = 0.55;
const FLOW = 0.05;

root.insertAdjacentHTML('beforeend', '<div class="mt"><div class="mt-page">'
  + '<p class="mt-kicker mt-melts"></p><h1 class="mt-index mt-melts"></h1><h1 class="mt-title mt-melts"></h1>'
  + '<h2 class="mt-sub"></h2><p class="mt-col mt-left"></p><p class="mt-col mt-right"></p><p class="mt-foot"></p><p class="mt-credit"></p>'
  + '<canvas class="mt-canvas"></canvas></div></div>');

const scene = root.querySelector('.mt');
const page = root.querySelector('.mt-page');
const canvas = root.querySelector('.mt-canvas');
const ctx = canvas.getContext('2d');
const source = document.createElement('canvas');
const sourceCtx = source.getContext('2d');
const streaks = document.createElement('canvas');
const streakCtx = streaks.getContext('2d');
const grain = document.createElement('canvas');
const melting = [...root.querySelectorAll('.mt-melts')];
const slot = (name) => root.querySelector('.mt-' + name);

let cache = { textKey: '', lookKey: '', sizeKey: '', columnsKey: '', columns: [] };

const fontFamily = (font) => (String(font).includes(',') ? font : '"' + font + '", "Helvetica Neue", Helvetica, Arial, sans-serif');

const lineSpans = (node, value) => {
  node.textContent = '';
  String(value || '').split('\n').forEach((line) => {
    const span = document.createElement('span');
    span.className = 'mt-line';
    span.textContent = line || ' ';
    node.appendChild(span);
  });
};

const paintText = (p) => {
  const key = JSON.stringify([p.title, p.subtitle, p.index, p.kicker, p.bodyLeft, p.bodyRight, p.footer, p.credit]);
  if (key === cache.textKey) {
    return;
  }
  cache = { ...cache, textKey: key, sizeKey: '' };
  lineSpans(slot('kicker'), p.kicker);
  lineSpans(slot('index'), p.index);
  lineSpans(slot('title'), p.title);
  slot('sub').textContent = p.subtitle;
  slot('left').textContent = p.bodyLeft;
  slot('right').textContent = p.bodyRight;
  slot('foot').textContent = p.footer;
  slot('credit').textContent = p.credit;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.page, p.surround, p.ink, p.font]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key, sizeKey: '' };
  const s = scene.style;
  s.setProperty('--mt-page', p.page);
  s.setProperty('--mt-surround', p.surround);
  s.setProperty('--mt-ink', p.ink);
  s.setProperty('--mt-font', fontFamily(p.font));
};

const placePage = () => {
  const box = pageBox(scene.clientWidth || 1920, scene.clientHeight || 1080, PAGE_MARGIN);
  const s = page.style;
  s.left = box.x + 'px';
  s.top = box.y + 'px';
  s.width = box.w + 'px';
  s.height = box.h + 'px';
  return { w: Math.round(box.w), h: Math.round(box.h) };
};

const grainFor = (w, h) => {
  grain.width = w;
  grain.height = h * 2;
  const g = grain.getContext('2d');
  const image = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = hash01(x * 7919 + Math.floor(y / 2) * 104729, 9);
      image.data[(y * w + x) * 4 + 3] = n < GRAIN_FLOOR ? 0 : Math.round(255 * Math.pow(n, 0.6));
    }
  }
  g.putImageData(image, 0, 0);
  g.putImageData(image, 0, h);
};

const measureLines = () => {
  const origin = page.getBoundingClientRect();
  return melting.flatMap((node) => {
    const style = getComputedStyle(node);
    return [...node.querySelectorAll('.mt-line')].map((span) => {
      const r = span.getBoundingClientRect();
      return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height, text: span.textContent, font: style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily, spacing: style.letterSpacing };
    });
  });
};

const fitCanvases = (size) => {
  const key = JSON.stringify([size.w, size.h, cache.textKey, cache.lookKey]);
  if (key === cache.sizeKey) {
    return;
  }
  [canvas, source, streaks].forEach((c) => {
    c.width = size.w;
    c.height = size.h;
  });
  grainFor(size.w, size.h);
  cache = { ...cache, sizeKey: key };
};

const columnsFor = (p, w) => {
  const width = Math.max(1, Math.round((w * p.columnWidth) / 1000));
  const count = Math.ceil(w / width);
  const key = JSON.stringify([width, count]);
  if (key !== cache.columnsKey) {
    cache = { ...cache, columnsKey: key, columns: meltColumns(count, p) };
  }
  return { width, list: cache.columns };
};

const paintSource = (p, size, lines) => {
  sourceCtx.clearRect(0, 0, size.w, size.h);
  sourceCtx.fillStyle = p.ink;
  sourceCtx.textBaseline = 'alphabetic';
  lines.forEach((line) => {
    sourceCtx.font = line.font;
    sourceCtx.letterSpacing = line.spacing === 'normal' ? '0px' : line.spacing;
    const m = sourceCtx.measureText(line.text);
    const ascent = m.fontBoundingBoxAscent;
    const content = ascent + m.fontBoundingBoxDescent;
    sourceCtx.fillText(line.text, line.x, line.y + (line.h - content) / 2 + ascent);
  });
};

const drip = (line, x, width, melt, size) => {
  const from = line.y + line.h * melt.split;
  const band = line.y + line.h - from;
  const fall = band + melt.drop * size.h;
  for (let j = 0; j < SEGMENTS; j++) {
    streakCtx.globalAlpha = melt.fade * Math.pow(1 - j / SEGMENTS, TAIL);
    streakCtx.drawImage(source, x, from, width, band, x, from + (fall * j) / SEGMENTS, width, fall / SEGMENTS + 0.5);
  }
};

const paintMelt = (p, t, size, lines) => {
  const columns = columnsFor(p, size.w);
  ctx.clearRect(0, 0, size.w, size.h);
  ctx.drawImage(source, 0, 0);
  streakCtx.clearRect(0, 0, size.w, size.h);
  streakCtx.globalCompositeOperation = 'source-over';
  lines.forEach((line) => {
    const first = Math.max(0, Math.floor(line.x / columns.width));
    const last = Math.min(columns.list.length - 1, Math.floor((line.x + line.w) / columns.width));
    for (let i = first; i <= last; i++) {
      const column = columns.list[i];
      const melt = meltAt(column, p, t, duration);
      if (melt.fade <= 0) {
        continue;
      }
      const x = i * columns.width;
      ctx.clearRect(x, line.y, columns.width, line.h);
      ctx.globalAlpha = 1 - ERODE * melt.fade;
      ctx.drawImage(source, x, line.y, columns.width, line.h, x, line.y, columns.width, line.h);
      ctx.globalAlpha = 1;
      drip(line, x, columns.width, { ...melt, split: column.split }, size);
    }
  });
  streakCtx.globalAlpha = 1;
  streakCtx.globalCompositeOperation = 'destination-in';
  const shift = Math.round((t * FLOW * size.h) % size.h);
  streakCtx.drawImage(grain, 0, size.h - shift, size.w, size.h, 0, 0, size.w, size.h);
  streakCtx.globalCompositeOperation = 'source-over';
  ctx.filter = GLOW;
  ctx.globalAlpha = GLOW_ALPHA;
  ctx.drawImage(streaks, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.drawImage(streaks, 0, 0);
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  paintLook(p);
  paintText(p);
  const size = placePage();
  fitCanvases(size);
  const lines = measureLines();
  paintSource(p, size, lines);
  paintMelt(p, t, size, lines);
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;

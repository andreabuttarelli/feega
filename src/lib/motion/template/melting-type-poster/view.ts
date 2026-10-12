export const MELT_VIEW = String.raw`
const PAGE_MARGIN = 0.04;
const SLOTS = ['kicker', 'credit', 'title', 'index', 'sub', 'left', 'mid', 'right', 'foot'];

root.insertAdjacentHTML('beforeend', '<div class="mt"><div class="mt-page">'
  + SLOTS.map((name) => '<p class="mt-text mt-' + name + '"></p>').join('')
  + '<canvas class="mt-canvas"></canvas></div></div>');

const scene = root.querySelector('.mt');
const page = root.querySelector('.mt-page');
const canvas = root.querySelector('.mt-canvas');
const ctx = canvas.getContext('2d');
const source = document.createElement('canvas');
const sourceCtx = source.getContext('2d', { willReadFrequently: true });
const slot = (name) => root.querySelector('.mt-' + name);

let cache = { textKey: '', lookKey: '', sandKey: '', grains: null, frame: null, rgb: [255, 255, 255] };

const fontFamily = (font) => (String(font).includes(',') ? font : '"' + font + '", "Helvetica Neue", Helvetica, Arial, sans-serif');

const wordSpans = (node, value) => {
  node.textContent = '';
  String(value || '').split('\n').forEach((line, i) => {
    if (i > 0) {
      node.appendChild(document.createElement('br'));
    }
    line.split(' ').forEach((word, j) => {
      if (j > 0) {
        node.appendChild(document.createTextNode(' '));
      }
      const span = document.createElement('span');
      span.className = 'mt-word';
      span.textContent = word;
      node.appendChild(span);
    });
  });
};

const rgbOf = (colour) => {
  sourceCtx.clearRect(0, 0, 1, 1);
  sourceCtx.fillStyle = colour;
  sourceCtx.fillRect(0, 0, 1, 1);
  const d = sourceCtx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
};

const paintText = (p) => {
  const key = JSON.stringify([p.title, p.subtitle, p.index, p.kicker, p.bodyLeft, p.bodyMid, p.bodyRight, p.footer, p.credit]);
  if (key === cache.textKey) {
    return;
  }
  cache = { ...cache, textKey: key };
  const values = { kicker: p.kicker, credit: p.credit, title: p.title, index: p.index, sub: p.subtitle, left: p.bodyLeft, mid: p.bodyMid, right: p.bodyRight, foot: p.footer };
  SLOTS.forEach((name) => wordSpans(slot(name), values[name]));
};

const paintLook = (p) => {
  const key = JSON.stringify([p.page, p.surround, p.ink, p.font]);
  if (key === cache.lookKey) {
    return;
  }
  const s = scene.style;
  s.setProperty('--mt-page', p.page);
  s.setProperty('--mt-surround', p.surround);
  s.setProperty('--mt-font', fontFamily(p.font));
  cache = { ...cache, lookKey: key };
};

const placePage = () => {
  const box = pageBox(scene.clientWidth || 1080, scene.clientHeight || 1350, PAGE_MARGIN);
  const s = page.style;
  s.left = box.x + 'px';
  s.top = box.y + 'px';
  s.width = box.w + 'px';
  s.height = box.h + 'px';
  return { w: Math.round(box.w), h: Math.round(box.h) };
};

const measureWords = () => {
  const origin = page.getBoundingClientRect();
  return [...root.querySelectorAll('.mt-word')].filter((span) => span.textContent).map((span) => {
    const style = getComputedStyle(span);
    const r = span.getBoundingClientRect();
    return { x: r.left - origin.left, y: r.top - origin.top, h: r.height, text: span.textContent, font: style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily, spacing: style.letterSpacing };
  });
};

const paintSource = (size, words) => {
  source.width = size.w;
  source.height = size.h;
  sourceCtx.fillStyle = '#fff';
  sourceCtx.textBaseline = 'alphabetic';
  words.forEach((word) => {
    sourceCtx.font = word.font;
    sourceCtx.letterSpacing = word.spacing === 'normal' ? '0px' : word.spacing;
    const m = sourceCtx.measureText(word.text);
    const ascent = m.fontBoundingBoxAscent;
    const content = ascent + m.fontBoundingBoxDescent;
    sourceCtx.fillText(word.text, word.x, word.y + (word.h - content) / 2 + ascent);
  });
  const rgba = sourceCtx.getImageData(0, 0, size.w, size.h).data;
  const alpha = new Uint8Array(size.w * size.h);
  for (let k = 0; k < alpha.length; k++) {
    alpha[k] = rgba[k * 4 + 3];
  }
  return alpha;
};

const buildSand = (p, size) => {
  const words = measureWords();
  const key = JSON.stringify([size, words, document.fonts ? document.fonts.status : '', p.strength, p.meltAt, p.spread, p.gravity, p.wind, duration]);
  if (key === cache.sandKey) {
    return;
  }
  canvas.width = size.w;
  canvas.height = size.h;
  const grains = sandGrains(paintSource(size, words), size.w, size.h, p, duration);
  cache = { ...cache, sandKey: key, grains, frame: ctx.createImageData(size.w, size.h), rgb: rgbOf(p.ink) };
};

const paintSand = (t, size) => {
  const { grains, frame, rgb } = cache;
  const data = frame.data;
  data.fill(0);
  for (let i = 0; i < grains.count; i++) {
    const [x, y] = grainAt(grains, i, t);
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= size.w || py >= size.h) {
      continue;
    }
    const k = (py * size.w + px) * 4;
    data[k] = rgb[0];
    data[k + 1] = rgb[1];
    data[k + 2] = rgb[2];
    data[k + 3] = Math.min(255, data[k + 3] + grains.a[i]);
  }
  ctx.putImageData(frame, 0, 0);
};

const draw = () => {
  const p = { ...props };
  paintLook(p);
  paintText(p);
  const size = placePage();
  buildSand(p, size);
  paintSand(tl.time(), size);
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;

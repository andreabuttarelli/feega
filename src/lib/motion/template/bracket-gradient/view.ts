export const BRACKET_VIEW = String.raw`
const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const BLOB_INKS = ['violet', 'red', 'orange', 'ember', 'haze'];
const BLOB_STOPS = [[100, 0], [80, 0.3], [35, 0.65], [0, 1]];

root.insertAdjacentHTML('beforeend', '<div class="bg"><div class="bg-mesh"></div><p class="bg-text"></p>' + CORNERS.map(() => '<div class="bg-mark"></div>').join('') + '</div>');

const scene = root.querySelector('.bg');
const mesh = root.querySelector('.bg-mesh');
const line = root.querySelector('.bg-text');
const marks = [...root.querySelectorAll('.bg-mark')];

let cache = { wordsKey: '', words: [], lookKey: '', measureKey: '', box: null };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });
const fontsReady = () => (document.fonts ? document.fonts.status : 'loaded');
const fontOf = (p) => (String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');

const buildWords = (p) => {
  const key = String(p.headline);
  if (key === cache.wordsKey) {
    return cache.words;
  }
  const parts = String(p.headline).trim().split(/\s+/).filter(Boolean);
  line.innerHTML = '';
  const words = parts.map((word, i) => {
    const span = document.createElement('span');
    span.className = 'bg-word';
    span.textContent = word + (i < parts.length - 1 ? ' ' : '');
    line.appendChild(span);
    return span;
  });
  cache = { ...cache, wordsKey: key, words, measureKey: '' };
  return words;
};

const paintLook = (p) => {
  const key = JSON.stringify([p.background, p.textColor, p.markColor, p.font, p.fontWeight, p.tracking, p.markSize]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key, measureKey: '' };
  const s = scene.style;
  s.setProperty('--bg-base', p.background);
  s.setProperty('--bg-ink', p.textColor);
  s.setProperty('--bg-mark-ink', p.markColor);
  s.setProperty('--bg-mark', p.markSize + 'em');
  s.setProperty('--bg-font', fontOf(p));
  s.setProperty('--bg-weight', String(p.fontWeight));
  s.setProperty('--bg-tracking', p.tracking + 'em');
};

const measure = (p) => {
  const { width, height } = sizeOf();
  const px = (p.fontSize * Math.min(width, height)) / 100;
  const key = JSON.stringify([width, height, px, p.maxWidth, cache.wordsKey, cache.lookKey, fontsReady()]);
  if (key === cache.measureKey) {
    return cache.box;
  }
  scene.style.setProperty('--bg-px', px + 'px');
  line.style.width = 'max-content';
  line.style.maxWidth = (width * p.maxWidth) / 100 + 'px';
  const rect = line.getBoundingClientRect();
  const box = { w: rect.width / px, h: rect.height / px };
  cache = { ...cache, measureKey: key, box };
  return box;
};

const blobLayer = (b, ink, size) => {
  const r = b.r * Math.max(size.width, size.height);
  const stops = BLOB_STOPS.map(([alpha, at]) => 'color-mix(in srgb, ' + ink + ' ' + alpha + '%, transparent) ' + (at * r).toFixed(1) + 'px');
  return 'radial-gradient(circle at ' + (b.x * 100).toFixed(3) + '% ' + (b.y * 100).toFixed(3) + '%, ' + stops.join(', ') + ')';
};

const paintMesh = (p, blobs) => {
  const size = sizeOf();
  mesh.style.background = blobs.map((b, i) => blobLayer(b, p[BLOB_INKS[i]], size)).reverse().join(', ');
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const words = buildWords(p);
  paintLook(p);
  const box = measure(p);
  const f = bracketFrame(p, box, t, duration, words.length);

  paintMesh(p, f.blobs);
  marks.forEach((mark, i) => {
    const [sx, sy] = CORNERS[i];
    mark.style.opacity = String(f.marks);
    mark.style.transform = 'translate(-50%, -50%) translate(' + sx * f.half.x + 'em, ' + sy * f.half.y + 'em)';
  });
  f.words.forEach((w, i) => {
    words[i].style.opacity = String(w.opacity);
    words[i].style.transform = 'translateY(' + w.rise + 'em)';
  });
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;

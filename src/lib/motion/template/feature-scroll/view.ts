export const SCROLL_VIEW = String.raw`
const COLUMN_WIDTH = 0.84;
const STREAK_FLOOR = 0.05;
const STREAK_CAP = 2;
const SVG = 'http://www.w3.org/2000/svg';

const filterId = 'fs-streak-' + document.querySelectorAll('.fs').length;

root.insertAdjacentHTML('beforeend', '<div class="fs"><div class="fs-view"><div class="fs-column"></div></div></div>');

const scene = root.querySelector('.fs');
const column = root.querySelector('.fs-column');

const svg = document.createElementNS(SVG, 'svg');
svg.setAttribute('class', 'fs-filter');
const filter = document.createElementNS(SVG, 'filter');
filter.setAttribute('id', filterId);
filter.setAttribute('x', '-5%');
filter.setAttribute('y', '-50%');
filter.setAttribute('width', '110%');
filter.setAttribute('height', '200%');
const gauss = document.createElementNS(SVG, 'feGaussianBlur');
filter.appendChild(gauss);
svg.appendChild(filter);
scene.appendChild(svg);

let cache = { key: '', layout: null, open: [], close: null, closeWords: [], lines: [], lookKey: '' };

const sizeOf = () => ({ width: scene.clientWidth || 1920, height: scene.clientHeight || 1080 });

const cased = (text, p) => (p.lowercase ? String(text).toLowerCase() : String(text));

const titleNode = (text, p) => {
  const node = document.createElement('div');
  node.className = 'fs-text fs-title';
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const spans = (words.length ? words : [' ']).map((word, i) => {
    const span = document.createElement('span');
    span.className = 'fs-word';
    span.textContent = cased(word, p) + (i < words.length - 1 ? ' ' : '');
    node.appendChild(span);
    return span;
  });
  return { node, spans };
};

const lineNode = (text, p) => {
  const node = document.createElement('div');
  node.className = 'fs-text fs-line';
  const dot = document.createElement('i');
  dot.className = 'fs-dot';
  const label = document.createElement('span');
  label.textContent = cased(text, p);
  node.appendChild(dot);
  node.appendChild(label);
  return node;
};

const build = (p) => {
  const { width, height } = sizeOf();
  const key = JSON.stringify([width, height, p.lines, p.repeat, p.fontSize, p.lineSpacing, p.gap, p.openTitle, p.closeTitle, p.lowercase]);
  if (key === cache.key) {
    return cache;
  }
  const unit = Math.min(width, height);
  const layout = scrollLayout(p, width, height);
  column.innerHTML = '';
  const place = (node, y) => {
    node.style.top = y * unit + 'px';
    column.appendChild(node);
    return node;
  };
  const open = titleNode(p.openTitle, p);
  place(open.node, 0);
  const lines = layout.lines.map((line) => place(lineNode(line.text, p), line.y));
  const close = titleNode(p.closeTitle, p);
  place(close.node, layout.closeY);
  cache = { ...cache, key, layout, open: open.spans, close: close.node, closeWords: close.spans, lines, lookKey: '' };
  return cache;
};

const paintLook = (p, layout) => {
  const { width, height } = sizeOf();
  const key = JSON.stringify([width, height, p.background, p.textColor, p.markerColor, p.font, p.fontSize, p.fontWeight, p.tracking, p.align, p.marker, p.edgeFade, layout.pitch]);
  if (key === cache.lookKey) {
    return;
  }
  cache = { ...cache, lookKey: key };
  const unit = Math.min(width, height);
  const s = scene.style;
  scene.dataset.align = p.align;
  scene.dataset.marker = p.marker;
  s.setProperty('--fs-bg', p.background);
  s.setProperty('--fs-ink', p.textColor);
  s.setProperty('--fs-mark', p.markerColor);
  s.setProperty('--fs-font', String(p.font).includes(',') ? p.font : '"' + p.font + '", system-ui, sans-serif');
  s.setProperty('--fs-size', String(p.fontSize));
  s.setProperty('--fs-weight', String(p.fontWeight));
  s.setProperty('--fs-tracking', p.tracking + 'em');
  s.setProperty('--fs-width', COLUMN_WIDTH * width + 'px');
  s.setProperty('--fs-fade', p.edgeFade * 100 + '%');
  s.setProperty('--fs-rule-drop', ((layout.pitch - layout.lineSize) / 2) * unit + 'px');
};

const CENTRED = 'translate(-50%, -50%) ';

const paintWord = (node, look, base = '') => {
  node.style.opacity = String(look.opacity);
  node.style.transform = base + 'translateY(' + look.rise + 'em)';
};

const draw = () => {
  const p = { ...props };
  const t = tl.time();
  const { width, height } = sizeOf();
  const unit = Math.min(width, height);
  const built = build(p);
  paintLook(p, built.layout);
  const f = scrollFrame(built.layout, p, t, duration, fps);

  column.style.transform = 'translate3d(0, ' + -f.camera * unit + 'px, 0)';
  const streak = Math.min(STREAK_CAP, f.streak) * built.layout.pitch * unit * 0.5;
  gauss.setAttribute('stdDeviation', '0 ' + streak.toFixed(2));
  column.style.filter = streak > STREAK_FLOOR * built.layout.pitch * unit ? 'url(#' + filterId + ')' : 'none';

  f.open.forEach((look, i) => paintWord(built.open[i], look));
  f.lines.forEach((look, i) => paintWord(built.lines[i], look, CENTRED));
  f.close.forEach((look, i) => paintWord(built.closeWords[i], look));
  built.close.style.opacity = String(f.closeOut.opacity);
  built.close.style.marginTop = f.closeOut.y + 'em';
};

draw();
tl.to({}, { duration, ease: 'none', onUpdate: draw }, 0);
`;

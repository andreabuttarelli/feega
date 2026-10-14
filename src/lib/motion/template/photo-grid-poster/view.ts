export const PHOTO_GRID_CSS = String.raw`
.pg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background-color: var(--pg-paper);
  background-image: linear-gradient(var(--pg-grid) 1px, transparent 1px), linear-gradient(90deg, var(--pg-grid) 1px, transparent 1px);
  background-size: var(--pg-cell) var(--pg-cell);
  color: var(--pg-ink);
  font-family: var(--pg-font);
  -webkit-font-smoothing: antialiased;
}

.pg-layer {
  position: absolute;
  inset: 0;
}

.pg-title {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-weight: var(--pg-weight);
  letter-spacing: var(--pg-tracking);
  text-transform: uppercase;
}

.pg-small {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 700;
  line-height: 1.18;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.pg-mark {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 700;
  letter-spacing: 0.1em;
  transform: rotate(90deg);
  transform-origin: 0 0;
}

.pg-cell {
  position: absolute;
  background: var(--pg-accent);
}

.pg-counter {
  position: absolute;
  margin: 0;
  color: var(--pg-paper);
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1;
}

.pg-index {
  position: absolute;
  margin: 0;
  white-space: pre;
  border-top: 2px solid var(--pg-ink);
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600;
  letter-spacing: 0.02em;
}
`;

export const PHOTO_GRID_VIEW = String.raw`
const TITLE_TOP = 0.25;
const TITLE_PITCH = 1.5;
const TITLE_EDGE = 0.5;
const SMALL = 0.0105;
const FRONT = 'f';
const FACADE_BLOCKS = 64;
const DESIGN_ROWS = 20;
const TITLE_ROWS = 9;

root.insertAdjacentHTML('beforeend', '<div class="pg"></div>');
const scene = root.querySelector('.pg');

const seq = (k) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const tileOf = (line) => {
  const words = String(line || '').trim().split(/[\s,]+/);
  const front = words.includes(FRONT);
  const [c, r, w, h] = numbersOf(words.filter((x) => x !== FRONT).join(' '));
  return { c, r, w: w || 1, h: h || 1, front };
};

const FACADE_FILLS = ['url(#pg-lit)', 'url(#pg-mid)', 'url(#pg-shade)'];

const num = (v) => v.toFixed(0);

const facade = (width, height) => {
  let out = '<rect width="' + width + '" height="' + height + '" fill="url(#pg-sky)"/>';
  for (let k = 0; k < FACADE_BLOCKS; k++) {
    const x = seq(k * 3 + 1) * width;
    const y = seq(k * 3 + 2) * height;
    const w = (0.05 + seq(k * 5 + 7) * 0.18) * width;
    const h = (0.04 + seq(k * 7 + 3) * 0.14) * height;
    out += '<rect x="' + num(x) + '" y="' + num(y) + '" width="' + num(w) + '" height="' + num(h) + '" fill="' + FACADE_FILLS[k % FACADE_FILLS.length] + '"/>';
    out += '<rect x="' + num(x) + '" y="' + num(y + h * 0.84) + '" width="' + num(w) + '" height="' + num(h * 0.16) + '" fill="#1c1c1c" opacity="0.55"/>';
    if (k % 3 === 0) {
      const r = Math.min(w, h) * 0.28;
      out += '<circle cx="' + num(x + w / 2) + '" cy="' + num(y + h / 2) + '" r="' + num(r) + '" fill="url(#pg-shade)" stroke="#e8e8e6" stroke-width="' + num(r * 0.1) + '"/>';
    }
    if (k % 3 === 1) {
      const side = Math.min(w, h) * 0.18;
      out += '<rect x="' + num(x + w * 0.2) + '" y="' + num(y + h * 0.2) + '" width="' + num(side * 1.6) + '" height="' + num(side) + '" fill="#2a2a2a" stroke="#ededeb" stroke-width="' + num(side * 0.14) + '"/>';
    }
  }
  return out + '<rect width="' + width + '" height="' + height + '" fill="url(#pg-mesh)"/>';
};

const draw = (p, width, height) => {
  const s = scene.style;
  const cell = width / Math.max(1, p.columns);
  s.setProperty('--pg-paper', p.paper);
  s.setProperty('--pg-ink', p.ink);
  s.setProperty('--pg-grid', p.gridColour);
  s.setProperty('--pg-accent', p.accent);
  s.setProperty('--pg-cell', cell + 'px');
  s.setProperty('--pg-font', fontOf(p.font));
  s.setProperty('--pg-weight', String(p.fontWeight));
  s.setProperty('--pg-tracking', p.tracking + 'em');

  const rows = height / cell;
  const spread = Math.max(1, (rows - TITLE_ROWS) / (DESIGN_ROWS - TITLE_ROWS));
  const rowAt = (r) => (r < TITLE_ROWS ? r : Math.round(TITLE_ROWS + (r - TITLE_ROWS) * spread));
  const placed = (t) => ({ ...t, r: rowAt(t.r) });

  const photos = photosOf(p.photos);
  const tiles = linesOf(p.tiles).filter((l) => l.trim()).map(tileOf).map(placed);
  const rect = (t) => '<rect x="' + t.c * cell + '" y="' + t.r * cell + '" width="' + t.w * cell + '" height="' + t.h * cell + '"/>';
  const picture = (k) =>
    photos.length
      ? '<image href="' + photos[k % photos.length] + '" width="' + width + '" height="' + height + '" preserveAspectRatio="xMidYMid slice" style="filter:grayscale(1) contrast(1.1)"/>'
      : '<g filter="url(#pg-soft)">' + facade(width, height) + '</g>';
  const defs =
    '<defs><linearGradient id="pg-sky" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#c4c4c1"/><stop offset="1" stop-color="#6a6a68"/></linearGradient>' +
    '<linearGradient id="pg-lit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2e2df"/><stop offset="1" stop-color="#9a9a97"/></linearGradient>' +
    '<linearGradient id="pg-mid" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9a9a6"/><stop offset="1" stop-color="#565654"/></linearGradient>' +
    '<linearGradient id="pg-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a5a58"/><stop offset="1" stop-color="#1e1e1e"/></linearGradient>' +
    '<pattern id="pg-mesh" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="1" fill="#000" opacity="0.12"/><rect width="1" height="5" fill="#000" opacity="0.08"/></pattern>' +
    '<filter id="pg-soft"><feGaussianBlur stdDeviation="1.2"/></filter>' +
    '<filter id="pg-noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="2.2" intercept="-0.5"/><feFuncG type="linear" slope="2.2" intercept="-0.5"/><feFuncB type="linear" slope="2.2" intercept="-0.5"/></feComponentTransfer></filter></defs>';

  const layer = (front) => {
    const own = tiles.map((t, i) => ({ t, i })).filter(({ t }) => t.front === front);
    const sources = Math.max(1, photos.length);
    let groups = '';
    let clips = '';
    for (let k = 0; k < sources; k++) {
      const id = 'pg-' + (front ? 'f' : 'b') + k;
      const mine = own.filter(({ i }) => i % sources === k);
      if (!mine.length) {
        continue;
      }
      clips += '<clipPath id="' + id + '">' + mine.map(({ t }) => rect(t)).join('') + '</clipPath>';
      groups += '<g clip-path="url(#' + id + ')">' + picture(k) + '<rect width="' + width + '" height="' + height + '" filter="url(#pg-noise)" opacity="' + p.grain + '" style="mix-blend-mode:multiply"/></g>';
    }
    const hits = own.map(({ t, i }) => '<rect' + part('tiles', i) + ' x="' + t.c * cell + '" y="' + t.r * cell + '" width="' + t.w * cell + '" height="' + t.h * cell + '" fill="transparent"/>').join('');
    return '<svg class="pg-layer" width="' + width + '" height="' + height + '">' + defs + clips + groups + hits + '</svg>';
  };

  const accents = linesOf(p.accentCells).filter((l) => l.trim()).map(tileOf).map(placed);
  const cells = accents.map((t, i) => '<div class="pg-cell"' + part('accentCells', i) + ' style="' + box(t.c * cell, t.r * cell, t.w * cell, t.h * cell) + '"></div>').join('');
  const host = accents[0];
  const counter = host ? '<div class="pg-counter"' + part('counter') + ' style="left:' + (host.c * cell + cell * 0.12) + 'px;top:' + (host.r * cell + cell * 0.12) + 'px;font-size:' + Math.min(host.w, host.h) * cell * 0.34 + 'px">' + escaped(p.counter) + '</div>' : '';

  const pitch = TITLE_PITCH * cell;
  const titleLines = linesOf(p.title);
  const title = '<div class="pg-title"' + part('title') + ' style="left:' + TITLE_EDGE * cell + 'px;top:' + TITLE_TOP * cell + 'px;line-height:' + pitch + 'px;font-size:' + pitch + 'px">' + escaped(titleLines.join('\n')) + '</div>';

  const small = SMALL * width;
  const places = linesOf(p.notePlaces);
  const notes = String(p.notes || '').split(/\n\s*\n/).map((text, i) => {
    const [c, r] = numbersOf(places[i]);
    const right = c >= p.columns / 2;
    const x = right ? 'right:' + (width - c * cell + cell * 0.15) + 'px;text-align:right' : 'left:' + (c * cell + cell * 0.5) + 'px';
    return '<div class="pg-small"' + part('notes', i) + ' style="' + x + ';top:' + rowAt(r) * cell + 'px;font-size:' + small + 'px">' + escaped(text.trim()) + '</div>';
  }).join('');

  const coords = linesOf(p.coords).map((text, i, all) => {
    const top = i === 0 ? cell * 0.5 : ((rows * (i + 0.4)) / all.length) * cell;
    return '<div class="pg-mark"' + part('coords', i) + ' style="left:' + (width - cell * 0.25) + 'px;top:' + top + 'px;font-size:' + small * 0.95 + 'px">' + escaped(text) + '</div>';
  }).join('');
  const index = '<div class="pg-index"' + part('index') + ' style="left:' + (p.columns - 6) * cell + 'px;width:' + 5 * cell + 'px;top:' + (Math.floor(rows) - 1) * cell + 'px;padding-top:' + small * 0.6 + 'px;font-size:' + small + 'px">' + escaped(p.index) + '</div>';

  scene.innerHTML = layer(false) + cells + title + layer(true) + counter + notes + coords + index;

  const titleEl = scene.querySelector('.pg-title');
  const room = width - TITLE_EDGE * cell * 2;
  if (titleEl.scrollWidth > room) {
    titleEl.style.fontSize = (pitch * room) / titleEl.scrollWidth + 'px';
  }
};
`;

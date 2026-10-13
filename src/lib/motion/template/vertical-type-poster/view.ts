export const VERTICAL_TYPE_CSS = String.raw`
.vt {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--vt-paper);
  color: var(--vt-ink);
  -webkit-font-smoothing: antialiased;
}

.vt-layer {
  position: absolute;
  inset: 0;
}

.vt-word {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-family: var(--vt-font);
  line-height: 1;
  letter-spacing: -0.02em;
  transform: rotate(-90deg);
  transform-origin: 0 0;
}

.vt-small {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-weight: 500;
  line-height: 1.05;
  letter-spacing: -0.01em;
  text-transform: uppercase;
}

.vt-list {
  display: grid;
  grid-template-columns: auto auto;
  column-gap: 1.2em;
}

.vt-counter {
  position: absolute;
  margin: 0;
  white-space: pre;
  color: var(--vt-paper);
  font-family: var(--vt-font);
  line-height: 1;
}
`;

export const VERTICAL_TYPE_VIEW = String.raw`
const RULE = 1.5;
const SMALL = 0.0145;
const WORD_INSET = 0.04;

root.insertAdjacentHTML('beforeend', '<div class="vt"></div>');
const scene = root.querySelector('.vt');

const cellsOf = (raw) => linesOf(raw).filter((l) => l.trim()).map((line) => {
  const [c, r, w, h] = numbersOf(line);
  return { c, r, w: w || 1, h: h || 1 };
});

const sample = (i, w, h) => {
  const tilt = i % 2 ? 24 : -14;
  const cx = w * (i % 2 ? 0.45 : 0.55);
  return '<rect width="' + w + '" height="' + h + '" fill="#000"/>' +
    '<ellipse cx="' + cx + '" cy="' + h * 0.6 + '" rx="' + w * 0.34 + '" ry="' + h * 0.7 + '" fill="url(#vt-glow)" transform="rotate(' + tilt + ' ' + cx + ' ' + h * 0.5 + ')"/>' +
    '<ellipse cx="' + w * 0.2 + '" cy="' + h * 0.82 + '" rx="' + w * 0.12 + '" ry="' + w * 0.1 + '" fill="url(#vt-glow)"/>' +
    '<rect x="0" y="' + h * 0.27 + '" width="' + w + '" height="' + Math.max(2, h * 0.006) + '" fill="#fff" opacity="0.8"/>';
};

const draw = (p, width, height) => {
  const s = scene.style;
  const cell = width / Math.max(1, p.columns);
  const rows = Math.ceil(height / cell);
  s.setProperty('--vt-paper', p.paper);
  s.setProperty('--vt-ink', p.ink);
  s.setProperty('--vt-font', fontOf(p.font));

  const at = (t) => box(t.c * cell, t.r * cell, t.w * cell, t.h * cell);
  const fill = (cells, colour, field) => cells.map((t, i) => '<div' + part(field, i) + ' style="position:absolute;' + at(t) + 'background:' + colour + '"></div>').join('');

  const photos = photosOf(p.photos);
  const k3 = 0.3 + p.grain * 0.9;
  const defs =
    '<defs><radialGradient id="vt-glow"><stop offset="0" stop-color="#fff"/><stop offset="0.55" stop-color="#bdbdbd"/><stop offset="1" stop-color="#000"/></radialGradient>' +
    '<filter id="vt-dither" x="0" y="0" width="1" height="1"><feColorMatrix type="saturate" values="0" result="g"/><feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="1"/><feColorMatrix type="saturate" values="0" result="n"/>' +
    '<feComposite in="g" in2="n" operator="arithmetic" k1="0" k2="1" k3="' + k3.toFixed(2) + '" k4="' + (-k3 / 2).toFixed(2) + '" result="m"/>' +
    '<feComponentTransfer in="m"><feFuncR type="discrete" tableValues="0 1"/><feFuncG type="discrete" tableValues="0 1"/><feFuncB type="discrete" tableValues="0 1"/></feComponentTransfer></filter></defs>';
  const pictures = cellsOf(p.photoCells).map((t, i) => {
    const w = t.w * cell;
    const h = t.h * cell;
    const body = photos.length ? '<image href="' + photos[i % photos.length] + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid slice"/>' : sample(i, w, h);
    return '<svg' + part('photoCells', i) + ' style="position:absolute;' + at(t) + '" width="' + w + '" height="' + h + '">' + (i === 0 ? defs : '') + '<g filter="url(#vt-dither)">' + body + '</g></svg>';
  });

  const rule = Math.max(1, (RULE * width) / 1080);
  let lines = '';
  for (let c = 0; c <= p.columns; c++) {
    lines += '<rect x="' + (c * cell - rule / 2) + '" y="0" width="' + rule + '" height="' + height + '"/>';
  }
  for (let r = 0; r <= rows; r++) {
    lines += '<rect x="0" y="' + (r * cell - rule / 2) + '" width="' + width + '" height="' + rule + '"/>';
  }
  const grid = '<svg class="vt-layer" width="' + width + '" height="' + height + '" fill="' + p.ink + '">' + lines + '</svg>';

  const size = p.wordSize * cell;
  const places = linesOf(p.wordPlaces);
  const words = linesOf(p.words).map((word, i) => {
    const [c, r] = numbersOf(places[i]);
    return '<div class="vt-word"' + part('words', i) + ' style="left:' + (c * cell + cell * WORD_INSET) + 'px;top:' + r * cell + 'px;font-size:' + size + 'px">' + escaped(word) + '</div>';
  }).join('');

  const blacks = cellsOf(p.blackCells);
  const host = blacks[blacks.length - 1];
  const small = SMALL * width;
  const counter = host ? '<div class="vt-counter"' + part('counter') + ' style="left:' + (host.c * cell + cell * 0.1) + 'px;top:' + (host.r * cell + cell * 0.1) + 'px;font-size:' + small * 1.6 + 'px">' + escaped(p.counter) + '</div>' : '';

  const listRows = linesOf(p.list).map((line) => line.split('|').map((x) => '<span>' + escaped(x.trim()) + '</span>').concat(['<span></span>']).slice(0, 2).join('')).join('');
  const listTop = (rows - 2) * cell + cell * 0.12;
  const list = '<div class="vt-small vt-list"' + part('list') + ' style="right:' + cell * 0.1 + 'px;top:' + listTop + 'px;font-size:' + small + 'px">' + listRows + '</div>';
  const caption = '<div class="vt-small"' + part('caption') + ' style="right:' + cell * 0.1 + 'px;top:' + ((rows - 3) * cell + cell * 0.12) + 'px;font-size:' + small + 'px;text-align:right">' + escaped(p.caption) + '</div>';

  scene.innerHTML = fill(blacks, p.ink, 'blackCells') + fill(cellsOf(p.accentCells), p.accent, 'accentCells') + pictures.join('') + grid + words + counter + caption + list;
};
`;

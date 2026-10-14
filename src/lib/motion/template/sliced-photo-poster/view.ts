export const SLICED_PHOTO_CSS = String.raw`
.sp {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--sp-paper);
  color: var(--sp-ink);
  font-family: var(--sp-font);
  -webkit-font-smoothing: antialiased;
}

.sp-layer {
  position: absolute;
  inset: 0;
}

.sp-phrase {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1;
  text-transform: uppercase;
}

.sp-small {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-weight: 600;
  line-height: 1.15;
  text-transform: uppercase;
}

.sp-ring {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--sp-ink);
  border-radius: 50%;
  font-weight: 500;
  line-height: 1;
}
`;

export const SLICED_PHOTO_VIEW = String.raw`
const PHRASE_PLACES = [[0.02, 0.02, 'left'], [0.02, 0.02, 'right'], [0.02, 0.34, 'left'], [0.02, 0.34, 'right'], [0.02, 0.68, 'left'], [0.02, 0.68, 'right']];
const LINE_REACH = [12, 14];

root.insertAdjacentHTML('beforeend', '<div class="sp"></div>');
const scene = root.querySelector('.sp');

const pad = (n) => String(n).padStart(2, '0');

const orb = (size) => {
  const r = size * 0.46;
  const c = size / 2;
  return '<defs><radialGradient id="sp-orb" cx="0.38" cy="0.32" r="0.8"><stop offset="0" stop-color="#d4d4d4"/><stop offset="0.4" stop-color="#3c3c3c"/><stop offset="1" stop-color="#050505"/></radialGradient>' +
    '<filter id="sp-pit"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 9 -5.4"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>' +
    '<rect x="' + (c - r * 0.06) + '" y="' + (c - r * 1.35) + '" width="' + r * 0.12 + '" height="' + r * 0.45 + '" fill="#1a1a1a" transform="rotate(-12 ' + c + ' ' + c + ')"/>' +
    '<circle cx="' + c + '" cy="' + (c + r * 0.05) + '" r="' + r + '" fill="url(#sp-orb)"/>' +
    '<circle cx="' + c + '" cy="' + (c + r * 0.05) + '" r="' + r + '" fill="#fff" opacity="0.22" filter="url(#sp-pit)"/>';
};

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--sp-paper', p.paper);
  s.setProperty('--sp-ink', p.ink);
  s.setProperty('--sp-font', fontOf(p.font));

  const size = (p.photoSize / 100) * width;
  const left = (width - size) / 2;
  const top = height * 0.5 - size / 2;
  const photos = photosOf(p.photos);
  const content = photos.length
    ? '<image href="' + photos[0] + '" width="' + size + '" height="' + size + '" preserveAspectRatio="xMidYMid slice" style="filter:grayscale(1) contrast(1.15)"/>'
    : orb(size);

  const strips = linesOf(p.strips).filter((l) => l.trim()).map(numbersOf);
  const sw = size / Math.max(1, strips.length);
  const pct = (v) => (v / 100) * size;
  const thin = Math.max(1, width / 900);
  const small = width * 0.0105;

  let clips = '';
  let pieces = '';
  let rules = '';
  let marks = '';
  strips.forEach(([dy, from, to], i) => {
    const id = 'sp-c' + i;
    clips += '<clipPath id="' + id + '"><rect x="' + i * sw + '" y="' + pct(from) + '" width="' + sw + '" height="' + pct(Math.max(0, to - from)) + '"/></clipPath>';
    pieces += '<g' + part('strips', i) + ' transform="translate(0 ' + pct(dy) + ')"><g clip-path="url(#' + id + ')">' + content + '</g></g>';
    const x = left + i * sw;
    const y1 = top + pct(from + dy - LINE_REACH[0]);
    const y2 = top + pct(to + dy + LINE_REACH[1]);
    rules += '<line x1="' + x + '" y1="' + y1 + '" x2="' + x + '" y2="' + y2 + '"/>';
    marks += '<div class="sp-small"' + part('index') + ' style="left:' + (x + small * 0.3) + 'px;top:' + (y2 - small * 1.2) + 'px;font-size:' + small * 0.8 + 'px">' + escaped(p.index + pad(i + 1)) + '</div>';
  });

  const photo = '<svg class="sp-layer"' + part('photos') + ' width="' + size + '" height="' + height + '" style="left:' + left + 'px;top:' + top + 'px;overflow:visible"><defs>' + clips + '</defs>' + pieces + '</svg>';
  const lines = '<svg class="sp-layer" width="' + width + '" height="' + height + '"><g stroke="' + p.ink + '" stroke-width="' + thin * 1.4 + '">' + rules + '</g></svg>';

  const phrasePx = (p.phraseSize / 100) * width;
  const phrases = linesOf(p.phrases).slice(0, PHRASE_PLACES.length).map((t, i) => {
    const [x, y, side] = PHRASE_PLACES[i];
    return '<div class="sp-phrase"' + part('phrases', i) + ' style="' + side + ':' + x * width + 'px;top:' + y * height + 'px;font-size:' + phrasePx + 'px">' + escaped(t) + '</div>';
  }).join('');

  const ring = phrasePx * 1.3;
  scene.innerHTML = photo + lines + phrases + marks +
    '<div class="sp-ring"' + part('marker') + ' style="' + box(width / 2 - ring / 2, height * 0.02 - ring * 0.12, ring, ring) + 'font-size:' + ring * 0.36 + 'px">' + escaped(p.marker) + '</div>' +
    '<div class="sp-small"' + part('code') + ' style="left:' + width * 0.78 + 'px;bottom:' + height * 0.03 + 'px;font-size:' + small + 'px">' + escaped(p.code) + '</div>' +
    upright(p.caption, width * 0.022, height * 0.97, small, p.ink);
};
`;

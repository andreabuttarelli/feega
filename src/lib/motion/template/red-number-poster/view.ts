export const RED_NUMBER_CSS = String.raw`
.rn {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--rn-paper);
  color: var(--rn-ink);
  font-family: var(--rn-font);
  -webkit-font-smoothing: antialiased;
}

.rn-title {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-weight: 500;
  letter-spacing: -0.055em;
  line-height: 1;
}

.rn-column {
  position: absolute;
  margin: 0;
  text-align: justify;
  line-height: 1.3;
}

.rn-photo {
  position: absolute;
  overflow: hidden;
}

.rn-tint {
  position: absolute;
  inset: 0;
  background: var(--rn-tint);
  mix-blend-mode: multiply;
}

.rn-word {
  position: absolute;
  margin: 0;
  white-space: pre;
  color: #ffffff;
  font-weight: 500;
  letter-spacing: -0.05em;
  line-height: 1;
}

.rn-side {
  position: absolute;
  white-space: pre;
  line-height: 1;
}

.rn-number {
  position: absolute;
  left: 0;
  right: 0;
  margin: 0;
  text-align: center;
  white-space: pre;
  color: var(--rn-number);
  font-weight: 400;
  letter-spacing: -0.06em;
  line-height: 0.74;
}

.rn-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--rn-tint);
  color: #ffffff;
  font-weight: 600;
  line-height: 1;
}

.rn-index {
  position: absolute;
  white-space: pre;
  border-top: 1.5px solid var(--rn-ink);
  line-height: 1;
}
`;

export const RED_NUMBER_VIEW = String.raw`
const GREYS = ['#ffffff', '#8c8c8c', '#0e0e0e'];
const WORD_PLACES = [[0.035, 0.035, 'left'], [0.035, 0.035, 'right'], [0.5, 0.56, 'centre'], [0.035, 0.94, 'left'], [0.035, 0.94, 'right']];
const SIDE_ROWS = [0, 0.4, 0.66];
const NUMBER_SIZE = 0.56;
const NUMBER_OVERLAP = 0.78;

root.insertAdjacentHTML('beforeend', '<div class="rn"></div>');
const scene = root.querySelector('.rn');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--rn-paper', p.paper);
  s.setProperty('--rn-ink', p.ink);
  s.setProperty('--rn-tint', p.tint);
  s.setProperty('--rn-number', p.numberColour);
  s.setProperty('--rn-font', fontOf(p.font));

  const edge = width * 0.06;
  const small = width * 0.0135;
  const size = (p.photoSize / 100) * width;
  const left = (width - size) / 2;
  const numberPx = width * NUMBER_SIZE;
  const group = size * NUMBER_OVERLAP + numberPx * 0.74;
  const top = Math.max(height * 0.17, (height * 1.15 - group) / 2);
  const wordPx = width * 0.037;

  const columns = String(p.columns || '').split(/\n\s*\n/).slice(0, 2).map((t, i) =>
    '<div class="rn-column"' + part('columns', i) + ' style="left:' + width * (0.54 + i * 0.22) + 'px;top:' + height * 0.035 + 'px;width:' + width * 0.19 + 'px;font-size:' + small + 'px">' + escaped(t.trim()) + '</div>').join('');

  const words = linesOf(p.words).slice(0, WORD_PLACES.length).map((t, i) => {
    const [x, y, side] = WORD_PLACES[i];
    const across = side === 'centre' ? 'left:50%;transform:translate(-50%,-50%)' : side + ':' + x * size + 'px';
    const down = 'top:' + (y * size - (side === 'centre' ? 0 : y > 0.5 ? wordPx : 0)) + 'px';
    return '<div class="rn-word"' + part('words', i) + ' style="' + across + ';' + down + ';font-size:' + wordPx + 'px">' + escaped(t) + '</div>';
  }).join('');

  const photo = '<div class="rn-photo"' + part('photos') + ' style="' + box(left, top, size, size) + '">' +
    picture(photosOf(p.photos), 0, size, size, GREYS, 'grayscale(1) contrast(1.2)', 'rn') + '<div class="rn-tint"></div>' + words + '</div>';

  const sides = linesOf(p.sides).slice(0, SIDE_ROWS.length).map((line, i) => {
    const [a, b] = line.split('|').map((t) => t.trim());
    const y = top + SIDE_ROWS[i] * size;
    return '<div class="rn-side"' + part('sides', i) + ' style="left:' + edge + 'px;top:' + y + 'px;font-size:' + small + 'px">' + escaped(a || '') + '</div>' +
      '<div class="rn-side"' + part('sides', i) + ' style="right:' + edge + 'px;top:' + y + 'px;font-size:' + small + 'px">' + escaped(b || '') + '</div>';
  }).join('');

  const ring = width * 0.065;
  scene.innerHTML =
    '<div class="rn-title"' + part('title') + ' style="left:' + edge + 'px;top:' + height * 0.03 + 'px;font-size:' + width * 0.062 + 'px">' + escaped(p.title) + '</div>' +
    '<div class="rn-index"' + part('index') + ' style="left:' + edge + 'px;top:' + (height * 0.03 + width * 0.085) + 'px;width:' + width * 0.3 + 'px;padding-top:' + small * 0.6 + 'px;font-size:' + small + 'px">' + escaped(p.index) + '</div>' +
    columns + photo + sides +
    '<div class="rn-number"' + part('number') + ' style="top:' + (top + size * NUMBER_OVERLAP) + 'px;font-size:' + numberPx + 'px">' + escaped(p.number) + '</div>' +
    '<div class="rn-marker"' + part('marker') + ' style="' + box(left + size - ring * 0.5, top - ring * 0.5, ring, ring) + 'font-size:' + ring * 0.36 + 'px">' + escaped(p.marker) + '</div>';

  const number = scene.querySelector('.rn-number');
  const room = width * 0.9;
  if (number.scrollWidth > room) {
    number.style.fontSize = (numberPx * room) / number.scrollWidth + 'px';
  }
};
`;

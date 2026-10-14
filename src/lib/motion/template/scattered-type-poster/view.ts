export const SCATTERED_TYPE_CSS = String.raw`
.st {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--st-paper);
  color: var(--st-ink);
  font-family: var(--st-font);
  font-stretch: 112%;
  -webkit-font-smoothing: antialiased;
}

.st-text {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-weight: 400;
  letter-spacing: -0.01em;
  line-height: 1.12;
  transform-origin: 0 0;
}

.st-photo {
  position: absolute;
  overflow: hidden;
}

.st-tag {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--st-ink);
  color: var(--st-paper);
  line-height: 1;
}

.st-dot {
  border-radius: 50%;
  background: var(--st-accent);
}

.st-label {
  position: absolute;
  white-space: pre;
  background: var(--st-ink);
  color: var(--st-paper);
  font-weight: 500;
  line-height: 1;
}

.st-index {
  position: absolute;
  white-space: pre;
  font-family: 'Space Mono', monospace;
  line-height: 1;
}

.st-caption {
  position: absolute;
  white-space: pre;
  border-top: 1.5px solid var(--st-ink);
  line-height: 1;
}
`;

export const SCATTERED_TYPE_VIEW = String.raw`
const TURNED = 90;
const CIRCLE = 'o';

root.insertAdjacentHTML('beforeend', '<div class="st"></div>');
const scene = root.querySelector('.st');

const pad = (n) => String(n).padStart(2, '0');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--st-paper', p.paper);
  s.setProperty('--st-ink', p.ink);
  s.setProperty('--st-accent', p.accent);
  s.setProperty('--st-font', fontOf(p.font));

  const X = (v) => (v / 100) * width;
  const Y = (v) => (v / 100) * height;
  const text = X(p.textSize);
  const small = width * 0.0125;
  const photos = photosOf(p.photos);
  const tones = [p.tint, '#7a0c08', '#1a0303'];

  const pictures = linesOf(p.slots).filter((l) => l.trim()).map((line, i) => {
    const [x, y, w, h] = numbersOf(line);
    const pw = X(w);
    const ph = X(h);
    return '<div class="st-index"' + part('index') + ' style="left:' + X(x) + 'px;top:' + (Y(y) - small * 1.5) + 'px;font-size:' + small + 'px">' + escaped(p.index + ' ' + pad(i + 1)) + '</div>' +
      '<div class="st-photo"' + part('slots', i) + ' style="' + box(X(x), Y(y), pw, ph) + '">' + picture(photos, i, pw, ph, tones, 'none', 'st') + '</div>';
  }).join('');

  const places = linesOf(p.places);
  const blocks = String(p.blocks || '').split(/\n\s*\n/).map((t, i) => {
    const [x, y, turn] = numbersOf(places[i]);
    const turned = turn === TURNED ? 'transform:rotate(90deg) translateY(-100%);' : '';
    return '<div class="st-text"' + part('blocks', i) + ' style="left:' + X(x) + 'px;top:' + Y(y) + 'px;font-size:' + text + 'px;' + turned + '">' + escaped(t.replace(/^\n+|\n+$/g, '')) + '</div>';
  }).join('');

  const tagSide = X(6.6);
  const tags = linesOf(p.tags).filter((l) => l.trim()).map((line, i) => {
    const circle = line.trim().split(/\s+/).includes(CIRCLE);
    const [x, y] = numbersOf(line.replace(CIRCLE, ''));
    const side = circle ? tagSide * 1.35 : tagSide;
    return circle
      ? '<div class="st-tag st-dot"' + part('marker') + ' style="' + box(X(x), Y(y), side, side) + 'font-size:' + side * 0.3 + 'px">' + escaped(p.marker) + '</div>'
      : '<div class="st-tag"' + part('tags', i) + ' style="' + box(X(x), Y(y), side, side) + 'font-size:' + side * 0.5 + 'px">' + escaped(p.tagText) + '</div>';
  }).join('');

  const big = width * 0.105;
  scene.innerHTML = pictures + blocks + tags +
    '<div class="st-text st-dates"' + part('dates') + ' style="left:' + X(4) + 'px;top:' + Y(1.5) + 'px;font-size:' + big + 'px;line-height:1">' + escaped(p.dates) + '</div>' +
    '<div class="st-caption"' + part('caption') + ' style="left:' + X(4.6) + 'px;width:' + X(38) + 'px;padding-top:' + small * 0.6 + 'px;font-size:' + small + 'px">' + escaped(p.caption) + '</div>' +
    '<div class="st-text"' + part('corner') + ' style="right:' + X(3.5) + 'px;top:' + Y(2.2) + 'px;font-size:' + text + 'px">' + escaped(p.corner) + '</div>' +
    '<div class="st-text"' + part('time') + ' style="right:' + X(3.5) + 'px;bottom:' + Y(1.2) + 'px;font-size:' + big + 'px;line-height:1;text-align:right">' + escaped(p.time) + '</div>' +
    '<div class="st-label"' + part('label') + ' style="left:' + X(4.5) + 'px;bottom:' + Y(2.6) + 'px;padding:' + small * 0.45 + 'px ' + small * 0.7 + 'px;font-size:' + text * 0.55 + 'px">' + escaped(p.label) + '</div>';

  const dates = scene.querySelector('.st-dates');
  scene.querySelector('.st-caption').style.top = dates.offsetTop + dates.offsetHeight + small * 1.2 + 'px';
};
`;

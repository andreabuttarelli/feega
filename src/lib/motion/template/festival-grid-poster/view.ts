export const FESTIVAL_GRID_CSS = String.raw`
.fg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--fg-paper);
  color: var(--fg-ink);
  font-family: var(--fg-body);
  -webkit-font-smoothing: antialiased;
}

.fg-layer {
  position: absolute;
  inset: 0;
}

.fg-title {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-family: var(--fg-font);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 0.92;
}

.fg-text {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-weight: 300;
  line-height: 1.12;
  text-transform: uppercase;
}

.fg-head {
  font-weight: 600;
}

.fg-photo {
  position: absolute;
  overflow: hidden;
}

.fg-cell {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  background: var(--fg-accent);
  color: var(--fg-paper);
  font-family: var(--fg-font);
  font-weight: 500;
  line-height: 0.8;
}

.fg-partner {
  position: absolute;
  display: flex;
  align-items: center;
  white-space: pre;
  font-weight: 500;
  line-height: 1;
}
`;

export const FESTIVAL_GRID_VIEW = String.raw`
const COLUMNS = [0.036, 0.274, 0.517, 0.759, 0.967];
const PHOTO_TONES = ['#eef2f3', '#b8c6cc', '#4d5d64'];
const ARROWS = [[-0.02, 0.105], [0.235, 0.5], [0.76, 1.02]];
const MARKS = [
  (s) => '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + s / 2 + '"/>',
  (s) => '<rect width="' + s + '" height="' + s + '"/>',
  (s) => '<polygon points="' + s / 2 + ',0 ' + s + ',' + s + ' 0,' + s + '"/>',
  (s) => '<rect width="' + s + '" height="' + s + '"/><circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + s / 3 + '" fill="#fff"/>'
];

root.insertAdjacentHTML('beforeend', '<div class="fg"></div>');
const scene = root.querySelector('.fg');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--fg-paper', p.paper);
  s.setProperty('--fg-ink', p.ink);
  s.setProperty('--fg-accent', p.accent);
  s.setProperty('--fg-font', fontOf(p.font));
  s.setProperty('--fg-body', fontOf(p.bodyFont));

  const X = (c) => COLUMNS[c] * width;
  const row = height / p.rows;
  const Y = (r) => r * row;
  const thin = Math.max(1, width / 1000);
  const text = width * 0.024;
  const pad = width * 0.006;

  let lines = COLUMNS.map((c) => '<line x1="' + c * width + '" y1="0" x2="' + c * width + '" y2="' + height + '"/>').join('');
  for (let r = 1; r < p.rows; r++) {
    lines += '<line x1="0" y1="' + Y(r) + '" x2="' + width + '" y2="' + Y(r) + '"/>';
  }
  const grid = '<g stroke="' + p.gridColour + '" stroke-width="' + thin + '">' + lines + '</g>';

  const arrowY = Y(3.5);
  const head = width * 0.07;
  const arrows = ARROWS.map(([a, b]) => {
    const x2 = b * width;
    return '<line x1="' + a * width + '" y1="' + arrowY + '" x2="' + x2 + '" y2="' + arrowY + '"/><polyline fill="none" points="' + (x2 - head) + ',' + (arrowY - head) + ' ' + x2 + ',' + arrowY + ' ' + (x2 - head) + ',' + (arrowY + head) + '"/>';
  }).join('');

  const dotR = width * 0.011;
  const dotRows = linesOf(p.dots).filter((l) => l.trim()).map((l) => numbersOf(l)[0]);
  const dots = dotRows.map((r) => '<circle cx="' + X(0) + '" cy="' + Y(r) + '" r="' + dotR + '"/>').join('');
  const dotLabels = dotRows.map((r, i) => '<div class="fg-text"' + part('dotLabel', i) + ' style="left:' + (X(0) + dotR * 1.8) + 'px;top:' + (Y(r) - text * 0.3) + 'px;font-size:' + text * 0.5 + 'px">' + escaped(p.dotLabel + (i + 1)) + '</div>').join('');

  const art = '<svg class="fg-layer" width="' + width + '" height="' + height + '">' + grid + '</svg>';
  const over = '<svg class="fg-layer" width="' + width + '" height="' + height + '"><g stroke="' + p.ink + '" stroke-width="' + thin * 1.6 + '">' + arrows + '</g><g fill="' + p.ink + '">' + dots + '</g></svg>';

  const photoW = X(4) - X(1);
  const photoH = Y(5) - Y(2);
  const photo = '<div class="fg-photo"' + part('photos') + ' style="' + box(X(1), Y(2), photoW, photoH) + '">' + picture(photosOf(p.photos), 0, photoW, photoH, PHOTO_TONES, 'none', 'fg') + '</div>';

  const titlePx = (p.titleSize / 100) * width;
  const title = '<div class="fg-title"' + part('title') + ' style="left:' + (X(1) - titlePx * 0.04) + 'px;top:' + Y(0.25) + 'px;font-size:' + titlePx + 'px">' + escaped(p.title) + '</div>';

  const block = (tag, x, y, value, size = text) => '<div class="fg-text"' + tag + ' style="left:' + (x + pad) + 'px;top:' + y + 'px;font-size:' + size + 'px">' + escaped(value) + '</div>';
  const column = (value, c, tag) => {
    const [heading, ...rest] = linesOf(value);
    return '<div class="fg-text"' + tag + ' style="left:' + (X(c) + pad) + 'px;top:' + Y(7.05) + 'px;font-size:' + text * 0.78 + 'px"><span class="fg-head">' + escaped(heading) + '</span>\n' + escaped(rest.join('\n')) + '</div>';
  };
  const programme = column(p.programme1, 0, part('programme1')) + column(p.programme2, 1, part('programme2')) + column(p.programme3, 2, part('programme3'));

  const markPx = text * 1.1;
  const partners = linesOf(p.partners).filter((l) => l.trim()).slice(0, MARKS.length).map((name, i) =>
    '<div class="fg-partner"' + part('partners', i) + ' style="left:' + (X(2) + (i * (X(4) - X(2))) / MARKS.length + pad) + 'px;top:' + (Y(p.rows - 0.75)) + 'px;height:' + markPx + 'px;gap:' + pad + 'px;font-size:' + text * 0.55 + 'px"><svg width="' + markPx + '" height="' + markPx + '" fill="' + p.ink + '">' + MARKS[i](markPx) + '</svg>' + escaped(name) + '</div>').join('');

  const cell = '<div class="fg-cell"' + part('counter') + ' style="' + box(X(3), Y(6), X(4) - X(3), row) + 'padding:' + pad * 2 + 'px;font-size:' + Math.min(row, (X(4) - X(3)) * 0.5) * 0.8 + 'px">' + escaped(p.counter) + '</div>';

  scene.innerHTML = art + photo + over + title +
    block(part('info'), X(0), Y(2.05), p.info) +
    block(part('edition'), X(1), Y(5.25), p.edition) +
    '<div class="fg-text"' + part('season') + ' style="right:' + (width - X(4) + pad) + 'px;top:' + Y(5.25) + 'px;font-size:' + text * 0.45 + 'px">' + escaped(p.season) + '</div>' +
    programme + partners + dotLabels + cell +
    upright(p.caption, X(4) + (width - X(4)) * 0.25, Y(p.rows - 1.2), text * 0.45, p.ink);

  const titleEl = scene.querySelector('.fg-title');
  const room = X(4) - X(1);
  const fit = Math.min(1, room / titleEl.scrollWidth, (Y(2) - Y(0.4)) / titleEl.scrollHeight);
  titleEl.style.fontSize = titlePx * fit + 'px';
};
`;

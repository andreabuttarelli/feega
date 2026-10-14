export const WHITE_SHAPES_CSS = String.raw`
.ws {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--ws-paper);
  color: var(--ws-accent);
  font-family: var(--ws-font);
  -webkit-font-smoothing: antialiased;
}

.ws-shapes {
  position: absolute;
  inset: 0;
}

.ws-text {
  position: absolute;
  margin: 0;
  white-space: pre;
}

.ws-title {
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.ws-info {
  font-weight: 600;
  line-height: 1.42;
  letter-spacing: -0.01em;
}

.ws-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ws-accent);
  color: var(--ws-paper);
  font-weight: 600;
  letter-spacing: -0.04em;
}

.ws-index {
  position: absolute;
  margin: 0;
  white-space: pre;
  font-weight: 600;
  border-top: 2px solid var(--ws-accent);
}
`;

export const WHITE_SHAPES_VIEW = String.raw`
const MARGIN = 0.055;
const MARKER = 0.075;

root.insertAdjacentHTML('beforeend', '<div class="ws"></div>');
const scene = root.querySelector('.ws');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--ws-paper', p.paper);
  s.setProperty('--ws-shape', p.shape);
  s.setProperty('--ws-accent', p.accent);
  s.setProperty('--ws-font', fontOf(p.font));

  const px = (v) => (v * width) / 100;
  const py = (v) => (v * height) / 100;
  const margin = MARGIN * width;

  const shapes = linesOf(p.shapes).filter((l) => l.trim()).map((line, i) => {
    const [x, y, w, h, top, foot] = numbersOf(line);
    const corners = [[px(x), py(y)], [px(x + w), py(y) + px(top)], [px(x + w), py(y + h) + px(foot)], [px(x), py(y + h)]];
    return '<polygon' + part('shapes', i) + ' points="' + corners.map((c) => c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(' ') + '"/>';
  });
  const svg = '<svg class="ws-shapes" width="' + width + '" height="' + height + '" fill="' + p.shape + '">' + shapes.join('') + '</svg>';

  const titleSize = px(p.titleSize);
  const title = '<div class="ws-text ws-title"' + part('title') + ' style="left:' + margin + 'px;top:' + margin * 0.8 + 'px;font-size:' + titleSize + 'px">' + escaped(p.title) + '</div>';
  const titleAlt = '<div class="ws-text ws-title"' + part('titleAlt') + ' style="right:' + margin + 'px;top:' + margin * 0.8 + 'px;text-align:right;font-size:' + titleSize * 0.5 + 'px">' + escaped(p.titleAlt) + '</div>';

  const infoSize = px(p.infoSize);
  const places = linesOf(p.places);
  const info = String(p.info || '').split(/\n\s*\n/).map((text, i) => {
    const [x, y] = numbersOf(places[i]);
    return '<div class="ws-text ws-info"' + part('info', i) + ' style="left:' + px(x) + 'px;top:' + py(y) + 'px;font-size:' + infoSize + 'px">' + escaped(text.trim()) + '</div>';
  }).join('');

  const d = MARKER * width;
  const marker = '<div class="ws-marker"' + part('marker') + ' style="' + box(px(p.markerX) - d / 2, py(p.markerY) - d / 2, d, d) + 'font-size:' + d * 0.42 + 'px">' + escaped(p.marker) + '</div>';
  const index = '<div class="ws-index"' + part('index') + ' style="left:' + margin + 'px;bottom:' + margin + 'px;padding-top:' + infoSize * 0.5 + 'px;font-size:' + infoSize * 0.8 + 'px">' + escaped(p.index) + '</div>';
  const caption = upright(p.caption, width - margin * 0.6, height - margin, infoSize * 0.7, p.accent);

  scene.innerHTML = svg + title + titleAlt + info + marker + index + caption;
};
`;

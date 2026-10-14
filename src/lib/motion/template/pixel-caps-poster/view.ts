export const PIXEL_CAPS_CSS = String.raw`
.pc {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--pc-paper);
  font-family: var(--pc-font);
  -webkit-font-smoothing: antialiased;
}

.pc-layer {
  position: absolute;
  inset: 0;
}

.pc-title {
  position: absolute;
  margin: 0;
  white-space: pre;
  text-transform: uppercase;
  line-height: 0.94;
  letter-spacing: -0.01em;
}

.pc-columns {
  position: absolute;
  display: flex;
}

.pc-column {
  text-align: justify;
  white-space: pre-line;
}

.pc-block {
  position: absolute;
}

.pc-photo {
  position: absolute;
  overflow: hidden;
}

.pc-text {
  position: absolute;
  white-space: pre;
  line-height: 1;
}
`;

export const PIXEL_CAPS_VIEW = String.raw`
const seed = (k) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

root.insertAdjacentHTML('beforeend', '<div class="pc"></div>');
const scene = root.querySelector('.pc');

const PIXEL_SEED = 9;

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--pc-paper', p.paper);
  s.setProperty('--pc-font', fontOf(p.font));

  const X = (v) => (v / 100) * width;
  const Y = (v) => (v / 100) * height;
  const small = width * 0.013;

  const px = width * 0.006;
  let pixels = '';
  const region = { x: X(p.pixelsX), y: Y(p.pixelsY), w: X(p.pixelsW), h: Y(p.pixelsH) };
  for (let i = 0; i < p.pixelCount; i++) {
    const x = region.x + seed(i * 2 + PIXEL_SEED) * region.w;
    const y = region.y + seed(i * 2 + 1 + PIXEL_SEED) * region.h;
    const size = px * (0.6 + seed(i * 3 + PIXEL_SEED) * 1.3);
    pixels += '<rect x="' + x + '" y="' + y + '" width="' + size + '" height="' + size + '" fill="' + p.pixelsColor + '"/>';
  }
  const texture = '<svg class="pc-layer" width="' + width + '" height="' + height + '">' + pixels + '</svg>';

  const blocks = linesOf(p.blackBlocks).filter((l) => l.trim()).map((line, i) => {
    const [x, y, w, h] = numbersOf(line);
    return '<div class="pc-block"' + part('blackBlocks', i) + ' style="' + box(X(x), Y(y), X(w), Y(h)) + 'background:' + p.blackBlocksColor + '"></div>';
  }).join('');

  const titlePx = (p.titleSize / 100) * width;
  const title = '<div class="pc-title"' + part('title') + ' style="left:' + X(p.titleX) + 'px;top:' + Y(p.titleY) + 'px;font-size:' + titlePx + 'px;font-weight:' + p.titleWeight + ';color:' + p.titleColor + '">' + escaped(p.title) + '</div>';

  const columns = String(p.columns || '').split(/\n\s*\n/).slice(0, 2).map((t, i) => '<div class="pc-column"' + part('columns', i) + ' style="width:' + X(20) + 'px;margin-right:' + X(2) + 'px">' + escaped(t.trim()) + '</div>').join('');
  const columnsHtml = '<div class="pc-columns" style="left:' + X(p.columnsX) + 'px;top:' + Y(p.columnsY) + 'px;font-size:' + small + 'px;color:' + p.columnsColor + '">' + columns + '</div>';

  const photos = photosOf(p.photos);
  const tones = [p.paper, '#9a8f7e', '#2a241c'];
  const indexPx = small * 0.8;
  const slots = linesOf(p.slots).filter((l) => l.trim()).map((line, i) => {
    const [x, y, w, h] = numbersOf(line);
    const pw = X(w);
    const ph = Y(h);
    return '<div class="pc-text"' + part('index', i) + ' style="left:' + X(x) + 'px;top:' + (Y(y) - indexPx * 1.4) + 'px;font-size:' + indexPx + 'px;color:' + p.indexColor + '">' + escaped(p.index + ' ' + String(i + 1).padStart(2, '0')) + '</div>' +
      '<div class="pc-photo"' + part('slots', i) + ' style="' + box(X(x), Y(y), pw, ph) + '">' + picture(photos, i, pw, ph, tones, 'none', 'pc') + '</div>';
  }).join('');

  const blockNumber = '<div class="pc-text"' + part('blockNumber') + ' style="left:' + X(p.blockNumberX) + 'px;top:' + Y(p.blockNumberY) + 'px;font-size:' + small * 2 + 'px;color:' + p.blockNumberColor + '">' + escaped(p.blockNumber) + '</div>';

  const blockLabel = '<div class="pc-text"' + part('blockLabel') + ' style="left:' + X(p.blockLabelX) + 'px;top:' + Y(p.blockLabelY) + 'px;font-size:' + small + 'px;color:' + p.blockLabelColor + '">' + escaped(p.blockLabel) + '</div>';

  scene.innerHTML = texture + blocks + title + columnsHtml + slots + blockNumber + blockLabel;
};
`;

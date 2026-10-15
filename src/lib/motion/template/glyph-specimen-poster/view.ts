import { POSTER_SHAPES, POSTER_TEXT } from '../poster-kit';

export const GLYPH_SPECIMEN_CSS = String.raw`
.gs {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--gs-paper);
  -webkit-font-smoothing: antialiased;
}

.gs-layer {
  position: absolute;
  inset: 0;
}

.gs-cells {
  position: absolute;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-auto-rows: 1fr;
}

.gs-cell {
  position: relative;
  overflow: hidden;
  border: 2px solid var(--gs-ink);
  margin: -1px;
}

.gs-glyph {
  position: absolute;
  line-height: 0.8;
  white-space: pre;
}
`;

export const GLYPH_SPECIMEN_VIEW = String.raw`
${POSTER_TEXT}
${POSTER_SHAPES}
root.insertAdjacentHTML('beforeend', '<div class="gs"></div>');
const scene = root.querySelector('.gs');

const AREA = { left: 11, top: 5, right: 9, bottom: 12 };
const RULED = 0.46;
const UP = 'transform-origin:0 0;transform:rotate(-90deg);';

const rulesHtml = (p, width, height) => {
  const top = (AREA.top / 100) * height;
  const deep = ((100 - AREA.top - AREA.bottom) / 100) * height * RULED;
  const step = deep / Math.max(1, p.rules);
  let lines = '';
  for (let i = 0; i <= p.rules; i++) {
    lines += '<rect x="' + (AREA.left / 100) * width + '" y="' + (top + i * step) + '" width="' + ((100 - AREA.left - AREA.right) / 100) * width + '" height="1"/>';
  }
  return '<svg class="gs-layer"' + part('rules') + ' width="' + width + '" height="' + height + '" fill="' + p.rulesColor + '">' + lines + '</svg>';
};

const cellsHtml = (p, width, height) => {
  const px = (p.glyphsSize / 100) * width;
  const cells = rowsOf(p.glyphs).map(([glyph, dx, dy], i) =>
    '<div class="gs-cell"><div class="gs-glyph"' + part('glyphs', i) + ' style="left:' + dx + '%;top:' + dy + '%;font-size:' + px + 'px;color:' + p.glyphsColor + '">' + escaped(glyph) + '</div></div>').join('');
  const box = 'left:' + AREA.left + '%;top:' + AREA.top + '%;right:' + AREA.right + '%;bottom:' + AREA.bottom + '%;';
  return '<div class="gs-cells" style="' + box + 'font-family:' + cssFont(p.glyphsFont) + ';font-weight:900">' + cells + '</div>';
};

const chainHtml = (p, width, height) => {
  const circles = rowsOf(p.chain).map(([x, y, r], i) => '<circle' + part('chain', i) + ' cx="' + (Number(x) / 100) * width + '" cy="' + (Number(y) / 100) * height + '" r="' + (Number(r) / 100) * width + '"/>').join('');
  return '<svg class="gs-layer" width="' + width + '" height="' + height + '"><defs>' + gooFilter('gsGoo', width * 0.01) + '</defs><g filter="url(#gsGoo)" fill="' + p.chainColor + '" opacity="0.94">' + circles + '</g></svg>';
};

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--gs-paper', p.paper);
  s.setProperty('--gs-ink', p.glyphsColor);
  s.fontFamily = fontOf(p.smallFont);
  const side = textPart(p, 'side', width, height, UP + 'font-size:' + width * 0.052 + 'px;font-weight:500;letter-spacing:-0.02em;');
  const dates = textPart(p, 'dates', width, height, UP + 'font-size:' + width * 0.04 + 'px;font-weight:700;letter-spacing:-0.02em;');
  const footer = textPart(p, 'footer', width, height, 'font-size:' + width * 0.06 + 'px;font-weight:600;letter-spacing:-0.03em;');
  const mono = 'font-family:' + cssFont('Space Mono') + ';';
  const small = textPart(p, 'features', width, height, mono + 'font-size:' + width * 0.0105 + 'px;line-height:1.3;') + textPart(p, 'index', width, height, mono + 'font-size:' + width * 0.011 + 'px;line-height:1.3;');
  const marker = textPart(p, 'marker', width, height, 'font-size:' + width * 0.05 + 'px;font-weight:700;line-height:1;');
  scene.innerHTML = rulesHtml(p, width, height) + cellsHtml(p, width, height) + side + footer + small + marker + chainHtml(p, width, height) + dates;
};
`;

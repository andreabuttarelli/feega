export const BARCODE_TABLE_CSS = String.raw`
.bt {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bt-paper);
  font-family: var(--bt-font);
  -webkit-font-smoothing: antialiased;
}

.bt-layer {
  position: absolute;
  inset: 0;
}

.bt-text {
  position: absolute;
  margin: 0;
  white-space: pre;
  line-height: 1.12;
}

.bt-rows {
  position: absolute;
  white-space: pre;
}

.bt-row {
  display: flex;
  justify-content: space-between;
}

.bt-counter {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-weight: 700;
}

.bt-partner {
  position: absolute;
  display: flex;
  align-items: center;
  white-space: pre;
  line-height: 1;
}
`;

export const BARCODE_TABLE_VIEW = String.raw`
const MARKS = [
  (s) => '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + s / 2 + '"/>',
  (s) => '<rect width="' + s + '" height="' + s + '"/>',
  (s) => '<polygon points="' + s / 2 + ',0 ' + s + ',' + s + ' 0,' + s + '"/>'
];

const BARCODE_BARS = 14;
const BARCODE_SEED = 7;
const GRID_ROWS = 10;

const seed = (k) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

root.insertAdjacentHTML('beforeend', '<div class="bt"></div>');
const scene = root.querySelector('.bt');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--bt-paper', p.paper);
  s.setProperty('--bt-font', fontOf(p.font));

  const X = (v) => (v / 100) * width;
  const Y = (v) => (v / 100) * height;
  const thin = Math.max(1, width / 1000);
  const small = width * 0.015;

  let lines = '';
  for (let c = 1; c < p.gridCols; c++) {
    lines += '<line x1="' + (c * width) / p.gridCols + '" y1="0" x2="' + (c * width) / p.gridCols + '" y2="' + height + '"/>';
  }
  for (let r = 1; r < GRID_ROWS; r++) {
    lines += '<line x1="0" y1="' + (r * height) / GRID_ROWS + '" x2="' + width + '" y2="' + (r * height) / GRID_ROWS + '"/>';
  }
  const grid = '<svg class="bt-layer" width="' + width + '" height="' + height + '"><g stroke="' + p.gridColor + '" stroke-width="' + thin + '">' + lines + '</g></svg>';

  const bx = X(p.barcodeX);
  const by = Y(p.barcodeY);
  const bw = X(p.barcodeW);
  const bh = Y(p.barcodeH);
  let code = '';
  for (let i = 0; i < BARCODE_BARS; i++) {
    const w = (bw / BARCODE_BARS) * (0.35 + seed(i + BARCODE_SEED) * 0.65);
    const x = bx + (i * bw) / BARCODE_BARS;
    const dark = seed(i * 3 + BARCODE_SEED) > 0.42;
    code += '<rect x="' + x + '" y="' + by + '" width="' + w + '" height="' + bh + '" fill="' + (dark ? p.barcodeColor : p.paper) + '"/>';
  }
  const barcode = '<svg class="bt-layer"' + part('barcode') + ' width="' + width + '" height="' + height + '">' + code + '</svg>';

  const titlePrimaryPx = (p.titlePrimarySize / 100) * width;
  const titlePrimary = '<div class="bt-text"' + part('titlePrimary') + ' style="left:' + X(p.titlePrimaryX) + 'px;top:' + Y(p.titlePrimaryY) + 'px;font-size:' + titlePrimaryPx + 'px;font-weight:' + p.titlePrimaryWeight + ';color:' + p.titlePrimaryColor + '">' + escaped(p.titlePrimary) + '</div>';

  const titleSecondary = '<div class="bt-text"' + part('titleSecondary') + ' style="left:' + X(p.titleSecondaryX) + 'px;top:' + Y(p.titleSecondaryY) + 'px;font-size:' + titlePrimaryPx * 0.46 + 'px;font-style:italic;color:' + p.titleSecondaryColor + '">' + escaped(p.titleSecondary) + '</div>';

  const rows = linesOf(p.eventLines).filter((l) => l.trim()).map((line, i) => {
    const [label, value] = line.split('|').map((t) => t.trim());
    return '<div class="bt-row"' + part('eventLines', i) + '><span>' + escaped(label || '') + '</span><span>' + escaped(value || '') + '</span></div>';
  }).join('');
  const eventLines = '<div class="bt-rows" style="left:' + X(p.eventLinesX) + 'px;top:' + Y(p.eventLinesY) + 'px;width:' + X(38) + 'px;font-size:' + small + 'px;color:' + p.eventLinesColor + '">' + rows + '</div>';

  const footer = '<div class="bt-text"' + part('footer') + ' style="left:' + X(p.footerX) + 'px;top:' + Y(p.footerY) + 'px;font-size:' + small * 0.6 + 'px;color:' + p.footerColor + '">' + escaped(p.footer) + '</div>';

  const markPx = small * 1.5;
  const partners = linesOf(p.partners).filter((l) => l.trim()).slice(0, MARKS.length).map((name, i) =>
    '<div class="bt-partner"' + part('partners', i) + ' style="left:' + (X(p.partnersX) + i * X(16)) + 'px;top:' + Y(p.partnersY) + 'px;height:' + markPx + 'px;gap:' + markPx * 0.3 + 'px;font-size:' + small * 0.7 + 'px;color:' + p.partnersColor + '"><svg width="' + markPx + '" height="' + markPx + '" fill="' + p.partnersColor + '">' + MARKS[i](markPx) + '</svg>' + escaped(name) + '</div>').join('');

  const counterW = X(10);
  const counterH = Y(8);
  const counter = '<div class="bt-counter"' + part('counter') + ' style="' + box(X(p.counterX), Y(p.counterY), counterW, counterH) + 'background:' + p.counterColor + ';color:' + p.paper + ';font-size:' + Math.min(counterH, counterW * 0.45) * 0.6 + 'px">' + escaped(p.counter) + '</div>';

  const index = '<div class="bt-text"' + part('index') + ' style="left:' + X(p.indexX) + 'px;top:' + Y(p.indexY) + 'px;font-size:' + small * 0.65 + 'px;color:' + p.indexColor + '">' + escaped(p.index) + '</div>';

  scene.innerHTML = grid + barcode + titlePrimary + titleSecondary + eventLines + footer + partners + counter + index;
};
`;

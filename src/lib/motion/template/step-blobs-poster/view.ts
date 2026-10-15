import { POSTER_SHAPES, POSTER_TEXT } from '../poster-kit';

export const STEP_BLOBS_CSS = String.raw`
.sb {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--sb-paper);
  -webkit-font-smoothing: antialiased;
}

.sb-layer {
  position: absolute;
  inset: 0;
}
`;

export const STEP_BLOBS_VIEW = String.raw`
${POSTER_TEXT}
${POSTER_SHAPES}
root.insertAdjacentHTML('beforeend', '<div class="sb"></div>');
const scene = root.querySelector('.sb');

const RIGHT = 'text-align:right;transform:translateX(-100%);';
const STEP_SHARE = 0.62;

const stairPoints = (x, y, w, h, steps) => {
  const rowH = h / steps;
  const bw = w * STEP_SHARE;
  const d = steps > 1 ? (w - bw) / (steps - 1) : 0;
  const points = [[x, y]];
  for (let k = 0; k < steps; k++) {
    points.push([x + k * d + bw, y + k * rowH], [x + k * d + bw, y + (k + 1) * rowH]);
  }
  for (let k = steps - 1; k >= 0; k--) {
    points.push([x + k * d, y + (k + 1) * rowH]);
    if (k > 0) {
      points.push([x + k * d, y + k * rowH]);
    }
  }
  return points;
};

const blobPath = (x, y, w, h, steps, r) =>
  steps > 1 ? roundedPath(stairPoints(x, y, w, h, steps), r) : roundedPath([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], Math.min(r * 1.6, h / 2));

const gridHtml = (p, width, height) => {
  const [cols, rows] = numbersOf(p.grid);
  let lines = '';
  for (let c = 1; c < cols; c++) {
    lines += '<rect x="' + (c * width) / cols + '" y="0" width="1" height="' + height + '"/>';
  }
  for (let r = 1; r < rows; r++) {
    lines += '<rect x="0" y="' + (r * height) / rows + '" width="' + width + '" height="1"/>';
  }
  return '<g' + part('grid') + ' fill="' + p.gridColor + '">' + lines + '</g>';
};

const draw = (p, width, height) => {
  scene.style.setProperty('--sb-paper', p.paper);
  scene.style.fontFamily = fontOf(p.smallFont);
  const X = (v) => (Number(v) / 100) * width;
  const Y = (v) => (Number(v) / 100) * height;
  const r = (p.blobsRound / 100) * width;
  const blobs = rowsOf(p.blobs).map(([x, y, w, h, steps], i) => '<path' + part('blobs', i) + ' d="' + blobPath(X(x), Y(y), X(w), Y(h), Number(steps), r) + '" fill="' + p.blobsColor + '"/>').join('');
  const shapes = '<svg class="sb-layer" width="' + width + '" height="' + height + '">' + gridHtml(p, width, height) + blobs + '</svg>';

  const thin = 'letter-spacing:-0.05em;line-height:0.84;';
  const number = textPart(p, 'number', width, height, thin + 'font-family:' + cssFont(p.titleFont) + ';font-weight:' + Math.max(100, p.titleWeight - 100) + ';');
  const specs = rowsOf(p.specs).map(([text, x, y], i) => '<div' + part('specs', i) + ' style="position:absolute;white-space:pre;left:' + X(x) + 'px;top:' + Y(y) + 'px;font-size:' + width * 0.036 + 'px;line-height:1;color:' + p.specsColor + '">' + escaped(text) + '</div>').join('');
  const small = textPart(p, 'contents', width, height) + textPart(p, 'notes', width, height, RIGHT + 'line-height:1.25;') + textPart(p, 'index', width, height, RIGHT) + textPart(p, 'marker', width, height, 'font-size:' + width * 0.03 + 'px;');
  scene.innerHTML = shapes + textPart(p, 'title', width, height, thin + 'mix-blend-mode:difference;') + number + specs + small;
};
`;

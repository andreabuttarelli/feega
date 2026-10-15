import { POSTER_TEXT } from '../poster-kit';

export const DIAGONAL_PILLS_CSS = String.raw`
.dp {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--dp-paper);
  font-weight: 500;
  -webkit-font-smoothing: antialiased;
}

.dp-layer {
  position: absolute;
  inset: 0;
}
`;

export const DIAGONAL_PILLS_VIEW = String.raw`
${POSTER_TEXT}
root.insertAdjacentHTML('beforeend', '<div class="dp"></div>');
const scene = root.querySelector('.dp');

const MARK = 0.06;
const RIGHT = 'text-align:right;transform:translateX(-100%);';

const pillHtml = (p, row, i, width, height) => {
  const [x, y, length, word] = row;
  const thick = (p.pillsWidth / 100) * width;
  const long = (Number(length) / 100) * width;
  const r = thick / 2;
  const at = 'translate(' + (Number(x) / 100) * width + ' ' + (Number(y) / 100) * height + ') rotate(' + p.pillsAngle + ')';
  const label = word ? '<text x="' + long * 0.5 + '" y="' + thick * 0.12 + '" font-size="' + (p.smallSize / 100) * width + '" fill="' + p.titleColor + '" text-anchor="middle">' + escaped(word) + '</text>' : '';
  return '<g' + part('pills', i) + ' transform="' + at + '"><rect x="' + -r + '" y="' + -r + '" width="' + (long + thick) + '" height="' + thick + '" rx="' + r + '" fill="url(#dpTail)"/><circle cx="' + long + '" cy="0" r="' + r + '" fill="' + p.pillsColor + '"/>' + label + '</g>';
};

const markerHtml = (p, width, height) => {
  const d = MARK * width;
  return '<svg' + part('marker') + ' style="position:absolute;left:' + ((p.markerX / 100) * width - d / 2) + 'px;top:' + (p.markerY / 100) * height + 'px" width="' + d + '" height="' + d + '"><circle cx="' + d / 2 + '" cy="' + d / 2 + '" r="' + d * 0.46 + '" fill="none" stroke="' + p.markerColor + '" stroke-width="' + d * 0.06 + '"/><text x="' + d / 2 + '" y="' + d * 0.62 + '" font-size="' + d * 0.36 + '" fill="' + p.markerColor + '" text-anchor="middle">' + escaped(p.marker) + '</text></svg>';
};

const draw = (p, width, height) => {
  scene.style.setProperty('--dp-paper', p.paper);
  scene.style.fontFamily = fontOf(p.smallFont);
  const tail = '<defs><linearGradient id="dpTail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + p.pillsTailColor + '" stop-opacity="0"/><stop offset="0.7" stop-color="' + p.pillsColor + '"/><stop offset="1" stop-color="' + p.pillsColor + '"/></linearGradient></defs>';
  const pills = '<svg class="dp-layer" width="' + width + '" height="' + height + '">' + tail + rowsOf(p.pills).map((row, i) => pillHtml(p, row, i, width, height)).join('') + '</svg>';
  const title = textPart(p, 'title', width, height, 'line-height:0.86;letter-spacing:-0.04em;transform-origin:0 0;transform:rotate(' + p.pillsAngle + 'deg);');
  const corners = textPart(p, 'brand', width, height) + textPart(p, 'tagline', width, height, RIGHT) + textPart(p, 'credit', width, height) + textPart(p, 'role', width, height, RIGHT);
  const index = textPart(p, 'index', width, height, 'letter-spacing:0.08em;text-transform:uppercase;');
  scene.innerHTML = pills + title + corners + index + markerHtml(p, width, height);
};
`;

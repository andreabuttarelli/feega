import { POSTER_TEXT } from '../poster-kit';

export const BLUE_TRAILS_CSS = String.raw`
.bt {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bt-paper);
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}

.bt-layer {
  position: absolute;
  inset: 0;
}

.bt-line {
  display: block;
  white-space: pre;
}
`;

export const BLUE_TRAILS_VIEW = String.raw`
${POSTER_TEXT}
root.insertAdjacentHTML('beforeend', '<div class="bt"></div>');
const scene = root.querySelector('.bt');

const MARK = 0.045;
const DOT = 0.056;

const trailHtml = (p, row, i, width, height) => {
  const [x, y, trail] = row.map(Number);
  const r = DOT * width;
  const cx = (x / 100) * width;
  const cy = (y / 100) * height;
  const long = (trail / 100) * width;
  const left = Math.min(cx, cx + long) - r;
  const gradient = long < 0 ? 'btLeft' : 'btRight';
  return '<g' + part('dots', i) + '><rect x="' + left + '" y="' + (cy - r) + '" width="' + (Math.abs(long) + 2 * r) + '" height="' + 2 * r + '" rx="' + r + '" fill="url(#' + gradient + ')"/><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + p.dotsColor + '"/></g>';
};

const stop = (at, colour, opacity) => '<stop offset="' + at + '" stop-color="' + colour + '" stop-opacity="' + opacity + '"/>';
const gradientDef = (id, p, from, to) => '<linearGradient id="' + id + '" x1="' + from + '" y1="0" x2="' + to + '" y2="0">' + stop(0, p.dotsColor, 0.75) + stop(0.55, p.dotsTailColor, 0.6) + stop(1, p.dotsTailColor, 0) + '</linearGradient>';

const titleHtml = (p, width, height) => {
  const px = (p.titleSize / 100) * width;
  const lines = linesOf(p.title).map((line, i) => '<span class="bt-line" style="margin-left:' + (i * p.titleShift * width) / 100 + 'px">' + escaped(line) + '</span>').join('');
  return '<div' + part('title') + ' style="position:absolute;left:' + (p.titleX / 100) * width + 'px;top:' + (p.titleY / 100) * height + 'px;font-size:' + px + 'px;font-weight:' + p.titleWeight + ';line-height:0.92;letter-spacing:-0.045em;color:' + p.titleColor + ';font-family:' + cssFont(p.titleFont) + '">' + lines + '</div>';
};

const wordsHtml = (p, width, height) =>
  rowsOf(p.words).map(([text, x, y], i) => '<div' + part('words', i) + ' style="position:absolute;left:' + (Number(x) / 100) * width + 'px;top:' + (Number(y) / 100) * height + 'px;font-size:' + (p.smallSize / 100) * width + 'px;letter-spacing:-0.02em;color:' + p.titleColor + '">' + escaped(text) + '</div>').join('');

const markerHtml = (p, width, height) => {
  const d = MARK * width;
  return '<div' + part('marker') + ' style="position:absolute;left:' + ((p.markerX / 100) * width - d / 2) + 'px;top:' + (p.markerY / 100) * height + 'px;width:' + d + 'px;height:' + d + 'px;border-radius:50%;border:' + d * 0.06 + 'px solid ' + p.markerColor + ';box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:' + d * 0.34 + 'px;color:' + p.markerColor + '">' + escaped(p.marker) + '</div>';
};

const draw = (p, width, height) => {
  scene.style.setProperty('--bt-paper', p.paper);
  scene.style.fontFamily = fontOf(p.smallFont);
  const defs = '<defs>' + gradientDef('btRight', p, 0, 1) + gradientDef('btLeft', p, 1, 0) + '</defs>';
  const dots = '<svg class="bt-layer" width="' + width + '" height="' + height + '">' + defs + rowsOf(p.dots).map((row, i) => trailHtml(p, row, i, width, height)).join('') + '</svg>';
  const corners = textPart(p, 'tagline', width, height) + textPart(p, 'topic', width, height) + textPart(p, 'brand', width, height) + textPart(p, 'tool', width, height);
  const index = textPart(p, 'index', width, height, 'font-size:' + width * 0.011 + 'px;letter-spacing:0.12em;text-transform:uppercase;transform-origin:0 0;transform:rotate(90deg);');
  scene.innerHTML = dots + wordsHtml(p, width, height) + titleHtml(p, width, height) + corners + index + markerHtml(p, width, height);
};
`;

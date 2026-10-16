import { POSTER_ART, POSTER_SHAPES, POSTER_TEXT } from '../poster-kit';

export const ACID_STROKES_CSS = String.raw`
.as {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--as-paper);
  -webkit-font-smoothing: antialiased;
}

.as-layer {
  position: absolute;
  inset: 0;
}
`;

export const ACID_STROKES_VIEW = String.raw`
${POSTER_TEXT}
${POSTER_SHAPES}
${POSTER_ART}
root.insertAdjacentHTML('beforeend', '<div class="as"></div>');
const scene = root.querySelector('.as');

const BELLY = 2.2;
const INNER = 0.5;
const JITTER = 0.45;

const strokePath = (long, thick) => 'M0 0Q' + long / 2 + ' ' + -thick * BELLY + ' ' + long + ' 0Q' + long / 2 + ' ' + -thick * (BELLY - 1) + ' 0 0Z';

const spikyPath = (cx, cy, r, points) => {
  const all = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points;
    const reach = i % 2 ? r * INNER : r * (1 - JITTER * artSeq(i + points));
    all.push((i ? 'L' : 'M') + (cx + Math.cos(a) * reach) + ' ' + (cy + Math.sin(a) * reach));
  }
  return all.join('') + 'Z';
};

const burstHtml = (p, row, i, width, height) => {
  const [x, y, r, points] = row.map(Number);
  const cx = (x / 100) * width;
  const cy = (y / 100) * height;
  const radius = (r / 100) * width;
  const shape = points > 2 ? '<path d="' + spikyPath(cx, cy, radius, points) + '"/>' : '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + radius * 0.72 + '" ry="' + radius + '" transform="rotate(28 ' + cx + ' ' + cy + ')"/>';
  return '<g' + part('bursts', i) + ' fill="' + p.burstsColor + '">' + shape + '</g>';
};

const strokeHtml = (p, row, i, width, height) => {
  const [x, y, long, angle, thick] = row.map(Number);
  return '<path' + part('strokes', i) + ' transform="translate(' + (x / 100) * width + ' ' + (y / 100) * height + ') rotate(' + angle + ')" d="' + strokePath((long / 100) * width, (thick / 100) * width) + '" fill="' + p.strokesColor + '"/>';
};

const draw = (p, width, height) => {
  scene.style.setProperty('--as-paper', p.paper);
  scene.style.fontFamily = fontOf(p.smallFont);
  const shapes = '<svg class="as-layer" width="' + width + '" height="' + height + '">' + rowsOf(p.strokes).map((row, i) => strokeHtml(p, row, i, width, height)).join('') + rowsOf(p.bursts).map((row, i) => burstHtml(p, row, i, width, height)).join('') + '</svg>';
  const title = textPart(p, 'title', width, height, 'line-height:1.02;letter-spacing:-0.035em;');
  const script = textPart(p, 'script', width, height, 'font-size:' + (p.titleSize / 100) * width + 'px;line-height:1;');
  const dates = textPart(p, 'dates', width, height, 'font-size:' + width * 0.068 + 'px;letter-spacing:-0.02em;transform-origin:0 0;transform:rotate(90deg);');
  const info = textPart(p, 'heading', width, height, 'font-weight:600;') + textPart(p, 'venue', width, height, 'font-size:' + width * 0.034 + 'px;font-weight:600;line-height:1.02;');
  const marker = textPart(p, 'marker', width, height, 'font-size:' + width * 0.022 + 'px;font-weight:700;padding:0.9em 0.7em;background:' + p.markerColor + ';color:' + p.paper + ';');
  const index = textPart(p, 'index', width, height, 'font-size:' + width * 0.011 + 'px;letter-spacing:0.1em;text-transform:uppercase;transform-origin:0 0;transform:rotate(90deg);');
  scene.innerHTML = shapes + title + script + dates + info + marker + index;
};
`;

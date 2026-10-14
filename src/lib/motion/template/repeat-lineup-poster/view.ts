export const REPEAT_LINEUP_CSS = String.raw`
.rl {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--rl-paper);
  color: var(--rl-ink);
  font-family: var(--rl-font);
  -webkit-font-smoothing: antialiased;
}

.rl-layer {
  position: absolute;
  inset: 0;
}

.rl-names {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.98;
}

.rl-name {
  position: relative;
  white-space: pre;
  background: var(--rl-bars);
  padding: 0 0.06em;
}

.rl-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--rl-accent);
  color: var(--rl-paper);
  font-weight: 600;
  letter-spacing: 0;
}

.rl-info {
  position: absolute;
  display: flex;
  justify-content: space-between;
  border-top: 1.5px solid var(--rl-ink);
  white-space: pre;
  line-height: 1;
}

.rl-index {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--rl-ink);
  color: var(--rl-paper);
  font-weight: 600;
  line-height: 1;
}

.rl-label {
  position: absolute;
  white-space: pre;
  line-height: 1;
}
`;

export const REPEAT_LINEUP_VIEW = String.raw`
const START = -0.42;
const BLOCKS = [[0.37, 0.0, 0.13, 0.36], [0.4, 0.5, 0.32, 0.5], [0.06, 0.66, 0.08, 0.14], [0.87, 0.08, 0.06, 0.12], [0.62, 0.58, 0.1, 0.08]];
const BARS = [[0, 0.3, 0.055, 0.6], [0.945, 0.12, 0.055, 0.5], [0.21, 0.88, 0.14, 0.05], [0.52, 0.88, 0.2, 0.05], [0.05, 0.02, 0.06, 0.18]];
const STRIPES = [[0.18, 0.2], [0.75, 0.24], [0.27, 0.72]];
const RINGS = [[0.12, 0.12], [0.11, 0.33], [0.24, 0.3], [0.48, 0.56], [0.73, 0.82], [0.24, 0.66]];
const ELLIPSES = [[0.09, 0.73, 0.15], [0.86, 0.73, 0.16], [0.5, 0.33, 0.33]];
const LABELS = [0.09, 0.42, 0.75];

root.insertAdjacentHTML('beforeend', '<div class="rl"></div>');
const scene = root.querySelector('.rl');

const pad = (n) => String(n).padStart(2, '0');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--rl-paper', p.paper);
  s.setProperty('--rl-ink', p.ink);
  s.setProperty('--rl-bars', p.bars);
  s.setProperty('--rl-accent', p.accent);
  s.setProperty('--rl-font', fontOf(p.font));

  const band = (p.repeatSize / 100) * width;
  const count = Math.ceil(height / band - START) + 1;
  const names = linesOf(p.lineup).filter((l) => l.trim());
  const info = linesOf(p.info).filter((l) => l.trim());
  const namePx = (p.nameSize / 100) * width;
  const small = width * 0.0185;
  const tiny = width * 0.0085;
  const thin = Math.max(1, width / 900);

  let art = '';
  let html = '';
  for (let b = 0; b < count; b++) {
    const top = (START + b) * band;
    const flip = b % 2 === 1;
    const X = (x, w = 0) => (flip ? width - (x + w) * width : x * width);
    const Y = (y) => top + y * band;
    const rect = (r, fill) => '<rect x="' + X(r[0], r[2]) + '" y="' + Y(r[1]) + '" width="' + r[2] * width + '" height="' + r[3] * band + '" fill="' + fill + '"/>';
    art += BARS.map((r) => rect(r, p.bars)).join('') + BLOCKS.map((r) => rect(r, p.blocks)).join('');
    art += STRIPES.map(([x, y]) => rect([x, y, 0.055, 0.012], p.lines)).join('');
    art += ELLIPSES.map(([x, y, r]) => '<ellipse cx="' + X(x) + '" cy="' + Y(y) + '" rx="' + r * width + '" ry="' + r * width * 0.42 + '" fill="none" stroke="' + p.bars + '" stroke-width="' + thin + '"/>').join('');
    art += RINGS.map(([x, y], i) => '<circle cx="' + X(x) + '" cy="' + Y(y) + '" r="' + width * 0.008 + '" fill="none" stroke="' + (i % 2 ? p.guides : '#3aa23a') + '" stroke-width="' + thin * 1.6 + '" stroke-dasharray="' + thin * 2 + ' ' + thin * 2 + '"/>').join('');
    art += '<line x1="0" y1="' + Y(0.4) + '" x2="' + width + '" y2="' + Y(0.4) + '" stroke="' + p.guides + '" stroke-width="' + thin + '"/>';
    art += '<line x1="' + X(0.14) + '" y1="' + Y(0) + '" x2="' + X(0.14) + '" y2="' + Y(1) + '" stroke="' + p.guides + '" stroke-width="' + thin + '"/>';
    art += '<line x1="' + X(0.86) + '" y1="' + Y(0.05) + '" x2="' + X(0.06) + '" y2="' + Y(0.62) + '" stroke="' + p.lines + '" stroke-width="' + thin + '"/>';
    art += '<line x1="' + X(0.86) + '" y1="' + Y(0.05) + '" x2="' + X(0.56) + '" y2="' + Y(0.4) + '" stroke="' + p.lines + '" stroke-width="' + thin + '"/>';
    html += LABELS.map((x) => '<div class="rl-label"' + part('labels') + ' style="left:' + x * width + 'px;top:' + Y(0.72) + 'px;font-size:' + tiny + 'px">' + escaped(p.labels) + '</div>').join('');

    const namesTop = Y(0.5) - (names.length * namePx * 0.98) / 2;
    const markerPx = namePx * 0.5;
    const marker = '<div class="rl-marker"' + part('marker') + ' style="right:' + -markerPx * 1.15 + 'px;top:' + namePx * 0.1 + 'px;width:' + markerPx + 'px;height:' + markerPx + 'px;font-size:' + markerPx * 0.3 + 'px">' + escaped(p.marker) + '</div>';
    html += '<div class="rl-names" style="top:' + namesTop + 'px;font-size:' + namePx + 'px">' + names.map((n, i) => '<div class="rl-name"' + part('lineup', i) + '>' + escaped(n) + (i === 0 && p.marker ? marker : '') + '</div>').join('') + '</div>';
    html += '<div class="rl-index"' + part('index') + ' style="' + box(width * 0.02, namesTop, small * 2.9, small * 1.6) + 'font-size:' + small * 0.75 + 'px">' + escaped(p.index + ' ' + pad(b + 1)) + '</div>';
    html += '<div class="rl-info"' + part('info') + ' style="left:' + width * 0.02 + 'px;right:' + width * 0.02 + 'px;top:' + Y(0.9) + 'px;padding-top:' + small * 0.4 + 'px;font-size:' + small + 'px">' + info.map((t) => '<span>' + escaped(t) + '</span>').join('') + '</div>';
  }

  scene.innerHTML = '<svg class="rl-layer" width="' + width + '" height="' + height + '">' + art + '</svg>' + html + upright(p.caption, width - small * 1.3, height * 0.42, small * 0.62, p.ink);
};
`;

export const BRICK_CAPS_CSS = String.raw`
.bc {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bc-paper);
  -webkit-font-smoothing: antialiased;
}

.bc-layer {
  position: absolute;
  inset: 0;
}

.bc-bars {
  position: absolute;
}

.bc-bar {
  display: inline-block;
  white-space: pre;
  line-height: 1;
  text-transform: uppercase;
  padding: 0.14em 0.22em;
  margin-bottom: 0.14em;
}

.bc-corner {
  position: absolute;
  white-space: pre;
  line-height: 1.2;
  text-transform: uppercase;
}

.bc-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
}

.bc-text {
  position: absolute;
  white-space: pre;
  line-height: 1;
  text-transform: uppercase;
}
`;

export const BRICK_CAPS_VIEW = String.raw`
const CORNER_STYLE = { TL: 'left', TR: 'right', BL: 'left', BR: 'right' };

root.insertAdjacentHTML('beforeend', '<div class="bc"></div>');
const scene = root.querySelector('.bc');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--bc-paper', p.paper);

  const X = (v) => (v / 100) * width;
  const Y = (v) => (v / 100) * height;
  const thin = Math.max(1, width / 700);

  const bw = width / p.brickCols;
  const bh = Y(p.brickRowHeight);
  let bricks = '';
  for (let r = 0; r * bh < height; r++) {
    const offset = r % 2 ? bw / 2 : 0;
    for (let c = -1; c * bw + offset < width; c++) {
      bricks += '<rect x="' + (c * bw + offset) + '" y="' + r * bh + '" width="' + bw + '" height="' + bh + '" fill="none" stroke="' + p.brickLineColor + '" stroke-width="' + thin + '"/>';
    }
  }
  const brickLayer = '<svg class="bc-layer" width="' + width + '" height="' + height + '">' + bricks + '</svg>';

  const barsPx = (p.barsSize / 100) * width;
  const bars = linesOf(p.bars).map((line, i) => '<div class="bc-bar"' + part('bars', i) + ' style="background:' + p.barsColor + ';color:' + p.barsTextColor + ';font-size:' + barsPx + 'px;font-family:' + fontOf(p.barsFont) + '">' + escaped(line) + '</div>').join('<br/>');
  const barsHtml = '<div class="bc-bars" style="left:' + X(p.barsX) + 'px;top:' + Y(p.barsY) + 'px">' + bars + '</div>';

  const cornerPx = (p.cornersSize / 100) * width;
  const edge = width * 0.04;
  const positions = { TL: { left: edge, top: edge }, TR: { right: edge, top: edge }, BL: { left: edge, bottom: edge }, BR: { right: edge, bottom: edge } };
  const corners = linesOf(p.corners).filter((l) => l.trim()).map((line, i) => {
    const [pos, text] = line.split('|').map((t) => t.trim());
    const at = positions[pos] || positions.TL;
    const style = Object.keys(at).map((k) => k + ':' + at[k] + 'px').join(';');
    return '<div class="bc-corner"' + part('corners', i) + ' style="' + style + ';text-align:' + (CORNER_STYLE[pos] || 'left') + ';font-size:' + cornerPx + 'px;color:' + p.cornersColor + ';font-family:' + fontOf(p.cornersFont) + '">' + escaped(text || '') + '</div>';
  }).join('');

  const markerPx = X(p.markerSize);
  const marker = '<div class="bc-marker"' + part('marker') + ' style="left:' + (X(p.markerX) - markerPx / 2) + 'px;top:' + (Y(p.markerY) - markerPx / 2) + 'px;width:' + markerPx + 'px;height:' + markerPx + 'px;background:' + p.markerColor + ';color:' + p.paper + ';font-family:' + fontOf(p.markerFont) + ';font-size:' + markerPx * 0.36 + 'px">' + escaped(p.marker) + '</div>';

  const indexPx = (p.indexSize / 100) * width;
  const index = '<div class="bc-text"' + part('index') + ' style="left:' + X(p.indexX) + 'px;top:' + Y(p.indexY) + 'px;font-size:' + indexPx + 'px;color:' + p.indexColor + ';font-family:' + fontOf(p.indexFont) + '">' + escaped(p.index) + '</div>';

  scene.innerHTML = brickLayer + barsHtml + corners + marker + index;

  const room = width - X(p.barsX) * 2;
  for (const el of scene.querySelectorAll('.bc-bar')) {
    if (el.scrollWidth > room) {
      el.style.fontSize = (barsPx * room) / el.scrollWidth + 'px';
    }
  }
};
`;

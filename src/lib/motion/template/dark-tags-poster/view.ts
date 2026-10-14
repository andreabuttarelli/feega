export const DARK_TAGS_CSS = String.raw`
.dt {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--dt-paper);
  -webkit-font-smoothing: antialiased;
}

.dt-title {
  position: absolute;
  margin: 0;
  white-space: pre;
  line-height: 0.96;
}

.dt-tag {
  position: absolute;
  white-space: pre;
  line-height: 1;
  padding: 0.3em 0.5em;
}

.dt-marker {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.dt-text {
  position: absolute;
  white-space: pre;
  line-height: 1;
}
`;

export const DARK_TAGS_VIEW = String.raw`
root.insertAdjacentHTML('beforeend', '<div class="dt"></div>');
const scene = root.querySelector('.dt');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--dt-paper', p.paper);

  const X = (v) => (v / 100) * width;
  const Y = (v) => (v / 100) * height;

  const titlePx = (p.titleSize / 100) * width;
  const title = '<div class="dt-title"' + part('title') + ' style="left:' + X(p.titleX) + 'px;top:' + Y(p.titleY) + 'px;font-size:' + titlePx + 'px;font-weight:' + p.titleWeight + ';color:' + p.titleColor + ';font-family:' + fontOf(p.titleFont) + '">' + escaped(p.title) + '</div>';

  const tagPx = (p.tagsSize / 100) * width;
  const tags = linesOf(p.tags).filter((l) => l.trim()).map((line, i) => {
    const [text, colour, x, y] = line.split('|').map((t) => t.trim());
    return '<div class="dt-tag"' + part('tags', i) + ' style="left:' + X(Number(x)) + 'px;top:' + Y(Number(y)) + 'px;background:' + colour + ';color:' + p.tagsTextColor + ';font-size:' + tagPx + 'px;font-family:' + fontOf(p.tagsFont) + '">' + escaped(text) + '</div>';
  }).join('');

  const markerPx = X(p.markerSize);
  const borderW = Math.max(1, markerPx * 0.045);
  const marker = '<div class="dt-marker"' + part('marker') + ' style="left:' + X(p.markerX) + 'px;top:' + Y(p.markerY) + 'px;width:' + markerPx + 'px;height:' + markerPx + 'px;border:' + borderW + 'px solid ' + p.markerBorderColor + ';color:' + p.markerColor + ';font-family:' + fontOf(p.markerFont) + ';font-size:' + markerPx * 0.3 + 'px">' + escaped(p.marker) + '</div>';

  const indexPx = (p.indexSize / 100) * width;
  const index = '<div class="dt-text"' + part('index') + ' style="left:' + X(p.indexX) + 'px;top:' + Y(p.indexY) + 'px;font-size:' + indexPx + 'px;color:' + p.indexColor + ';font-family:' + fontOf(p.indexFont) + '">' + escaped(p.index) + '</div>';

  scene.innerHTML = title + tags + marker + index;
};
`;

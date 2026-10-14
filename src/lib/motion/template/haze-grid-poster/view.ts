export const HAZE_GRID_CSS = String.raw`
.hg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--hg-paper);
  font-family: var(--hg-font);
  -webkit-font-smoothing: antialiased;
}

.hg-haze {
  position: absolute;
}

.hg-layer {
  position: absolute;
  inset: 0;
}

.hg-rows {
  position: absolute;
  display: flex;
  flex-direction: column;
}

.hg-row {
  display: flex;
  white-space: pre;
  line-height: 0.92;
  letter-spacing: -0.01em;
}

.hg-left {
  flex: none;
}

.hg-right {
  flex: none;
  margin-left: auto;
}

.hg-mark {
  position: relative;
  top: -0.55em;
  font-weight: 500;
  margin: 0 0.12em;
}

.hg-text {
  position: absolute;
  white-space: pre-line;
  line-height: 1.32;
}

.hg-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
}

.hg-caption {
  position: absolute;
  white-space: pre;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transform: rotate(-90deg);
  transform-origin: 0 0;
}
`;

export const HAZE_GRID_VIEW = String.raw`
root.insertAdjacentHTML('beforeend', '<div class="hg"></div>');
const scene = root.querySelector('.hg');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--hg-paper', p.paper);
  s.setProperty('--hg-font', fontOf(p.font));

  const X = (v) => (v / 100) * width;
  const Y = (v) => (v / 100) * height;
  const small = width * 0.013;

  const hazeSize = width * 0.95;
  const haze = '<div class="hg-haze"' + part('haze') + ' style="left:' + (X(p.hazeX) - hazeSize / 2) + 'px;top:' + (Y(p.hazeY) - hazeSize / 2) + 'px;width:' + hazeSize + 'px;height:' + hazeSize + 'px;background:radial-gradient(circle, ' + p.hazeColor + ' 0%, transparent 70%);opacity:0.8;filter:blur(' + hazeSize * 0.12 + 'px)"></div>';

  const thin = Math.max(1, width / 1000);
  let lines = '';
  for (let c = 1; c < p.gridCols; c++) {
    lines += '<line x1="' + (c * width) / p.gridCols + '" y1="0" x2="' + (c * width) / p.gridCols + '" y2="' + height + '"/>';
  }
  for (let r = 1; r < p.gridRows; r++) {
    lines += '<line x1="0" y1="' + (r * height) / p.gridRows + '" x2="' + width + '" y2="' + (r * height) / p.gridRows + '"/>';
  }
  const grid = '<svg class="hg-layer" width="' + width + '" height="' + height + '"><g stroke="' + p.gridColor + '" stroke-width="' + thin + '">' + lines + '</g></svg>';

  const rowsPx = (p.rowsSize / 100) * width;
  const marks = linesOf(p.marks).filter((l) => l.trim()).map((l) => {
    const [row, side, num] = l.trim().split(/\s+/);
    return { row: Number(row), side, num };
  });
  const markHtml = (row, side) => marks.filter((m) => m.row === row && m.side === side).map((m) => '<sup class="hg-mark"' + part('marks', marks.indexOf(m)) + ' style="font-size:' + rowsPx * 0.22 + 'px;color:' + p.marksColor + '">(' + escaped(m.num) + ')</sup>').join('');

  const rows = linesOf(p.rows).map((line, i) => {
    const [left, right] = line.split('|').map((t) => t.trim());
    return '<div class="hg-row"' + part('rows', i) + '><span class="hg-left">' + escaped(left || '') + markHtml(i, 'left') + '</span><span class="hg-right">' + escaped(right || '') + markHtml(i, 'right') + '</span></div>';
  }).join('');
  const rowsHtml = '<div class="hg-rows" style="left:' + X(p.rowsX) + 'px;top:' + Y(p.rowsY) + 'px;width:' + (width - X(p.rowsX) * 2) + 'px;font-size:' + rowsPx + 'px;font-weight:' + p.rowsWeight + ';color:' + p.rowsColor + '">' + rows + '</div>';

  const note = '<div class="hg-text"' + part('note') + ' style="left:' + X(p.noteX) + 'px;top:' + Y(p.noteY) + 'px;width:' + X(38) + 'px;font-size:' + small * 1.5 + 'px;color:' + p.noteColor + '">' + escaped(p.note) + '</div>';
  const body = '<div class="hg-text"' + part('body') + ' style="left:' + X(p.bodyX) + 'px;top:' + Y(p.bodyY) + 'px;width:' + X(38) + 'px;font-size:' + small * 1.2 + 'px;color:' + p.bodyColor + '">' + escaped(p.body) + '</div>';
  const issue = '<div class="hg-text"' + part('issue') + ' style="left:' + X(p.issueX) + 'px;top:' + Y(p.issueY) + 'px;width:' + X(38) + 'px;font-size:' + small * 0.85 + 'px;color:' + p.issueColor + '">' + escaped(p.issue) + '</div>';

  const markerPx = X(p.markerSize);
  const marker = '<div class="hg-marker"' + part('marker') + ' style="left:' + (X(p.markerX) - markerPx / 2) + 'px;top:' + (Y(p.markerY) - markerPx / 2) + 'px;width:' + markerPx + 'px;height:' + markerPx + 'px;background:' + p.markerColor + ';color:' + p.paper + ';font-size:' + markerPx * 0.34 + 'px">' + escaped(p.marker) + '</div>';

  const caption = '<div class="hg-caption"' + part('caption') + ' style="left:' + X(p.captionX) + 'px;top:' + Y(p.captionY) + 'px;font-size:' + small * 0.8 + 'px;color:' + p.captionColor + '">' + escaped(p.caption) + '</div>';

  scene.innerHTML = haze + grid + rowsHtml + note + body + issue + marker + caption;
};
`;

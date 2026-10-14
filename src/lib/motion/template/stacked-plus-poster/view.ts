export const STACKED_PLUS_CSS = String.raw`
.sp {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--sp-paper);
  font-family: var(--sp-font);
  -webkit-font-smoothing: antialiased;
}

.sp-layer {
  position: absolute;
  inset: 0;
}

.sp-rows {
  position: absolute;
}

.sp-row {
  line-height: 0.86;
  letter-spacing: -0.03em;
}

.sp-word {
  display: block;
  white-space: pre;
}

.sp-note {
  display: block;
  max-width: 70%;
  line-height: 1.3;
  margin: 0.1em 0;
  font-weight: 400;
  letter-spacing: normal;
}

.sp-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
}

.sp-text {
  position: absolute;
  white-space: pre;
  line-height: 1;
}
`;

export const STACKED_PLUS_VIEW = String.raw`
root.insertAdjacentHTML('beforeend', '<div class="sp"></div>');
const scene = root.querySelector('.sp');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--sp-paper', p.paper);
  s.setProperty('--sp-font', fontOf(p.font));

  const X = (v) => (v / 100) * width;
  const Y = (v) => (v / 100) * height;
  const small = width * 0.013;

  const plusSize = X(p.plusSize);
  const arm = plusSize * 0.32;
  const plus = '<svg' + part('plus') + ' width="' + plusSize + '" height="' + plusSize + '" style="position:absolute;left:' + X(p.plusX) + 'px;top:' + Y(p.plusY) + 'px" fill="' + p.plusColor + '"><rect x="' + (plusSize - arm) / 2 + '" y="0" width="' + arm + '" height="' + plusSize + '"/><rect x="0" y="' + (plusSize - arm) / 2 + '" width="' + plusSize + '" height="' + arm + '"/></svg>';

  const qSize = X(p.quarterSize);
  const quarter = '<svg' + part('quarter') + ' width="' + qSize + '" height="' + qSize + '" style="position:absolute;left:' + X(p.quarterX) + 'px;top:' + Y(p.quarterY) + 'px" fill="' + p.quarterColor + '"><path d="M0,0 L' + qSize + ',0 A' + qSize + ',' + qSize + ' 0 0 1 0,' + qSize + ' Z"/></svg>';

  const rect = '<div' + part('rect') + ' style="' + box(X(p.rectX), Y(p.rectY), X(p.rectW), Y(p.rectH)) + 'background:' + p.rectColor + '"></div>';

  const rowsPx = (p.rowsSize / 100) * width;
  const notePx = rowsPx * 0.16;
  const rows = linesOf(p.rows).map((line, i) => {
    const [word, note, side] = line.split('|');
    const noteEl = note ? '<span class="sp-note" style="font-size:' + notePx + 'px;color:' + p.noteColor + '">' + escaped(note) + '</span>' : '';
    const wordEl = '<span class="sp-word">' + escaped(word) + '</span>';
    return '<div class="sp-row"' + part('rows', i) + '>' + (side === 'L' ? noteEl + wordEl : wordEl + noteEl) + '</div>';
  }).join('');
  const rowsHtml = '<div class="sp-rows"' + ' style="left:' + X(p.rowsX) + 'px;top:' + Y(p.rowsY) + 'px;width:' + (width - X(p.rowsX) * 2) + 'px;font-size:' + rowsPx + 'px;font-weight:' + p.rowsWeight + ';color:' + p.rowsColor + '">' + rows + '</div>';

  const markerPx = X(p.markerSize);
  const marker = '<div class="sp-marker"' + part('marker') + ' style="left:' + (X(p.markerX) - markerPx / 2) + 'px;top:' + (Y(p.markerY) - markerPx / 2) + 'px;width:' + markerPx + 'px;height:' + markerPx + 'px;background:' + p.markerColor + ';color:' + p.paper + ';font-size:' + markerPx * 0.36 + 'px">' + escaped(p.marker) + '</div>';

  const index = '<div class="sp-text"' + part('index') + ' style="left:' + X(p.indexX) + 'px;top:' + Y(p.indexY) + 'px;font-size:' + small * 0.9 + 'px;color:' + p.indexColor + '">' + escaped(p.index) + '</div>';

  const caption = '<div class="sp-text"' + part('caption') + ' style="left:' + X(p.captionX) + 'px;top:' + Y(p.captionY) + 'px;font-size:' + small * 0.9 + 'px;color:' + p.captionColor + '">' + escaped(p.caption) + '</div>';

  scene.innerHTML = plus + quarter + rect + rowsHtml + marker + index + caption;
};
`;

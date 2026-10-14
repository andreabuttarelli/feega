export const MONTH_GRID_CSS = String.raw`
.mg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--mg-paper);
  font-family: var(--mg-font);
  -webkit-font-smoothing: antialiased;
}

.mg-label-bg {
  position: absolute;
}

.mg-label {
  position: absolute;
  white-space: pre;
  line-height: 1.05;
}

.mg-months {
  position: absolute;
}

.mg-month {
  white-space: pre;
  line-height: 1.02;
}

.mg-card {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
}

.mg-card-tag {
  position: absolute;
  line-height: 1;
}

.mg-card-body {
  position: absolute;
  line-height: 1.18;
  white-space: pre-line;
}

.mg-text {
  position: absolute;
  white-space: pre;
  line-height: 1.2;
}

.mg-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
}
`;

export const MONTH_GRID_VIEW = String.raw`
root.insertAdjacentHTML('beforeend', '<div class="mg"></div>');
const scene = root.querySelector('.mg');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--mg-paper', p.paper);
  s.setProperty('--mg-font', fontOf(p.font));

  const X = (v) => (v / 100) * width;
  const Y = (v) => (v / 100) * height;
  const small = width * 0.013;

  const labelPx = small * 2.2;
  const labelLines = linesOf(p.label);
  const labelW = X(22);
  const labelH = labelLines.length * labelPx * 1.15;
  const labelBg = '<div class="mg-label-bg"' + part('label') + ' style="' + box(X(p.labelX), Y(p.labelY), labelW, labelH) + 'background:' + p.labelBgColor + '"></div>';
  const label = '<div class="mg-label" style="left:' + X(p.labelX) + 'px;top:' + Y(p.labelY) + 'px;padding:' + labelPx * 0.2 + 'px ' + labelPx * 0.3 + 'px;font-size:' + labelPx + 'px;font-weight:700;color:' + p.labelColor + '">' + escaped(p.label) + '</div>';

  const monthsPx = (p.monthsSize / 100) * width;
  const months = linesOf(p.months).map((m, i) => '<div class="mg-month"' + part('months', i) + '>' + escaped(m) + '</div>').join('');
  const monthsHtml = '<div class="mg-months" style="left:' + X(p.monthsX) + 'px;top:' + Y(p.monthsY) + 'px;font-size:' + monthsPx + 'px;font-weight:' + p.monthsWeight + ';color:' + p.monthsColor + '">' + months + '</div>';

  const positions = linesOf(p.cardsPos).filter((l) => l.trim()).map((l) => numbersOf(l));
  const cards = linesOf(p.cards).filter((l) => l.trim());
  const cardFont = small * 1.2;
  const cardsHtml = positions.map(([x, y, w, h], i) => {
    const [category, when, name, details] = String(cards[i] || '').split('|').map((t) => t.trim());
    const cw = X(w);
    const ch = Y(h);
    const pad = cw * 0.08;
    return '<div class="mg-card"' + part('cards', i) + ' style="' + box(X(x), Y(y), cw, ch) + 'background:' + p.cardsColor + '">' +
      '<div class="mg-card-tag" style="left:' + pad + 'px;top:' + pad + 'px;font-size:' + cardFont * 0.62 + 'px;color:' + p.cardsTagColor + '">' + escaped(category || '') + '</div>' +
      '<div class="mg-card-body" style="left:' + pad + 'px;top:' + pad * 2.6 + 'px;right:' + pad + 'px;font-size:' + cardFont * 0.72 + 'px;color:' + p.cardsTextColor + '">' + escaped(when + '\n' + name + '\n' + (details || '')) + '</div>' +
      '</div>';
  }).join('');

  const note = '<div class="mg-text"' + part('note') + ' style="left:' + X(p.noteX) + 'px;top:' + Y(p.noteY) + 'px;width:' + X(28) + 'px;font-size:' + small * 0.85 + 'px;color:' + p.noteColor + '">' + escaped(p.note) + '</div>';

  const markerPx = X(p.markerSize);
  const marker = '<div class="mg-marker"' + part('marker') + ' style="left:' + (X(p.markerX) - markerPx / 2) + 'px;top:' + (Y(p.markerY) - markerPx / 2) + 'px;width:' + markerPx + 'px;height:' + markerPx + 'px;background:' + p.markerColor + ';color:' + p.paper + ';font-size:' + markerPx * 0.36 + 'px">' + escaped(p.marker) + '</div>';

  const index = '<div class="mg-text"' + part('index') + ' style="left:' + X(p.indexX) + 'px;top:' + Y(p.indexY) + 'px;font-size:' + small * 0.75 + 'px;color:' + p.indexColor + '">' + escaped(p.index) + '</div>';

  scene.innerHTML = labelBg + label + monthsHtml + cardsHtml + note + marker + index;
};
`;

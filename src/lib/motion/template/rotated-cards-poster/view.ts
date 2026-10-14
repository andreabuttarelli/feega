export const ROTATED_CARDS_CSS = String.raw`
.rc {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--rc-paper);
  font-family: 'Inter Tight', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.rc-title {
  position: absolute;
  margin: 0;
  white-space: pre;
  line-height: 0.98;
  font-family: var(--rc-font);
}

.rc-card {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
}

.rc-card-edge {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
}

.rc-card-date {
  position: absolute;
  white-space: pre;
  line-height: 1;
}

.rc-card-tag {
  position: absolute;
  display: inline-flex;
  align-items: center;
  white-space: pre;
  line-height: 1;
}

.rc-card-name {
  position: absolute;
  white-space: pre;
  line-height: 1.05;
}

.rc-text {
  position: absolute;
  white-space: pre;
  line-height: 1;
}

.rc-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
}
`;

export const ROTATED_CARDS_VIEW = String.raw`
root.insertAdjacentHTML('beforeend', '<div class="rc"></div>');
const scene = root.querySelector('.rc');

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--rc-paper', p.paper);
  s.setProperty('--rc-font', fontOf(p.font));

  const X = (v) => (v / 100) * width;
  const Y = (v) => (v / 100) * height;
  const small = width * 0.013;

  const titlePx = (p.titleSize / 100) * width;
  const title = '<div class="rc-title"' + part('title') + ' style="left:' + X(p.titleX) + 'px;top:' + Y(p.titleY) + 'px;font-size:' + titlePx + 'px;font-weight:' + p.titleWeight + ';color:' + p.titleColor + '">' + escaped(p.title) + '</div>';

  const positions = linesOf(p.cardsPos).filter((l) => l.trim()).map((l) => numbersOf(l));
  const cards = linesOf(p.cards).filter((l) => l.trim());
  const cardFont = small * 1.3;
  const cardsHtml = positions.map(([x, y, w, h, rotate], i) => {
    const [colour, date, tag, name] = String(cards[i] || '').split('|').map((t) => t.trim());
    const cw = X(w);
    const ch = Y(h);
    const pad = cw * 0.09;
    return '<div class="rc-card"' + part('cards', i) + ' style="' + box(X(x), Y(y), cw, ch) + 'background:' + colour + ';transform:rotate(' + rotate + 'deg)">' +
      '<div class="rc-card-edge" style="width:' + cw * 0.08 + 'px;background:rgba(255,255,255,0.35)"></div>' +
      '<div class="rc-card-date" style="left:' + pad + 'px;top:' + pad + 'px;font-size:' + cardFont * 0.62 + 'px;color:' + p.cardsTextColor + '">' + escaped(date || '') + '</div>' +
      '<div class="rc-card-tag" style="left:' + pad + 'px;top:' + pad * 2.6 + 'px;padding:' + cardFont * 0.14 + 'px ' + cardFont * 0.3 + 'px;background:' + p.paper + ';color:' + colour + ';font-size:' + cardFont * 0.42 + 'px">#' + escaped(tag || '') + '</div>' +
      '<div class="rc-card-name" style="left:' + pad + 'px;bottom:' + pad + 'px;right:' + pad + 'px;font-size:' + cardFont * 0.72 + 'px;color:' + p.cardsTextColor + '">' + escaped(name || '') + '</div>' +
      '</div>';
  }).join('');

  const yearTag = '<div class="rc-text"' + part('yearTag') + ' style="left:' + X(p.yearTagX) + 'px;top:' + Y(p.yearTagY) + 'px;font-size:' + small * 1.6 + 'px;color:' + p.yearTagColor + '">' + escaped(p.yearTag) + '</div>';

  const wordmark = '<div class="rc-text"' + part('wordmark') + ' style="left:' + X(p.wordmarkX) + 'px;top:' + Y(p.wordmarkY) + 'px;font-size:' + small * 1.9 + 'px;font-family:var(--rc-font);color:' + p.wordmarkColor + '">' + escaped(p.wordmark) + '</div>';

  const markerPx = X(p.markerSize);
  const marker = '<div class="rc-marker"' + part('marker') + ' style="left:' + (X(p.markerX) - markerPx / 2) + 'px;top:' + (Y(p.markerY) - markerPx / 2) + 'px;width:' + markerPx + 'px;height:' + markerPx + 'px;background:' + p.markerColor + ';color:' + p.paper + ';font-size:' + markerPx * 0.36 + 'px">' + escaped(p.marker) + '</div>';

  const index = '<div class="rc-text"' + part('index') + ' style="left:' + X(p.indexX) + 'px;top:' + Y(p.indexY) + 'px;font-size:' + small * 0.75 + 'px;color:' + p.indexColor + '">' + escaped(p.index) + '</div>';

  scene.innerHTML = title + cardsHtml + yearTag + wordmark + marker + index;
};
`;

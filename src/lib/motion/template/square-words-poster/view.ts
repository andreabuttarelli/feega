export const SQUARE_WORDS_CSS = String.raw`
.sw {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 100% 0%, var(--sw-tint), transparent 45%),
    radial-gradient(circle at 0% 100%, var(--sw-tint), transparent 40%),
    var(--sw-paper);
  color: var(--sw-ink);
  font-family: var(--sw-font);
  font-weight: var(--sw-weight);
  -webkit-font-smoothing: antialiased;
}

.sw-word {
  position: absolute;
  line-height: 1;
  letter-spacing: -0.02em;
  white-space: pre;
}

.sw-square {
  position: absolute;
  background: var(--sw-square);
}

.sw-body {
  position: absolute;
  margin: 0;
  line-height: 1.58;
  letter-spacing: -0.005em;
}

.sw-dot {
  position: absolute;
  border-radius: 50%;
  background: var(--sw-dot);
  box-shadow: 0 0 0 var(--sw-ring) var(--sw-paper);
}
`;

export const SQUARE_WORDS_VIEW = String.raw`
const BASELINE = 0.8;
const BODY_INSET = [0.15, 0.13];
const BODY_WIDTH = 0.58;
const RING = 0.12;

root.insertAdjacentHTML('beforeend', '<div class="sw"></div>');
const scene = root.querySelector('.sw');

const placeOf = (line) => {
  const [x, y] = String(line || '').trim().split(/[\s,]+/).map(Number);
  return [Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0];
};

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--sw-paper', p.paper);
  s.setProperty('--sw-tint', p.tint);
  s.setProperty('--sw-ink', p.ink);
  s.setProperty('--sw-square', p.square);
  s.setProperty('--sw-dot', p.dot);
  s.setProperty('--sw-font', fontOf(p.font));
  s.setProperty('--sw-weight', String(p.fontWeight));

  const px = (v) => (v * width) / 100;
  const size = px(p.wordSize);
  const places = linesOf(p.places);
  const words = linesOf(p.words).map((word, i) => {
    const [x, y] = placeOf(places[i]);
    return '<div class="sw-word" style="left:' + px(x) + 'px;top:' + ((y * height) / 100 - BASELINE * size) + 'px;font-size:' + size + 'px">' + escaped(word) + '</div>';
  });
  const split = Math.max(0, p.front - 1);

  const sq = { x: px(p.squareX), y: (p.squareY * height) / 100, w: px(p.squareW), h: (p.squareH * height) / 100 };
  const square = '<div class="sw-square" style="' + box(sq.x, sq.y, sq.w, sq.h) + '"></div>';
  const body = '<p class="sw-body" style="left:' + (sq.x + BODY_INSET[0] * sq.w) + 'px;top:' + (sq.y + BODY_INSET[1] * sq.w) + 'px;width:' + BODY_WIDTH * sq.w + 'px;font-size:' + px(p.bodySize) + 'px">' + escaped(p.body) + '</p>';

  const d = px(p.dotSize);
  s.setProperty('--sw-ring', RING * d + 'px');
  const dot = '<div class="sw-dot" style="' + box(sq.x + sq.w - d / 2, (p.dotY * height) / 100 - d / 2, d, d) + '"></div>';

  scene.innerHTML = words.slice(0, split).join('') + square + body + dot + words.slice(split).join('');
};
`;

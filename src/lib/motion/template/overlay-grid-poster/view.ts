export const OVERLAY_GRID_CSS = String.raw`
.og {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--og-paper);
  color: var(--og-ink);
  font-family: var(--og-font);
  font-weight: var(--og-weight);
  -webkit-font-smoothing: antialiased;
}

.og-block {
  position: absolute;
  margin: 0;
  white-space: pre;
  text-transform: uppercase;
}

.og-big {
  line-height: 0.98;
  letter-spacing: -0.04em;
}

.og-small {
  line-height: 1.12;
  letter-spacing: -0.02em;
}

.og-yellow {
  color: var(--og-yellow);
  letter-spacing: 0.04em;
}

.og-stamp {
  position: absolute;
  background: var(--og-ink);
  color: var(--og-paper);
  padding: 0.3em 0.55em;
  line-height: 1;
  white-space: pre;
}

.og-rule {
  position: absolute;
  background: var(--og-ink);
}

.og-mark {
  position: absolute;
  border: 0 solid var(--og-ink);
}
`;

export const OVERLAY_GRID_VIEW = String.raw`
const FRAME = { left: 0.107, right: 0.918, top: 0.052, bottom: 0.944 };
const NOTE_X = 0.13;
const HEAD_X = 0.347;
const FOOT_X = [0.347, 0.69];
const TEXT_DROP = 0.022;
const MARK_ARM = 0.022;
const MARK_LINE = 0.0022;
const MARK_SIDES = {
  tl: ['border-left-width', 'border-top-width', 0, 0],
  bl: ['border-left-width', 'border-bottom-width', 0, -1],
  br: ['border-right-width', 'border-bottom-width', -1, -1]
};

root.insertAdjacentHTML('beforeend', '<div class="og"></div>');
const scene = root.querySelector('.og');

const block = (kind, x, y, px, text, extra) => '<div class="og-block ' + kind + '" style="left:' + x + 'px;top:' + y + 'px;font-size:' + px + 'px;' + (extra || '') + '">' + escaped(text) + '</div>';

const mark = (side, x, y, arm, line) => {
  const [a, b, dx, dy] = MARK_SIDES[side];
  return '<div class="og-mark" style="' + box(x + dx * arm, y + dy * arm, arm, arm) + a + ':' + line + 'px;' + b + ':' + line + 'px"></div>';
};

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--og-paper', p.paper);
  s.setProperty('--og-ink', p.ink);
  s.setProperty('--og-yellow', p.yellow);
  s.setProperty('--og-font', fontOf(p.font));
  s.setProperty('--og-weight', String(p.fontWeight));

  const big = (p.bigSize * width) / 100;
  const small = (p.smallSize * width) / 100;
  const foot = (p.footSize * width) / 100;
  const yellow = (p.overlaySize * width) / 100;
  const drop = TEXT_DROP * width;
  const arm = MARK_ARM * width;
  const line = Math.max(1, MARK_LINE * width);
  const left = FRAME.left * width;

  const rows = [
    [FRAME.top * height, p.note1, p.head1],
    [(p.row2 * height) / 100, p.note2, p.head2],
    [(p.row3 * height) / 100, '', p.head3]
  ];
  const footTop = (p.footer * height) / 100;

  const yellowHtml =
    block('og-yellow', (p.overlayX * width) / 100, (p.overlayY * height) / 100, yellow, p.overlay, 'line-height:' + p.overlayLeading) +
    block('og-yellow', (p.lowX * width) / 100, (p.lowY * height) / 100, yellow, p.overlayLow, 'line-height:' + p.overlayLeading);

  const rowHtml = rows
    .map(([top, note, head], i) => (i ? mark('tl', left, top, arm, line) : '') + block('og-small', NOTE_X * width, top + (i ? drop : 0), small, note) + block('og-big', HEAD_X * width, top + (i ? drop : 0), big, head))
    .join('');

  const footHtml = [p.foot1, p.foot2].map((text, i) => block('og-small', FOOT_X[i] * width, footTop, foot, text)).join('');

  const marks = mark('tl', left, FRAME.top * height - drop * 0.4, arm, line) + mark('bl', left, FRAME.bottom * height, arm, line) + mark('br', FRAME.right * width, FRAME.bottom * height, arm, line);

  const stamp = '<div class="og-stamp" style="right:' + (1 - FRAME.right) * width + 'px;top:' + FRAME.top * height + 'px;font-size:' + small + 'px">' + escaped(p.issue) + '</div>';
  const rule = '<div class="og-rule" style="' + box(HEAD_X * width, rows[2][0] - drop * 0.6, (FRAME.right - HEAD_X) * width, line * 2) + '"></div>';
  const caption = upright(p.caption, (FRAME.right + 0.03) * width, FRAME.bottom * height, foot, p.ink);

  scene.innerHTML = yellowHtml + rowHtml + footHtml + marks + rule + stamp + caption;
};
`;

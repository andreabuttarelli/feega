export const BOXED_TYPE_CSS = String.raw`
.bx {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--bx-paper);
  color: var(--bx-ink);
  font-family: var(--bx-font);
  font-weight: var(--bx-weight);
  -webkit-font-smoothing: antialiased;
}

.bx-rule {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  background: var(--bx-rule);
}

.bx-stack {
  position: absolute;
}

.bx-line {
  width: fit-content;
  white-space: pre;
}

.bx-tag .bx-line,
.bx-note .bx-line {
  background: var(--bx-ink);
  color: var(--bx-paper);
  line-height: 1.12;
  padding: 0 0.45em;
  text-transform: uppercase;
}

.bx-title .bx-line {
  background: var(--bx-highlight);
  letter-spacing: -0.035em;
}

.bx-statement .bx-line {
  background: var(--bx-light);
  letter-spacing: -0.02em;
  line-height: 1.1;
  padding: 0 0.4em;
}

.bx-counter {
  position: absolute;
  color: var(--bx-rule);
  letter-spacing: 0.04em;
  line-height: 1;
  white-space: pre;
}

.bx-square {
  position: absolute;
  background: var(--bx-rule);
}

.bx-word {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background: var(--bx-ink);
  color: var(--bx-light);
  letter-spacing: -0.06em;
  line-height: 1;
  white-space: pre;
}
`;

export const BOXED_TYPE_VIEW = String.raw`
const MARGIN = 0.056;
const RULE = 0.01;
const TAG_TOP = 0.029;
const TAG_X = [0.056, 0.42, 0.782];
const TITLE_TOP = 0.111;
const TITLE_STEP = 1.08;
const TITLE_PAD = 0.14;
const NOTE_DROP = 0.42;
const WORD_RIGHT = 0.944;
const WORD_BOX = 1.04;
const WORD_PAD = 0.1;
const STATEMENT_DROP = 0.76;

root.insertAdjacentHTML('beforeend', '<div class="bx"></div>');
const scene = root.querySelector('.bx');

const stack = (kind, x, y, px, text, extra) =>
  '<div class="bx-stack ' + kind + '" style="left:' + x + 'px;top:' + y + 'px;font-size:' + px + 'px;' + (extra || '') + '">' +
  linesOf(text).map((line) => '<div class="bx-line">' + escaped(line) + '</div>').join('') +
  '</div>';

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--bx-paper', p.paper);
  s.setProperty('--bx-ink', p.ink);
  s.setProperty('--bx-highlight', p.highlight);
  s.setProperty('--bx-light', p.light);
  s.setProperty('--bx-rule', p.rule);
  s.setProperty('--bx-font', fontOf(p.font));
  s.setProperty('--bx-weight', String(p.fontWeight));

  const px = (v) => (v * width) / 100;
  const margin = MARGIN * width;
  const tagPx = px(p.tagSize);
  const titlePx = px(p.titleSize);
  const titleLines = linesOf(p.title).length;
  const wordPx = px(p.wordSize);
  const wordLeft = px(p.wordLeft);
  const wordHeight = wordPx * WORD_BOX;
  const statementPx = px(p.statementSize);
  const tags = [p.tag1, p.tag2, p.tag3];
  const tagRows = Math.max(...tags.map((t) => linesOf(t).length));
  const bottomTop = height - TAG_TOP * width - tagRows * 1.12 * tagPx;

  const content = titleLines * TITLE_STEP * titlePx + STATEMENT_DROP * wordHeight + linesOf(p.statement).length * 1.1 * statementPx;
  const spare = bottomTop - TITLE_TOP * width - content - TITLE_TOP * width;
  const titleTop = TITLE_TOP * width + Math.max(0, spare) / 2;
  const wordTop = titleTop + titleLines * TITLE_STEP * titlePx;

  const tagRow = (y) => tags.map((t, i) => stack('bx-tag', TAG_X[i] * width, y, tagPx, t)).join('');
  const title = stack('bx-title', margin, titleTop, titlePx, p.title, 'line-height:' + TITLE_STEP);
  const word = '<div class="bx-word" style="' + box(wordLeft, wordTop, WORD_RIGHT * width - wordLeft, wordHeight) + 'font-size:' + wordPx + 'px;padding-right:' + WORD_PAD * wordPx + 'px">' + escaped(p.word) + '</div>';
  const statement = stack('bx-statement', margin, wordTop + STATEMENT_DROP * wordHeight, statementPx, p.statement);

  const counter = '<div class="bx-counter" style="left:' + (wordLeft + tagPx) + 'px;top:' + (wordTop + tagPx) + 'px;font-size:' + tagPx * 1.2 + 'px">' + escaped(p.counter) + '</div>';
  const square = '<div class="bx-square" style="' + box(WORD_RIGHT * width - tagPx * 1.6, bottomTop - tagPx * 3.4, tagPx * 1.6, tagPx * 1.6) + '"></div>';
  const caption = upright(p.caption, width - margin * 0.62, wordTop + wordHeight, tagPx, p.ink);

  scene.innerHTML = '<div class="bx-rule" style="height:' + RULE * width + 'px"></div>' + tagRow(TAG_TOP * width) + title + word + statement + tagRow(bottomTop) + counter + square + caption + '<div class="bx-note-slot"></div>';

  scene.querySelectorAll('.bx-title .bx-line').forEach((line) => {
    line.style.padding = '0 ' + TITLE_PAD * titlePx + 'px';
  });
  const anchor = scene.querySelectorAll('.bx-title .bx-line')[Math.min(titleLines, Math.max(1, p.noteLine)) - 1];
  const noteX = anchor ? margin + anchor.offsetLeft + anchor.offsetWidth - tagPx * 0.3 : margin;
  const noteY = anchor ? titleTop + anchor.offsetTop + NOTE_DROP * titlePx : titleTop;
  scene.querySelector('.bx-note-slot').outerHTML = stack('bx-note', noteX, noteY, tagPx, p.note);
};
`;

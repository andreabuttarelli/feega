import { POSTER_TEXT } from '../poster-kit';

export const STENCIL_STEPS_CSS = String.raw`
.ss {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--ss-paper);
  -webkit-font-smoothing: antialiased;
}

.ss-rect {
  position: absolute;
}

.ss-syllable {
  position: absolute;
  white-space: pre;
  line-height: 0.8;
  letter-spacing: -0.03em;
}

.ss-label {
  position: absolute;
  font-weight: 700;
  line-height: 1.06;
}

.ss-label span {
  display: block;
  width: fit-content;
  padding: 0.04em 0.28em;
  white-space: pre;
  background: var(--ss-tag);
}
`;

export const STENCIL_STEPS_VIEW = String.raw`
${POSTER_TEXT}
root.insertAdjacentHTML('beforeend', '<div class="ss"></div>');
const scene = root.querySelector('.ss');

const CUT_BAND = 7;

const cutMask = (at) => {
  const from = at - CUT_BAND / 2;
  const to = at + CUT_BAND / 2;
  const mask = 'linear-gradient(176deg, #000 0 ' + from + '%, transparent ' + from + '% ' + to + '%, #000 ' + to + '%)';
  return '-webkit-mask-image:' + mask + ';mask-image:' + mask + ';';
};

const labelHtml = (text, field, index, left, top, px, colour) =>
  '<div class="ss-label"' + part(field, index) + ' style="left:' + left + 'px;top:' + top + 'px;font-size:' + px + 'px;color:' + colour + '">' + linesOf(text).map((line) => '<span>' + escaped(line) + '</span>').join('') + '</div>';

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--ss-paper', p.paper);
  s.setProperty('--ss-tag', p.tagsColor);
  s.fontFamily = fontOf(p.smallFont);
  const X = (v) => (Number(v) / 100) * width;
  const Y = (v) => (Number(v) / 100) * height;
  const px = (p.smallSize / 100) * width;

  const rects = rowsOf(p.rects).map(([x, y, w, h, colour], i) => '<div class="ss-rect"' + part('rects', i) + ' style="' + box(X(x), Y(y), X(w), Y(h)) + 'background:' + (colour || p.rectsColor) + '"></div>').join('');
  const sylPx = (p.syllablesSize / 100) * width;
  const syllables = rowsOf(p.syllables).map(([text, x, y], i) => '<div class="ss-syllable"' + part('syllables', i) + ' style="left:' + X(x) + 'px;top:' + Y(y) + 'px;font-size:' + sylPx + 'px;font-weight:900;color:' + p.syllablesColor + ';font-family:' + cssFont(p.syllablesFont) + ';' + cutMask(p.syllablesCut) + '">' + escaped(text) + '</div>').join('');
  const tags = rowsOf(p.tags).map(([text, x, y], i) => labelHtml(text, 'tags', i, X(x), Y(y), px * 0.62, p.tagsTextColor)).join('');
  const labelPart = (p, key, scale) => labelHtml(p[key], key, undefined, X(p[key + 'X']), Y(p[key + 'Y']), px * scale, p[key + 'Color']);
  const labels = labelPart(p, 'title', 1) + labelPart(p, 'dates', 1.5) + labelPart(p, 'program', 1) + labelPart(p, 'marker', 1) + labelPart(p, 'index', 0.55);
  scene.innerHTML = rects + syllables + tags + labels;
};
`;

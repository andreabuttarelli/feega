import { POSTER_SHAPES, POSTER_TEXT } from '../poster-kit';

export const METABALL_LISTING_CSS = String.raw`
.ml {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--ml-paper);
  -webkit-font-smoothing: antialiased;
}

.ml-layer {
  position: absolute;
  inset: 0;
}

.ml-grid {
  position: absolute;
  display: grid;
  grid-auto-rows: 1fr;
}

.ml-cell {
  border-top: 2px solid var(--ml-rule);
  padding-top: 0.5em;
  line-height: 1.02;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: pre;
}

.ml-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.42em;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 0.6em;
}

.ml-genre {
  font-size: 0.8em;
  font-weight: 400;
}

.ml-word {
  position: absolute;
  margin: 0;
  white-space: pre;
  line-height: 0.8;
  letter-spacing: -0.045em;
}
`;

export const METABALL_LISTING_VIEW = String.raw`
${POSTER_TEXT}
${POSTER_SHAPES}
root.insertAdjacentHTML('beforeend', '<div class="ml"></div>');
const scene = root.querySelector('.ml');

const GRID = { left: 2.5, top: 1.5, right: 2.5, bottom: 8 };
const HALFTONE_SHIFT = 0.018;

const cellHtml = (p, row, i) => {
  const [date, genre, title, names] = row;
  const lineup = String(names || '').split('/').map((n) => n.trim()).join('\n');
  return '<div class="ml-cell"' + part('events', i) + '><div class="ml-head"><span>' + escaped(date || '') + '</span><span class="ml-genre">' + escaped(genre || '') + '</span></div><div style="color:' + p.eventsColor + '">' + escaped(title || '') + '</div><div style="color:' + p.eventsMuteColor + '">' + escaped(lineup) + '</div></div>';
};

const blobsHtml = (p, width, height) => {
  const circles = rowsOf(p.blobs).map(([x, y, r], i) => '<circle' + part('blobs', i) + ' cx="' + (Number(x) / 100) * width + '" cy="' + (Number(y) / 100) * height + '" r="' + (Number(r) / 100) * width + '"/>').join('');
  const shift = HALFTONE_SHIFT * width;
  const plain = circles.replace(/ data-part="[^"]*"/g, '');
  const defs = '<defs>' + gooFilter('mlGoo', width * 0.012) + dotPattern('mlDots', width * 0.0095, width * 0.0024, p.halftoneColor) +
    '<mask id="mlShade"><g transform="translate(' + shift + ' ' + shift + ')" filter="url(#mlGoo)" fill="#ffffff">' + plain + '</g></mask></defs>';
  return '<svg class="ml-layer" width="' + width + '" height="' + height + '">' + defs +
    '<rect width="' + width + '" height="' + height + '" fill="url(#mlDots)" mask="url(#mlShade)"/>' +
    '<g filter="url(#mlGoo)" fill="' + p.blobsColor + '">' + circles + '</g></svg>';
};

const draw = (p, width, height) => {
  const s = scene.style;
  s.setProperty('--ml-paper', p.paper);
  s.setProperty('--ml-rule', p.eventsColor);
  s.fontFamily = fontOf(p.smallFont);
  const X = (v) => (Number(v) / 100) * width;
  const Y = (v) => (Number(v) / 100) * height;

  const box = 'left:' + X(GRID.left) + 'px;top:' + Y(GRID.top) + 'px;right:' + X(GRID.right) + 'px;bottom:' + Y(GRID.bottom) + 'px;';
  const grid = '<div class="ml-grid" style="' + box + 'grid-template-columns:repeat(' + p.eventsColumns + ',1fr);column-gap:' + X(1.2) + 'px;font-size:' + (p.smallSize / 100) * width + 'px">' + rowsOf(p.events).map((row, i) => cellHtml(p, row, i)).join('') + '</div>';

  const wordPx = (p.wordsSize / 100) * width;
  const words = rowsOf(p.words).map(([text, x, y], i) => '<div class="ml-word"' + part('words', i) + ' style="left:' + X(x) + 'px;top:' + Y(y) + 'px;font-size:' + wordPx + 'px;font-weight:' + p.wordsWeight + ';color:' + p.wordsColor + ';font-family:' + cssFont(p.wordsFont) + '">' + escaped(text) + '</div>').join('');

  const marker = textPart(p, 'marker', width, height, 'font-weight:700;font-size:' + width * 0.022 + 'px;');
  const index = textPart(p, 'index', width, height, 'font-size:' + width * 0.01 + 'px;letter-spacing:0.1em;text-transform:uppercase;transform-origin:0 0;transform:rotate(-90deg);');
  scene.innerHTML = blobsHtml(p, width, height) + grid + words + textPart(p, 'footer', width, height, 'font-size:' + width * 0.012 + 'px;') + marker + index;
};
`;

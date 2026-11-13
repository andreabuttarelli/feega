import { readFileSync, writeFileSync } from 'node:fs';
import * as fontkit from 'fontkit';
import { Resvg } from '@resvg/resvg-js';

const FONT = 'static/fonts/fragment-mono-latin.woff2';
const OUT = 'src/lib/canvas/effects/typo/glyph-atlas.ts';
const CELL_W = 16;
const CELL_H = 28;
const FIRST = 32;
const LAST = 126;

const font = fontkit.create(readFileSync(FONT));
const scale = (CELL_H * 0.78) / font.unitsPerEm;
const baseline = CELL_H * 0.76;
const count = LAST - FIRST + 1;
const width = CELL_W * count;

const paths = [];
for (let code = FIRST; code <= LAST; code++) {
  const glyph = font.glyphForCodePoint(code);
  const advance = glyph.advanceWidth * scale;
  const x = (code - FIRST) * CELL_W + (CELL_W - advance) / 2;
  paths.push(`<path transform="translate(${x} ${baseline}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${CELL_H}"><g fill="#fff">${paths.join('')}</g></svg>`;
const png = new Resvg(svg, { background: 'rgba(0,0,0,0)' }).render();
const rgba = png.pixels;
const alpha = new Uint8Array(width * CELL_H);
for (let i = 0; i < alpha.length; i++) {
  alpha[i] = rgba[i * 4 + 3];
}

writeFileSync(
  OUT,
  `export const ATLAS = { cellWidth: ${CELL_W}, cellHeight: ${CELL_H}, first: ${FIRST}, last: ${LAST}, alpha: '${Buffer.from(alpha).toString('base64')}' } as const;\n`
);

import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, smallTextProps, textPartProps } from '../poster-kit';
import { GLYPH_SPECIMEN_CSS, GLYPH_SPECIMEN_VIEW } from './view';

export const GLYPH_SPECIMEN_COMPONENT = 'GlyphSpecimenPoster';
export const GLYPH_SPECIMEN_VAR_PREFIX = 'glyphspec';

export const GLYPH_SPECIMEN_FONTS = ['Archivo', 'Inter Tight', 'Space Mono', 'Bricolage Grotesque', 'Unbounded'];

const GLYPHS = ['k|8|-6', 'f|-6|-14', 'a|-4|-18', 'g|-34|-26', 'e|6|-10', 't|-18|-12'].join('\n');

const CHAIN_LINKS = 62;
const seq = (k: number) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const round = (n: number) => Math.round(n * 10) / 10;

function chainOf(links: number): string {
  let x = 64;
  let y = 8;
  const rows: string[] = [];
  for (let i = 0; i < links; i++) {
    rows.push(`${round(x)}|${round(y)}|${round(2.6 + seq(i * 3) * 3)}`);
    x = Math.min(94, Math.max(44, x + (seq(i * 5 + 1) - 0.5) * 26));
    y += 1.2 + seq(i * 7 + 2) * 0.9;
  }
  return rows.join('\n');
}

const INK = '#0b0b0b';
const ACID = '#c6ff1a';

export const GLYPH_SPECIMEN_PROPS: Record<string, PropSpec> = {
  glyphs: linesProp('Glyph crops: glyph | left %, top % in its cell', GLYPHS),
  glyphsColor: colourProp('Glyph and cell colour', INK),
  glyphsFont: fontProp('Glyph font', 'Archivo'),
  glyphsSize: numberProp('Glyph size (% of the width)', 56, 20, 90, 1),
  rules: numberProp('Ruled lines, top half', 38, 0, 80, 1),
  rulesColor: colourProp('Ruled line colour', '#5f6a9a'),
  chain: linesProp('Blob chain: left %, top %, radius %', chainOf(CHAIN_LINKS), 1500),
  chainColor: colourProp('Blob chain colour', ACID),
  ...textPartProps('side', 'Vertical title, left', 'Type Features', { color: INK, x: 2, y: 52, lines: false }),
  ...textPartProps('dates', 'Vertical dates, over the cells', '04–28.10.27 Type Show 01', { color: ACID, x: 13, y: 62 }),
  ...textPartProps('footer', 'Footer, big', 'Specimen Sheet', { color: INK, x: 11, y: 90.6 }),
  ...textPartProps('features', 'Feature list, mono', 'SS01 Single storey a   SS02 Open tail g\nSS03 Round dots       SS04 Alt figure 4', { color: '#3a4470', x: 11, y: 1.2, lines: true }),
  ...textPartProps('index', 'Index, mono, foot right', 'Sheet 02 / 04\nPrint run /50', { color: INK, x: 62, y: 1.2, lines: true }),
  ...textPartProps('marker', 'Number mark, corner', '2', { color: INK, x: 86, y: 6 }),
  ...smallTextProps('Inter Tight', 2),
  paper: colourProp('Background colour', '#f4f4f0'),
  [VAR_PREFIX]: prefixProp(GLYPH_SPECIMEN_VAR_PREFIX)
};

export const glyphSpecimenComponent = (): CustomComponent => posterComponent({ css: GLYPH_SPECIMEN_CSS, js: GLYPH_SPECIMEN_VIEW }, GLYPH_SPECIMEN_PROPS);

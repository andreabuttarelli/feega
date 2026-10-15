import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, mediaProp, numberProp, posterComponent, prefixProp, smallTextProps, textPartProps } from '../poster-kit';
import { PIXEL_BURST_CSS, PIXEL_BURST_VIEW } from './view';

export const PIXEL_BURST_COMPONENT = 'PixelBurstPoster';
export const PIXEL_BURST_VAR_PREFIX = 'pixelburst';

export const PIXEL_BURST_FONTS = ['Pixelify Sans', 'Silkscreen', 'Jersey 10', 'Inter Tight', 'Archivo'];

const INK = '#f2f2f0';

export const PIXEL_BURST_PROPS: Record<string, PropSpec> = {
  ...textPartProps('title', 'Pixel title, slanted', 'hold\nyour\nnerve', { color: INK, font: 'Pixelify Sans', size: 22, x: 6.5, y: 2.5, weight: 500, lines: true }),
  burstColor: colourProp('Starburst colour', '#f07fe9'),
  burstX: numberProp('Starburst centre, left %', 52, 0, 100, 0.5),
  burstY: numberProp('Starburst centre, top %', 47, 0, 100, 0.5),
  burstSize: numberProp('Starburst size (% of the width)', 92, 20, 140, 1),
  burstPoints: numberProp('Starburst points', 14, 5, 30, 1),
  photo: mediaProp('Photo inside the starburst'),
  ...textPartProps('stack', 'Stacked words, right', 'and\ntake\nthe\nleap', { color: INK, size: 15.5, x: 96.5, y: 47, weight: 600, lines: true }),
  ...textPartProps('details', 'Details, foot left', 'Open Air Contest\n22/03/2027\n9:00am–5:00pm', { color: INK, x: 2.5, y: 82, lines: true }),
  ...textPartProps('button', 'Outlined button', 'Sign up', { color: INK, x: 2.5, y: 93 }),
  ...textPartProps('index', 'Small line, top right', 'issue 03 — open call, all levels', { color: '#bdbdbd', x: 97, y: 4 }),
  ...textPartProps('marker', 'Tag, under the title', 'NO. 03', { color: '#f07fe9', x: 5.5, y: 54 }),
  ...smallTextProps('Inter Tight', 3),
  paper: colourProp('Background colour', '#0b0b0b'),
  [VAR_PREFIX]: prefixProp(PIXEL_BURST_VAR_PREFIX)
};

export const pixelBurstComponent = (): CustomComponent => posterComponent({ css: PIXEL_BURST_CSS, js: PIXEL_BURST_VIEW }, PIXEL_BURST_PROPS);

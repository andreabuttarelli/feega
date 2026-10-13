import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { ISO_BLOCKS_CSS, ISO_BLOCKS_VIEW } from './view';

export const ISO_BLOCKS_COMPONENT = 'IsoBlocksPoster';
export const ISO_BLOCKS_VAR_PREFIX = 'isoblocks';

export const ISO_BLOCKS_FONTS = ['Inter Tight', 'Tektur', 'Chakra Petch', 'Oxanium', 'Space Grotesk', 'Archivo', 'Geist'];

const HEADER = ['Studio Name presents', '— Night Session', 'Special — / Room', 'Saturday 00.00.0000'].join('\n');
const INFO = ['VENUE NAME / 00:00', 'Street Name 00', '00000 City', 'link in bio'].join('\n');
const LINEUP = ['NAME ONE,\nNAME TWO,\nNAME THREE\nAND FOUR', 'VJ\nNAME\nSURNAME', 'GENRE\n& GENRE'].join('\n\n');
const BLOCKS = ['4 40 44 20 20', '60 54 16 22 20', '28 76 20 18 16'].join('\n');

export const ISO_BLOCKS_PROPS: Record<string, PropSpec> = {
  header: linesProp('Event header, top right', HEADER),
  mark: linesProp('Name under the mark, top left', 'STUDIO\nNAME'),
  lineup: linesProp('Block text, one block per paragraph', LINEUP),
  blocks: linesProp('Blocks: left top length depth height, % per line', BLOCKS),
  info: linesProp('Venue info, by the rule', INFO),
  marker: textProp('Number in the circle on the accent block', '07', { maxLength: 4 }),
  caption: textProp('Vertical caption, right edge', 'night series — volume seven', { maxLength: 60 }),
  font: fontProp('Header font', 'Inter Tight'),
  blockFont: fontProp('Block font', 'Tektur'),
  paper: colourProp('Paper colour', '#ffffff'),
  ink: colourProp('Block and type colour', '#000000'),
  accent: colourProp('Accent: one top face and the circle', '#ff4a1c'),
  accentBlock: numberProp('Block with the accent top face', 2, 0, 3, 1, 'Style'),
  headerSize: numberProp('Header size (% of the width)', 5.2, 2, 9, 0.1),
  blockTextSize: numberProp('Block text size (% of the width)', 5.4, 2, 10, 0.1),
  [VAR_PREFIX]: prefixProp(ISO_BLOCKS_VAR_PREFIX)
};

export const isoBlocksComponent = (): CustomComponent => posterComponent({ css: ISO_BLOCKS_CSS, js: ISO_BLOCKS_VIEW }, ISO_BLOCKS_PROPS);

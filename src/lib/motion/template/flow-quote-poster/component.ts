import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { FLOW_QUOTE_CSS, FLOW_QUOTE_VIEW } from './view';

export const FLOW_QUOTE_COMPONENT = 'FlowQuotePoster';
export const FLOW_QUOTE_VAR_PREFIX = 'flowquote';

export const FLOW_QUOTE_FONTS = ['Archivo', 'Inter Tight', 'Hanken Grotesk', 'Geist', 'Space Grotesk'];

const PILLS = ['good ideas|6|4|42', 'rarely|52|4|22', 'arrive on|6|17|28', 'schedule.|38|17|30', 'stay patient.|8|30|40', 'studio|10|46|24', 'name|48|46|22'].join('\n');

export const FLOW_QUOTE_PROPS: Record<string, PropSpec> = {
  pills: linesProp('Pills: text | left %, top %, width %', PILLS, 800),
  pillsColor: colourProp('Pill colour', '#ffffff'),
  pillsTextColor: colourProp('Pill text colour', '#0a0a0a'),
  pillsFont: fontProp('Pill font', 'Archivo'),
  pillsHeight: numberProp('Pill height (% of the width)', 8, 3, 16, 0.1),
  authorFrom: numberProp('Pill index where the author line starts', 5, 1, 20, 1),
  connectorColor: colourProp('Connector colour', '#ffffff'),
  connectorWidth: numberProp('Connector thickness (% of the width)', 1.1, 0.3, 3, 0.1),
  marker: textProp('Word in the accent circle', 'new', { maxLength: 6 }),
  markerColor: colourProp('Circle colour', '#ff5a3c'),
  markerFont: fontProp('Circle font', 'Space Grotesk'),
  markerSize: numberProp('Circle size (% of the width)', 7, 2, 16, 0.1),
  markerX: numberProp('Circle, left %', 88, 0, 100, 0.5),
  markerY: numberProp('Circle, top %', 7, 0, 100, 0.5),
  index: textProp('Number in the small pill, top left', '07', { maxLength: 6 }),
  indexColor: colourProp('Small pill colour', '#2a2a2a'),
  indexFont: fontProp('Small pill font', 'Space Grotesk'),
  indexSize: numberProp('Small pill size (% of the width)', 2.8, 1, 6, 0.1),
  indexX: numberProp('Small pill, left %', 6, 0, 80, 0.5),
  indexY: numberProp('Small pill, top %', 62, 0, 100, 0.5),
  paper: colourProp('Background colour', '#0a0a0a'),
  [VAR_PREFIX]: prefixProp(FLOW_QUOTE_VAR_PREFIX)
};

export const flowQuoteComponent = (): CustomComponent => posterComponent({ css: FLOW_QUOTE_CSS, js: FLOW_QUOTE_VIEW }, FLOW_QUOTE_PROPS);

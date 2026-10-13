import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { CIRCLE_EVENT_CSS, CIRCLE_EVENT_VIEW } from './view';

export const CIRCLE_EVENT_COMPONENT = 'CircleEventPoster';
export const CIRCLE_EVENT_VAR_PREFIX = 'circleevent';

export const CIRCLE_EVENT_FONTS = ['Inter Tight', 'Inter', 'Hanken Grotesk', 'Host Grotesk', 'Schibsted Grotesk', 'Geist', 'Archivo'];

const INFO = ['studio name', 'design tour', '2027', '', '6:00pm', 'tour', 'venue name', '00 street', 'name', '', '7:30pm', 'drink', 'venue', 'name hotel', '000 w', 'avenue'].join('\n');
const BODY =
  'Notes on Creativity is a placeholder for a short text about the event: what it shows, who it is for and why it matters. Replace it with two or three sentences of your own, set small so the column keeps its shape.';

export const CIRCLE_EVENT_PROPS: Record<string, PropSpec> = {
  heading: linesProp('Name, top left', 'Name\nSurname'),
  title: linesProp('Title, the last line in the accent colour', 'Notes on\nCreativity'),
  date: linesProp('Date, above the title', 'mon 00\nthursday'),
  info: linesProp('Schedule column, right', INFO),
  body: linesProp('Small text, right', BODY, 800),
  marker: textProp('Number in the small circle', '03', { maxLength: 4 }),
  caption: textProp('Vertical caption, right edge', 'talk series — evening three', { maxLength: 60 }),
  font: fontProp('Font', 'Inter Tight'),
  fontWeight: numberProp('Weight', 700, 300, 900, 100, 'Style'),
  paper: colourProp('Paper colour', '#ffffff'),
  ink: colourProp('Type colour', '#000000'),
  accent: colourProp('Circle and accent colour', '#1faa3b'),
  nameSize: numberProp('Name size (% of the width)', 16.4, 5, 25, 0.1),
  titleSize: numberProp('Title size (% of the width)', 20.4, 5, 30, 0.1),
  dateSize: numberProp('Date size (% of the width)', 7.4, 2, 15, 0.1),
  infoSize: numberProp('Schedule size (% of the width)', 2.95, 1, 6, 0.05),
  infoX: numberProp('Schedule column left edge (% of the width)', 78, 50, 92, 0.5),
  circleSize: numberProp('Circle diameter (% of the width)', 85, 20, 140, 0.5),
  circleX: numberProp('Circle centre across (% of the width)', 56.2, 0, 100, 0.5),
  circleY: numberProp('Circle centre down (% of the height)', 50.5, 0, 100, 0.5),
  [VAR_PREFIX]: prefixProp(CIRCLE_EVENT_VAR_PREFIX)
};

export const circleEventComponent = (): CustomComponent => posterComponent({ css: CIRCLE_EVENT_CSS, js: CIRCLE_EVENT_VIEW }, CIRCLE_EVENT_PROPS);

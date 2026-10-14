import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { HAZE_GRID_CSS, HAZE_GRID_VIEW } from './view';

export const HAZE_GRID_COMPONENT = 'HazeGridPoster';
export const HAZE_GRID_VAR_PREFIX = 'hazegrid';

export const HAZE_GRID_FONTS = ['Hanken Grotesk', 'Inter Tight', 'Archivo', 'Manrope', 'Geist', 'Space Mono'];

const ROWS = ['i want|to', 'work|slower', 'and|build', '|better'].join('\n');
const MARKS = ['0 left 01', '0 right 02', '1 left 03', '1 right 04', '2 left 05', '2 right 06'].join('\n');
const BODY = 'pause for a second and notice how far you have already come. small steps still count — be proud of the distance behind you.';

export const HAZE_GRID_PROPS: Record<string, PropSpec> = {
  rows: linesProp('Title rows: left word | right word', ROWS),
  rowsColor: colourProp('Title colour', '#aecbe0'),
  rowsSize: numberProp('Title size (% of the width)', 15.5, 6, 22, 0.1),
  rowsWeight: numberProp('Title weight', 300, 100, 800, 100, 'Style'),
  rowsX: numberProp('Title block, left %', 5, 0, 30, 0.5),
  rowsY: numberProp('Title block, top %', 2, 0, 20, 0.5),
  marks: linesProp('Superscripts: row, left/right, number', MARKS),
  marksColor: colourProp('Superscript colour', '#aecbe0'),
  note: linesProp('Note, upper middle', 'come back to this\nwhenever you need it\n\n2025–2026'),
  noteColor: colourProp('Note colour', '#cfe1ee'),
  noteX: numberProp('Note, left %', 46, 0, 90, 0.5),
  noteY: numberProp('Note, top %', 45, 0, 95, 0.5),
  body: linesProp('Paragraph, bottom', BODY, 400),
  bodyColor: colourProp('Paragraph colour', '#8ea8bb'),
  bodyX: numberProp('Paragraph, left %', 55, 0, 90, 0.5),
  bodyY: numberProp('Paragraph, top %', 80, 0, 97, 0.5),
  issue: textProp('Corner line, top left', 'vol. 01 — notes to self', { maxLength: 40 }),
  issueColor: colourProp('Corner line colour', '#6f93ac'),
  issueX: numberProp('Corner line, left %', 5, 0, 60, 0.5),
  issueY: numberProp('Corner line, top %', 2, 0, 20, 0.5),
  marker: textProp('Word in the circle', 'now', { maxLength: 6 }),
  markerColor: colourProp('Circle colour', '#5c87a3'),
  markerSize: numberProp('Circle size (% of the width)', 6.5, 2, 14, 0.1),
  markerX: numberProp('Circle, left %', 78, 0, 100, 0.5),
  markerY: numberProp('Circle, top %', 5, 0, 100, 0.5),
  caption: textProp('Vertical caption, right edge', 'quiet thoughts, printed', { maxLength: 60 }),
  captionColor: colourProp('Caption colour', '#6f93ac'),
  captionX: numberProp('Caption, left %', 97, 50, 100, 0.5),
  captionY: numberProp('Caption, top %', 32, 0, 100, 0.5),
  hazeColor: colourProp('Haze colour', '#dce9f6'),
  hazeX: numberProp('Haze, centre left %', 14, 0, 100, 0.5),
  hazeY: numberProp('Haze, centre top %', 92, 0, 100, 0.5),
  paper: colourProp('Background colour', '#070d17'),
  font: fontProp('Font', 'Hanken Grotesk'),
  gridColor: colourProp('Grid colour', '#1c2e42'),
  gridCols: numberProp('Grid columns', 3, 1, 8, 1),
  gridRows: numberProp('Grid rows', 6, 2, 12, 1),
  [VAR_PREFIX]: prefixProp(HAZE_GRID_VAR_PREFIX)
};

export const hazeGridComponent = (): CustomComponent => posterComponent({ css: HAZE_GRID_CSS, js: HAZE_GRID_VIEW }, HAZE_GRID_PROPS);

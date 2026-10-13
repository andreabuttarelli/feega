import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { OVERLAY_GRID_CSS, OVERLAY_GRID_VIEW } from './view';

export const OVERLAY_GRID_COMPONENT = 'OverlayGridPoster';
export const OVERLAY_GRID_VAR_PREFIX = 'overlaygrid';

export const OVERLAY_GRID_FONTS = ['Azeret Mono', 'Space Mono', 'JetBrains Mono', 'Martian Mono', 'Geist Mono', 'IBM Plex Mono', 'Space Grotesk'];

export const OVERLAY_GRID_PROPS: Record<string, PropSpec> = {
  head1: linesProp('Big text, first row', 'DESIGN FOR\nDESIGN'),
  head2: linesProp('Big text, second row', 'ON COLLECTING/\nARCHIVING/\nPRESENTING'),
  head3: linesProp('Big text, third row', '00 APRIL –\n00 MAY 2027'),
  note1: linesProp('Small text, first row', 'EXHIBI-\nTION\nOPENING\n00 APRIL 2027\n7 PM'),
  note2: linesProp('Small text, second row', 'STUDIO NAME\nINSTITUTE FOR\nNEW\nFORMS'),
  foot1: linesProp('Footer, left column', 'STUDIO NAME\nINSTITUTE FOR NEW FORMS\n\nVENUE, STREET 00\n00000 CITY\n\nWWW.STUDIO.COM'),
  foot2: linesProp('Footer, right column', 'OPENING HOURS:\nTUE–SAT 2–7 PM\nSUN 2–5 PM\n\nAND BY APPOINTMENT\nTEL. 000 000 00 00'),
  overlay: linesProp('Overlaid words, right', '2 ROOMS\n16 DESIGNS\n 5 MONITORS\n2 PROJECTORS\n16 CATALOGUES\n7 CORPORATE'),
  overlayLow: linesProp('Overlaid words, lower left', 'ER\nRE\nAYER\nGE\n\nATE DESIGNS'),
  issue: textProp('Stamp, top right', 'NO. 07', { maxLength: 20 }),
  caption: textProp('Vertical caption, right edge', 'EXHIBITION SERIES — SHEET 07 / 12', { maxLength: 60 }),
  font: fontProp('Font', 'Azeret Mono'),
  fontWeight: numberProp('Weight', 500, 300, 800, 100, 'Style'),
  paper: colourProp('Paper colour', '#c9c9c7'),
  ink: colourProp('Type colour', '#141414'),
  yellow: colourProp('Overlaid words colour', '#f6ef00'),
  bigSize: numberProp('Big text size (% of the width)', 6.2, 2, 10, 0.1),
  smallSize: numberProp('Small text size (% of the width)', 2.15, 1, 4, 0.05),
  footSize: numberProp('Footer size (% of the width)', 1.4, 0.8, 3, 0.05),
  overlaySize: numberProp('Overlaid words size (% of the width)', 7.8, 2, 14, 0.1),
  overlayLeading: numberProp('Overlaid words line height (em)', 1.06, 0.9, 2, 0.02),
  overlayX: numberProp('Overlaid words, right: left edge (% of the width)', 35.5, 0, 90, 0.5),
  overlayY: numberProp('Overlaid words, right: top (% of the height)', 8.6, 0, 90, 0.5),
  lowX: numberProp('Overlaid words, lower left: left edge (% of the width)', 9, 0, 90, 0.5),
  lowY: numberProp('Overlaid words, lower left: top (% of the height)', 48.5, 0, 95, 0.5),
  row2: numberProp('Second row top (% of the height)', 34, 15, 60, 0.5),
  row3: numberProp('Third row top (% of the height)', 63.3, 40, 85, 0.5),
  footer: numberProp('Footer top (% of the height)', 79.5, 60, 92, 0.5),
  [VAR_PREFIX]: prefixProp(OVERLAY_GRID_VAR_PREFIX)
};

export const overlayGridComponent = (): CustomComponent => posterComponent({ css: OVERLAY_GRID_CSS, js: OVERLAY_GRID_VIEW }, OVERLAY_GRID_PROPS);

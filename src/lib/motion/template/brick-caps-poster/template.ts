import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { BRICK_CAPS_COMPONENT, BRICK_CAPS_FONTS, BRICK_CAPS_PROPS, BRICK_CAPS_VAR_PREFIX, brickCapsComponent } from './component';

export const BRICK_CAPS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-brick-caps`;
export const BRICK_CAPS_CLIP = 'poster';
export const BRICK_CAPS_KEY_FIELDS = ['bars', 'corners', 'marker', 'index', 'bars_color'];
const BRICK_CAPS_GRAIN = 0.03;

export const BRICK_CAPS_POSTER_TEMPLATE: TemplateEntry = {
  id: BRICK_CAPS_TEMPLATE_ID,
  template: {
    name: 'Poster brick caps',
    description: 'A pale yellow poster over a thin brick grid: stacked black bars carrying big white caps lines (event, day, date, programme), small info corners, an accent circle and an index line.',
    keyFields: BRICK_CAPS_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-brick-caps', component: BRICK_CAPS_COMPONENT, code: brickCapsComponent(), props: BRICK_CAPS_PROPS, fonts: BRICK_CAPS_FONTS, varPrefix: BRICK_CAPS_VAR_PREFIX, vars: [], clip: BRICK_CAPS_CLIP }, BRICK_CAPS_GRAIN)
  }
};

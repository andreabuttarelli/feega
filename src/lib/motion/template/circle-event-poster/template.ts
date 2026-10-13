import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { CIRCLE_EVENT_COMPONENT, CIRCLE_EVENT_FONTS, CIRCLE_EVENT_PROPS, CIRCLE_EVENT_VAR_PREFIX, circleEventComponent } from './component';

export const CIRCLE_EVENT_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-circle-event`;
export const CIRCLE_EVENT_CLIP = 'poster';
export const CIRCLE_EVENT_KEY_FIELDS = ['heading', 'title', 'info', 'accent', 'font'];
const CIRCLE_EVENT_GRAIN = 0.05;

export const CIRCLE_EVENT_POSTER_TEMPLATE: TemplateEntry = {
  id: CIRCLE_EVENT_TEMPLATE_ID,
  template: {
    name: 'Poster circle event',
    description: 'A talk poster on white: a giant two-line name top left, a huge green circle, a schedule column on the right, the date and a big two-line title at the foot with its last line in green.',
    keyFields: CIRCLE_EVENT_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-circle-event', component: CIRCLE_EVENT_COMPONENT, code: circleEventComponent(), props: CIRCLE_EVENT_PROPS, fonts: CIRCLE_EVENT_FONTS, varPrefix: CIRCLE_EVENT_VAR_PREFIX, vars: [], clip: CIRCLE_EVENT_CLIP }, CIRCLE_EVENT_GRAIN)
  }
};

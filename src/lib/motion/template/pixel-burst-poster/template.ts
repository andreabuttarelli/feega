import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { PIXEL_BURST_COMPONENT, PIXEL_BURST_FONTS, PIXEL_BURST_PROPS, PIXEL_BURST_VAR_PREFIX, pixelBurstComponent } from './component';

export const PIXEL_BURST_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-pixel-burst`;
export const PIXEL_BURST_CLIP = 'poster';
export const PIXEL_BURST_KEY_FIELDS = ['title', 'photo', 'stack', 'burst_color', 'marker'];
const PIXEL_BURST_GRAIN = 0.2;

export const PIXEL_BURST_POSTER_TEMPLATE: TemplateEntry = {
  id: PIXEL_BURST_TEMPLATE_ID,
  template: {
    name: 'Poster pixel burst',
    description: 'A grainy black poster: a slanted pixel-type title, a pink starburst masking a photo, heavy stacked words on the right, event details and an outlined button.',
    keyFields: PIXEL_BURST_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-pixel-burst', component: PIXEL_BURST_COMPONENT, code: pixelBurstComponent(), props: PIXEL_BURST_PROPS, fonts: PIXEL_BURST_FONTS, varPrefix: PIXEL_BURST_VAR_PREFIX, vars: [], clip: PIXEL_BURST_CLIP }, PIXEL_BURST_GRAIN)
  }
};

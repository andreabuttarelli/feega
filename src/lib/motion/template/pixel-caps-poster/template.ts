import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { PIXEL_CAPS_COMPONENT, PIXEL_CAPS_FONTS, PIXEL_CAPS_PROPS, PIXEL_CAPS_VAR_PREFIX, pixelCapsComponent } from './component';

export const PIXEL_CAPS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-pixel-caps`;
export const PIXEL_CAPS_CLIP = 'poster';
export const PIXEL_CAPS_KEY_FIELDS = ['title', 'columns', 'photos', 'block_number', 'block_label'];
const PIXEL_CAPS_GRAIN = 0.035;

export const PIXEL_CAPS_POSTER_TEMPLATE: TemplateEntry = {
  id: PIXEL_CAPS_TEMPLATE_ID,
  template: {
    name: 'Poster pixel caps',
    description: 'A warm off-white poster: a heavy 3-line caps title top left over a scatter of small orange pixels, two black blocks with a number and a label, two photo slots and two justified caps text columns.',
    keyFields: PIXEL_CAPS_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-pixel-caps', component: PIXEL_CAPS_COMPONENT, code: pixelCapsComponent(), props: PIXEL_CAPS_PROPS, fonts: PIXEL_CAPS_FONTS, varPrefix: PIXEL_CAPS_VAR_PREFIX, vars: [], clip: PIXEL_CAPS_CLIP }, PIXEL_CAPS_GRAIN)
  }
};

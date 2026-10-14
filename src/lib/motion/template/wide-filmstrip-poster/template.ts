import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { WIDE_FILMSTRIP_COMPONENT, WIDE_FILMSTRIP_FONTS, WIDE_FILMSTRIP_PROPS, WIDE_FILMSTRIP_VAR_PREFIX, wideFilmstripComponent } from './component';

export const WIDE_FILMSTRIP_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-wide-filmstrip`;
export const WIDE_FILMSTRIP_CLIP = 'poster';
export const WIDE_FILMSTRIP_KEY_FIELDS = ['title', 'photos', 'dates', 'left', 'font'];
const WIDE_FILMSTRIP_GRAIN = 0.03;

export const WIDE_FILMSTRIP_POSTER_TEMPLATE: TemplateEntry = {
  id: WIDE_FILMSTRIP_TEMPLATE_ID,
  template: {
    name: 'Poster wide filmstrip',
    description: 'An exhibition poster on white: a huge thin title across the top, two text columns with small language tags, a black film strip with two photo frames and sprocket holes, a huge date range at the foot and a small mark with the venue.',
    keyFields: WIDE_FILMSTRIP_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-wide-filmstrip', component: WIDE_FILMSTRIP_COMPONENT, code: wideFilmstripComponent(), props: WIDE_FILMSTRIP_PROPS, fonts: WIDE_FILMSTRIP_FONTS, varPrefix: WIDE_FILMSTRIP_VAR_PREFIX, vars: [], clip: WIDE_FILMSTRIP_CLIP }, WIDE_FILMSTRIP_GRAIN)
  }
};

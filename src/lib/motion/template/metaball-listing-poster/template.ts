import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { METABALL_LISTING_COMPONENT, METABALL_LISTING_FONTS, METABALL_LISTING_PROPS, METABALL_LISTING_VAR_PREFIX, metaballListingComponent } from './component';

export const METABALL_LISTING_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-metaball-listing`;
export const METABALL_LISTING_CLIP = 'poster';
export const METABALL_LISTING_KEY_FIELDS = ['events', 'words', 'blobs_color', 'marker', 'index'];
const METABALL_LISTING_GRAIN = 0.04;

export const METABALL_LISTING_POSTER_TEMPLATE: TemplateEntry = {
  id: METABALL_LISTING_TEMPLATE_ID,
  template: {
    name: 'Poster metaball listing',
    description: 'An event listing poster: a ruled grid of dated events in auto layout, pink metaball blobs with a halftone shadow, and huge black words split across the rows.',
    keyFields: METABALL_LISTING_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-metaball-listing', component: METABALL_LISTING_COMPONENT, code: metaballListingComponent(), props: METABALL_LISTING_PROPS, fonts: METABALL_LISTING_FONTS, varPrefix: METABALL_LISTING_VAR_PREFIX, vars: [], clip: METABALL_LISTING_CLIP }, METABALL_LISTING_GRAIN)
  }
};

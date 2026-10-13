import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { ISO_BLOCKS_COMPONENT, ISO_BLOCKS_FONTS, ISO_BLOCKS_PROPS, ISO_BLOCKS_VAR_PREFIX, isoBlocksComponent } from './component';

export const ISO_BLOCKS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-iso-blocks`;
export const ISO_BLOCKS_CLIP = 'poster';
export const ISO_BLOCKS_KEY_FIELDS = ['header', 'lineup', 'blocks', 'accent', 'block_font'];
const ISO_BLOCKS_GRAIN = 0.04;

export const ISO_BLOCKS_POSTER_TEMPLATE: TemplateEntry = {
  id: ISO_BLOCKS_TEMPLATE_ID,
  template: {
    name: 'Poster iso blocks',
    description: 'A club night poster on white: a big four-line header, big black isometric blocks stacked down the page with the line-up slanted on their faces, one top face in orange under a numbered circle.',
    keyFields: ISO_BLOCKS_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-iso-blocks', component: ISO_BLOCKS_COMPONENT, code: isoBlocksComponent(), props: ISO_BLOCKS_PROPS, fonts: ISO_BLOCKS_FONTS, varPrefix: ISO_BLOCKS_VAR_PREFIX, vars: [], clip: ISO_BLOCKS_CLIP }, ISO_BLOCKS_GRAIN)
  }
};

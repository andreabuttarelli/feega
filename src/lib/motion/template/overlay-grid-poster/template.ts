import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { OVERLAY_GRID_COMPONENT, OVERLAY_GRID_FONTS, OVERLAY_GRID_PROPS, OVERLAY_GRID_VAR_PREFIX, overlayGridComponent } from './component';

export const OVERLAY_GRID_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-overlay-grid`;
export const OVERLAY_GRID_CLIP = 'poster';
export const OVERLAY_GRID_KEY_FIELDS = ['head1', 'overlay', 'yellow', 'paper', 'font'];
const OVERLAY_GRID_GRAIN = 0.08;

export const OVERLAY_GRID_POSTER_TEMPLATE: TemplateEntry = {
  id: OVERLAY_GRID_TEMPLATE_ID,
  template: {
    name: 'Poster overlay grid',
    description: 'An exhibition poster on grey paper: black monospace text blocks on a grid with crop marks, and huge yellow repeating words running off the edges behind them.',
    keyFields: OVERLAY_GRID_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-overlay-grid', component: OVERLAY_GRID_COMPONENT, code: overlayGridComponent(), props: OVERLAY_GRID_PROPS, fonts: OVERLAY_GRID_FONTS, varPrefix: OVERLAY_GRID_VAR_PREFIX, vars: [], clip: OVERLAY_GRID_CLIP }, OVERLAY_GRID_GRAIN)
  }
};

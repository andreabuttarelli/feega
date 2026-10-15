import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { STEP_BLOBS_COMPONENT, STEP_BLOBS_FONTS, STEP_BLOBS_PROPS, STEP_BLOBS_VAR_PREFIX, stepBlobsComponent } from './component';

export const STEP_BLOBS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-step-blobs`;
export const STEP_BLOBS_CLIP = 'poster';
export const STEP_BLOBS_KEY_FIELDS = ['title', 'number', 'blobs', 'specs', 'marker'];
const STEP_BLOBS_GRAIN = 0.05;

export const STEP_BLOBS_POSTER_TEMPLATE: TemplateEntry = {
  id: STEP_BLOBS_TEMPLATE_ID,
  template: {
    name: 'Poster step blobs',
    description: 'A grey type poster on a thin grid: a huge thin staggered title and number, black rounded stepped shapes, spec lines, a contents list and small right-hand notes.',
    keyFields: STEP_BLOBS_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-step-blobs', component: STEP_BLOBS_COMPONENT, code: stepBlobsComponent(), props: STEP_BLOBS_PROPS, fonts: STEP_BLOBS_FONTS, varPrefix: STEP_BLOBS_VAR_PREFIX, vars: [], clip: STEP_BLOBS_CLIP }, STEP_BLOBS_GRAIN)
  }
};

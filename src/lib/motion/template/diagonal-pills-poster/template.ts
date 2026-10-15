import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { DIAGONAL_PILLS_COMPONENT, DIAGONAL_PILLS_FONTS, DIAGONAL_PILLS_PROPS, DIAGONAL_PILLS_VAR_PREFIX, diagonalPillsComponent } from './component';

export const DIAGONAL_PILLS_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-diagonal-pills`;
export const DIAGONAL_PILLS_CLIP = 'poster';
export const DIAGONAL_PILLS_KEY_FIELDS = ['title', 'pills', 'pills_color', 'marker', 'index'];
const DIAGONAL_PILLS_GRAIN = 0.04;

export const DIAGONAL_PILLS_POSTER_TEMPLATE: TemplateEntry = {
  id: DIAGONAL_PILLS_TEMPLATE_ID,
  template: {
    name: 'Poster diagonal pills',
    description: 'A black poster crossed by diagonal lilac pills with fading gradient tails, a word set along some pills, a big rotated two-line title and small corner lines.',
    keyFields: DIAGONAL_PILLS_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-diagonal-pills', component: DIAGONAL_PILLS_COMPONENT, code: diagonalPillsComponent(), props: DIAGONAL_PILLS_PROPS, fonts: DIAGONAL_PILLS_FONTS, varPrefix: DIAGONAL_PILLS_VAR_PREFIX, vars: [], clip: DIAGONAL_PILLS_CLIP }, DIAGONAL_PILLS_GRAIN)
  }
};

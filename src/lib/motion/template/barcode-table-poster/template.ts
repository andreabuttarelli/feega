import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { BARCODE_TABLE_COMPONENT, BARCODE_TABLE_FONTS, BARCODE_TABLE_PROPS, BARCODE_TABLE_VAR_PREFIX, barcodeTableComponent } from './component';

export const BARCODE_TABLE_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-barcode-table`;
export const BARCODE_TABLE_CLIP = 'poster';
export const BARCODE_TABLE_KEY_FIELDS = ['title_primary', 'title_secondary', 'event_lines', 'footer', 'counter'];
const BARCODE_TABLE_GRAIN = 0.02;

export const BARCODE_TABLE_POSTER_TEMPLATE: TemplateEntry = {
  id: BARCODE_TABLE_TEMPLATE_ID,
  template: {
    name: 'Poster barcode table',
    description: 'A white table grid with thin rules: a generated barcode column on the left, a primary and a secondary title on the right, event rows, a date and venue block, partner marks and an accent number cell.',
    keyFields: BARCODE_TABLE_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-barcode-table', component: BARCODE_TABLE_COMPONENT, code: barcodeTableComponent(), props: BARCODE_TABLE_PROPS, fonts: BARCODE_TABLE_FONTS, varPrefix: BARCODE_TABLE_VAR_PREFIX, vars: [], clip: BARCODE_TABLE_CLIP }, BARCODE_TABLE_GRAIN)
  }
};

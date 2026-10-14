import { BUILTIN_PREFIX } from '../design-kit';
import type { TemplateEntry } from '../library';
import { posterTemplateDoc } from '../poster-kit';
import { FLOW_QUOTE_COMPONENT, FLOW_QUOTE_FONTS, FLOW_QUOTE_PROPS, FLOW_QUOTE_VAR_PREFIX, flowQuoteComponent } from './component';

export const FLOW_QUOTE_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-flow-quote`;
export const FLOW_QUOTE_CLIP = 'poster';
export const FLOW_QUOTE_KEY_FIELDS = ['pills', 'marker', 'index', 'pills_color', 'connector_color'];
const FLOW_QUOTE_GRAIN = 0.02;

export const FLOW_QUOTE_POSTER_TEMPLATE: TemplateEntry = {
  id: FLOW_QUOTE_TEMPLATE_ID,
  template: {
    name: 'Poster flow quote',
    description: 'A black poster: a quote split across white pill labels, each connected to the next by a thick square-jointed white line, an author line of two pills, an accent circle and a small number pill.',
    keyFields: FLOW_QUOTE_KEY_FIELDS,
    doc: posterTemplateDoc({ name: 'poster-flow-quote', component: FLOW_QUOTE_COMPONENT, code: flowQuoteComponent(), props: FLOW_QUOTE_PROPS, fonts: FLOW_QUOTE_FONTS, varPrefix: FLOW_QUOTE_VAR_PREFIX, vars: [], clip: FLOW_QUOTE_CLIP }, FLOW_QUOTE_GRAIN)
  }
};

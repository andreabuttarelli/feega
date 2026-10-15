import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { PD_COMPONENT, PD_FONTS, PD_PROPS, PD_VAR_PREFIX, pdComponent } from './component';

export const PD_TEMPLATE_ID = `${BUILTIN_PREFIX}poster-deck-fan`;
export const PD_KEY_FIELDS = ['a_title', 'b_title', 'media', 'count', 'riffle_gap'];

const IN_GROUP: Record<string, readonly string[]> = {
  Deck: ['count', 'cardSize', 'fan', 'aColor', 'bColor', 'ink', 'paperColor', 'darkColor', 'accentColor', 'placeholderColor']
};

export const POSTER_DECK_FAN_TEMPLATE: TemplateEntry = {
  id: PD_TEMPLATE_ID,
  template: {
    name: 'Poster deck fan',
    description: 'A thick deck of square posters fans open in 3D, riffles through card by card, and the front poster turns to show a second design. Loops.',
    keyFields: PD_KEY_FIELDS,
    doc: customTemplateDoc({
      name: 'poster-deck-fan',
      component: PD_COMPONENT,
      code: pdComponent(),
      props: PD_PROPS,
      fonts: PD_FONTS,
      varPrefix: PD_VAR_PREFIX,
      vars: ['aTitle', 'bTitle', 'background', 'count', 'riffleGap'],
      clip: 'posterdeck',
      seconds: 12,
      fps: 30,
      groups: Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])))
    })
  }
};

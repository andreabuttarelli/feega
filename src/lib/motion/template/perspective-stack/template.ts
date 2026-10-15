import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { PS_COMPONENT, PS_FONTS, PS_PROPS, PS_VAR_PREFIX, psComponent } from './component';

export const PS_TEMPLATE_ID = `${BUILTIN_PREFIX}perspective-stack`;
export const PS_KEY_FIELDS = ['media', 'caption', 'count', 'colour_a'];

const IN_GROUP: Record<string, readonly string[]> = {
  Deck: ['chains', 'count', 'deckSize', 'spread', 'radius', 'productCard', 'colourA', 'colourB', 'colourC'],
  Liquid: ['floorTilt', 'floorBack', 'floorFront', 'liquidA', 'liquidB', 'liquidC']
};

export const PERSPECTIVE_STACK_TEMPLATE: TemplateEntry = {
  id: PS_TEMPLATE_ID,
  template: {
    name: 'Perspective card stack',
    description: 'Snakes of cards, your product leading each one, glide through 3D space card after card, over a dark card of moving liquid colour. Loops.',
    keyFields: PS_KEY_FIELDS,
    doc: customTemplateDoc({
      name: 'perspective-stack',
      component: PS_COMPONENT,
      code: psComponent(),
      props: PS_PROPS,
      fonts: PS_FONTS,
      varPrefix: PS_VAR_PREFIX,
      vars: ['caption', 'background', 'count', 'flip'],
      clip: 'deck',
      seconds: 15,
      fps: 30,
      groups: Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])))
    })
  }
};

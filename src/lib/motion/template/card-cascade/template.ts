import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { CC_COMPONENT, CC_FONTS, CC_PROPS, CC_VAR_PREFIX, ccComponent } from './component';

export const CC_TEMPLATE_ID = `${BUILTIN_PREFIX}card-cascade`;
export const CC_KEY_FIELDS = ['media', 'words', 'type_lines', 'count'];

const IN_GROUP: Record<string, readonly string[]> = {
  Cards: ['count', 'cardSize', 'spread', 'radius', 'typeColor', 'listColor', 'letterColor', 'tagColor', 'placeholderColor']
};

export const CARD_CASCADE_TEMPLATE: TemplateEntry = {
  id: CC_TEMPLATE_ID,
  template: {
    name: 'Diagonal card cascade',
    description: 'Rounded cards (pictures, a type card, a scrolling word list, a big letter) step along a diagonal one after another like a conveyor. Loops.',
    keyFields: CC_KEY_FIELDS,
    doc: customTemplateDoc({
      name: 'card-cascade',
      component: CC_COMPONENT,
      code: ccComponent(),
      props: CC_PROPS,
      fonts: CC_FONTS,
      varPrefix: CC_VAR_PREFIX,
      vars: ['background', 'count', 'stepSeconds', 'letter'],
      clip: 'cascade',
      seconds: 16,
      fps: 30,
      groups: Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])))
    })
  }
};

import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { FR_COMPONENT, FR_FONTS, FR_PROPS, FR_VAR_PREFIX, frComponent } from './component';

export const FR_TEMPLATE_ID = `${BUILTIN_PREFIX}framed-reveal`;
export const FR_KEY_FIELDS = ['media', 'label', 'count', 'reveal'];

const IN_GROUP: Record<string, readonly string[]> = {
  Frame: ['count', 'frameWidth', 'frameRatio', 'mono', 'backEmpty', 'frontEmpty']
};

export const FRAMED_REVEAL_TEMPLATE: TemplateEntry = {
  id: FR_TEMPLATE_ID,
  template: {
    name: 'Framed reveal',
    description: 'A colour picture in a frame over a full-bleed black and white one; the frame wipes, slides or scales to the next pair, with parallax and a slow push-in. Loops.',
    keyFields: FR_KEY_FIELDS,
    doc: customTemplateDoc({
      name: 'framed-reveal',
      component: FR_COMPONENT,
      code: frComponent(),
      props: FR_PROPS,
      fonts: FR_FONTS,
      varPrefix: FR_VAR_PREFIX,
      vars: ['label', 'background', 'count', 'reveal', 'change'],
      clip: 'framed',
      seconds: 12,
      fps: 30,
      groups: Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])))
    })
  }
};

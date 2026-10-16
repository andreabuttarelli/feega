import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { SS_COMPONENT, SS_FONTS, SS_PROPS, SS_VAR_PREFIX, ssComponent } from './component';

export const SS_TEMPLATE_ID = `${BUILTIN_PREFIX}showcase-scatter`;
export const SS_KEY_FIELDS = ['headline', 'media', 'meta', 'background'];

const IN_GROUP: Record<string, readonly string[]> = {
  Cards: ['count', 'cardSize', 'depth', 'blockColor', 'dotsColor', 'typeCardColor', 'placeholderColor']
};

export const SHOWCASE_SCATTER_TEMPLATE: TemplateEntry = {
  id: SS_TEMPLATE_ID,
  template: {
    name: 'Showcase scatter',
    description: 'Pictures, colour blocks and a type card enter one by one and drift at different depths around a centred headline; one picture glides across it. Loops.',
    keyFields: SS_KEY_FIELDS,
    doc: customTemplateDoc({
      name: 'showcase-scatter',
      component: SS_COMPONENT,
      code: ssComponent(),
      props: SS_PROPS,
      fonts: SS_FONTS,
      varPrefix: SS_VAR_PREFIX,
      vars: ['headline', 'background', 'count', 'drift'],
      clip: 'showcase',
      seconds: 12,
      fps: 30,
      groups: Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])))
    })
  }
};

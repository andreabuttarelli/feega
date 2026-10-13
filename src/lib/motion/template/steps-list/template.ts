import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { STEPS_COMPONENT, STEPS_FONTS, STEPS_PROPS, STEPS_VAR_PREFIX, stepsComponent } from './component';

export const STEPS_TEMPLATE_ID = `${BUILTIN_PREFIX}steps-list`;
export const STEPS_CLIP = 'steps';
export const STEPS_VARS = ['heading', 'steps', 'working', 'background', 'ink', 'pace'];

const IN_GROUP: Record<string, readonly string[]> = {
  Icons: ['accent1', 'accent2', 'accent3'],
  Motion: ['delay', 'pace']
};

const STEPS_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const STEPS_LIST_TEMPLATE: TemplateEntry = {
  id: STEPS_TEMPLATE_ID,
  template: {
    name: 'Steps list',
    description: 'An agent-style progress list: a heading, then steps with line icons that land one by one along a thin rail, the newest one highlighted, and a shimmering status label below.',
    keyFields: ['heading', 'steps', 'working', 'background', 'pace'],
    doc: customTemplateDoc({ name: 'steps-list', component: STEPS_COMPONENT, code: stepsComponent(), props: STEPS_PROPS, fonts: STEPS_FONTS, varPrefix: STEPS_VAR_PREFIX, vars: STEPS_VARS, clip: STEPS_CLIP, seconds: 12, fps: 30, groups: STEPS_GROUPS })
  }
};

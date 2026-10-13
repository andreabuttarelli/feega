import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { BLOBS_COMPONENT, BLOBS_FONTS, BLOBS_PROPS, BLOBS_VAR_PREFIX, blobsComponent } from './component';

export const BLOBS_TEMPLATE_ID = `${BUILTIN_PREFIX}iridescent-blobs`;
export const BLOBS_CLIP = 'blobs';
export const BLOBS_VARS = ['title', 'titleColor', 'background', 'body', 'sheen', 'rim', 'glow', 'bubbles', 'glitter', 'speed'];
export const BLOBS_KEY_FIELDS = ['title', 'body', 'rim', 'glow', 'bubbles'];

const IN_GROUP: Record<string, readonly string[]> = {
  Palette: ['background', 'body', 'sheen', 'rim', 'glow'],
  Matter: ['bubbles', 'glitter', 'mass', 'seed']
};

const BLOBS_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const IRIDESCENT_BLOBS_TEMPLATE: TemplateEntry = {
  id: BLOBS_TEMPLATE_ID,
  template: {
    name: 'Iridescent blobs',
    description: 'A soft, pearly fluid mass drifts on black, with a glowing rim, an inner glow, black bubbles and glitter. It loops seamlessly; an optional title enters on its own beat.',
    keyFields: BLOBS_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'iridescent-blobs', component: BLOBS_COMPONENT, code: blobsComponent(), props: BLOBS_PROPS, fonts: BLOBS_FONTS, varPrefix: BLOBS_VAR_PREFIX, vars: BLOBS_VARS, clip: BLOBS_CLIP, seconds: 12, fps: 30, groups: BLOBS_GROUPS })
  }
};

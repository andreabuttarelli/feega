import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { STRIP_COMPONENT, STRIP_FONTS, STRIP_PROPS, STRIP_VAR_PREFIX, stripComponent } from './component';

export const STRIP_TEMPLATE_ID = `${BUILTIN_PREFIX}photo-strip`;
export const STRIP_CLIP = 'strip';
export const STRIP_VARS = ['media', 'captions', 'background', 'captionColor', 'magnify', 'falloff', 'step', 'gesture', 'pause', 'direction', 'cursor'];

const IN_GROUP: Record<string, readonly string[]> = {
  Photos: ['media', 'captions', 'lowercase', 'count'],
  Motion: ['magnify', 'falloff', 'lift', 'step', 'gesture', 'pause', 'direction', 'captionLead'],
  Interaction: ['cursor', 'cursorColor']
};

const STRIP_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const PHOTO_STRIP_TEMPLATE: TemplateEntry = {
  id: STRIP_TEMPLATE_ID,
  template: {
    name: 'Photo strip',
    description: 'A strip of photos slides sideways in hand-like flicks; the one passing the middle grows large, as under a magnifier, then shrinks as it moves on.',
    doc: customTemplateDoc({ name: 'photo-strip', component: STRIP_COMPONENT, code: stripComponent(), props: STRIP_PROPS, fonts: STRIP_FONTS, varPrefix: STRIP_VAR_PREFIX, vars: STRIP_VARS, clip: STRIP_CLIP, seconds: 12, fps: 30, groups: STRIP_GROUPS })
  }
};

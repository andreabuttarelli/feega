import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { CHAT_COMPONENT, CHAT_FONTS, CHAT_PROPS, CHAT_VAR_PREFIX, chatComponent } from './component';

export const CHAT_TEMPLATE_ID = `${BUILTIN_PREFIX}phone-chat`;
export const CHAT_CLIP = 'chat';
export const CHAT_VARS = ['title', 'messages', 'clock', 'background', 'bubble', 'every', 'push', 'leave'];

const IN_GROUP: Record<string, readonly string[]> = {
  Device: ['finish', 'phoneSize', 'phoneTop', 'shadow', 'clock']
};

const CHAT_GROUPS = Object.fromEntries(Object.entries(IN_GROUP).flatMap(([group, keys]) => keys.map((key) => [key, group])));

export const PHONE_CHAT_TEMPLATE: TemplateEntry = {
  id: CHAT_TEMPLATE_ID,
  template: {
    name: 'Phone chat',
    keyFields: ['messages', 'title', 'avatars', 'background'],
    description: 'A close-up of a modern smartphone showing a group chat: each message types, then lands as a grey bubble with its name and avatar, while the camera slowly pushes in. Every part is a field or a runtime variable.',
    doc: customTemplateDoc({ name: 'phone-chat', component: CHAT_COMPONENT, code: chatComponent(), props: CHAT_PROPS, fonts: CHAT_FONTS, varPrefix: CHAT_VAR_PREFIX, vars: CHAT_VARS, clip: CHAT_CLIP, seconds: 9, fps: 30, groups: CHAT_GROUPS })
  }
};

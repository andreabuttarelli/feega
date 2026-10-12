import { BUILTIN_PREFIX } from '../design-kit';
import { customTemplateDoc } from '../custom-template';
import type { TemplateEntry } from '../library';
import { PROMPT_COMPONENT, PROMPT_FONTS, PROMPT_PROPS, PROMPT_VAR_PREFIX, promptComponent } from './component';

export const PROMPT_TEMPLATE_ID = `${BUILTIN_PREFIX}prompt-input`;
export const PROMPT_CLIP = 'prompt';
export const PROMPT_VARS = ['text', 'placeholder', 'chips', 'buttonLabel', 'accent', 'theme', 'speed', 'typo', 'camera', 'cameraZoom'];

const PROMPT_KEY_FIELDS = ['text', 'button_label', 'theme', 'accent'];

export const PROMPT_INPUT_TEMPLATE: TemplateEntry = {
  id: PROMPT_TEMPLATE_ID,
  template: {
    name: 'Prompt input',
    description: 'A prompt box types a request at a human pace, presses send and thinks.',
    keyFields: PROMPT_KEY_FIELDS,
    doc: customTemplateDoc({ name: 'prompt-input', component: PROMPT_COMPONENT, code: promptComponent(), props: PROMPT_PROPS, fonts: PROMPT_FONTS, varPrefix: PROMPT_VAR_PREFIX, vars: PROMPT_VARS, clip: PROMPT_CLIP, seconds: 9, fps: 30 })
  }
};

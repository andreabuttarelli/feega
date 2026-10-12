import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { PROMPT_MODEL } from './model';
import { PROMPT_VIEW } from './view';
import { PROMPT_CSS } from './style';

export const PROMPT_COMPONENT = 'PromptInput';
export const PROMPT_VAR_PREFIX = 'prompt';

export enum PromptTheme {
  Light = 'light',
  Dark = 'dark'
}

export enum PromptShape {
  Sharp = 'sharp',
  Rounded = 'rounded',
  Pill = 'pill'
}

export enum PromptSubmit {
  Thinking = 'thinking',
  Clear = 'clear',
  Hold = 'hold'
}

export enum PromptIcon {
  ArrowUp = 'arrow-up',
  ArrowRight = 'arrow-right',
  Send = 'send',
  Sparkle = 'sparkle'
}

export const PROMPT_FONTS = ['Inter', 'Geist', 'Inter Tight', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'IBM Plex Sans', 'Geist Mono', 'JetBrains Mono'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step?: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, ...(step ? { step } : {}) });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const choice = (title: string, options: readonly string[], value: string, group: PropSpec['group']): PropSpec => ({ type: 'string', title, enum: [...options], default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const PROMPT_PROPS: Record<string, PropSpec> = {
  text: text('Typed text', 'Make a 20 second launch film for our new app, with music.', { format: PropFormat.Textarea, maxLength: 400 }),
  placeholder: text('Placeholder', 'Ask anything…', { maxLength: 120 }),
  chips: text('Chips (comma separated, a file name shows a file)', '', { maxLength: 200 }),
  buttonLabel: text('Button label (empty: icon only)', '', { maxLength: 40 }),
  buttonIcon: choice('Button icon', Object.values(PromptIcon), PromptIcon.ArrowUp, 'Content'),
  thinkingLabel: text('Thinking label', 'Thinking', { maxLength: 60 }),
  startDelay: number('Start delay', 0.8, 0, 5, 'Motion', 0.1),
  speed: number('Typing speed (characters a second)', 15, 4, 40, 'Motion', 1),
  typo: flag('Typo and backspace', true, 'Motion'),
  typoAt: number('Where the typo falls', 0.4, 0, 1, 'Motion', 0.05),
  submit: choice('After sending', Object.values(PromptSubmit), PromptSubmit.Thinking, 'Motion'),
  repeat: flag('Loop', true, 'Motion'),
  cursor: flag('Cursor', true, 'Motion'),
  camera: flag('Camera follows the typing', true, 'Camera'),
  cameraZoom: number('Zoom on the text', 2.4, 1, 4, 'Camera', 0.1),
  buttonZoom: number('Zoom on the button', 3, 1, 5, 'Camera', 0.1),
  follow: number('Follow smoothing (seconds)', 0.7, 0.1, 2, 'Camera', 0.05),
  lead: number('Lead ahead of the caret (em)', 1.2, 0, 6, 'Camera', 0.1),
  theme: choice('Theme', Object.values(PromptTheme), PromptTheme.Light, 'Style'),
  accent: colour('Accent', '#0099ff'),
  background: colour('Background (transparent: the video shows through)', 'transparent'),
  fieldColor: colour('Field colour (transparent: from the theme)', 'transparent'),
  textColor: colour('Text colour (transparent: from the theme)', 'transparent'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  fontSize: number('Text size (% of the short side)', 3.8, 1.5, 8, 'Style', 0.1),
  fontWeight: number('Text weight', 400, 300, 700, 'Style', 100),
  shape: choice('Shape', Object.values(PromptShape), PromptShape.Sharp, 'Style'),
  radius: number('Corner radius when rounded (em)', 0.6, 0, 1.75, 'Style', 0.05),
  shadow: number('Shadow strength', 1, 0, 2, 'Style', 0.1),
  width: number('Width (em)', 22, 10, 60, 'Layout', 1),
  [VAR_PREFIX]: text('Runtime variable prefix', PROMPT_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function promptComponent(): CustomComponent {
  return {
    source: { html: '', css: PROMPT_CSS.trim(), js: `${PROMPT_MODEL.trim()}\n\n${PROMPT_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: PROMPT_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}

export const promptDefaults = (): Record<string, unknown> => Object.fromEntries(Object.entries(PROMPT_PROPS).map(([key, spec]) => [key, spec.default]));

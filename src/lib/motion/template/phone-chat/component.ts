import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { PhoneFinish } from '../phone-split/component';
import { CHAT_MODEL } from './model';
import { CHAT_VIEW } from './view';
import { CHAT_CSS } from './style';

export const CHAT_COMPONENT = 'PhoneChat';
export const CHAT_VAR_PREFIX = 'chat';

export const CHAT_FONTS = ['Inter', 'Inter Tight', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans'];

export const CHAT_MESSAGES = [
  "Noa | We've been talking about this trip since January",
  "Iris | Someone just pick a weekend, I'm not the mom of this group",
  'Teo | Not me, I organised the last one',
  'Juno | Oct 17 is the first weekend all of you are free',
  'Noa | Booked. The cabin is ours'
].join('\n');

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const CHAT_PROPS: Record<string, PropSpec> = {
  title: text('Group name', 'Cabin weekend 🏔️', { maxLength: 40 }),
  messages: text('Messages (one per line: name | text)', CHAT_MESSAGES, { format: PropFormat.Textarea, maxLength: 2000 }),
  avatars: text('Avatars, one per person (empty: initials)', '', { format: PropFormat.Media, maxLength: 2000 }),
  clock: text('Status bar time', '12:02', { maxLength: 8 }),
  finish: { type: 'string', title: 'Device colour', enum: Object.values(PhoneFinish), default: PhoneFinish.Natural, group: 'Style' },
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  background: colour('Background', '#f2f2f1'),
  screen: colour('Screen colour', '#f7f7f8'),
  bubble: colour('Bubble colour', '#e9e9eb'),
  ink: colour('Text colour', '#0a0a0a'),
  shadow: number('Shadow strength', 0.16, 0, 0.6, 'Style', 0.01),
  phoneSize: number('Phone size', 1, 0.5, 1.4, 'Layout', 0.01),
  phoneTop: number('Phone top (share of the frame height)', 0.05, -0.3, 0.4, 'Layout', 0.01),
  startAt: number('First message starts (seconds)', 0.6, 0, 4, 'Motion', 0.1),
  every: number('Seconds between messages', 1.4, 0.4, 4, 'Motion', 0.1),
  typingSeconds: number('Typing time per message (seconds)', 0.75, 0.2, 3, 'Motion', 0.05),
  push: number('Camera push-in', 0.08, 0, 0.3, 'Motion', 0.01),
  outSeconds: number('Loop out duration (seconds)', 1.2, 0.4, 3, 'Motion', 0.1),
  leave: { type: 'boolean', title: 'Loop: messages clear and the camera pulls back', default: true, group: 'Motion' },
  [VAR_PREFIX]: text('Runtime variable prefix', CHAT_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function chatComponent(): CustomComponent {
  return {
    source: { html: '', css: CHAT_CSS.trim(), js: `${CHAT_MODEL.trim()}\n\n${CHAT_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: CHAT_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}

import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { COMMENTS_MODEL } from './model';
import { COMMENTS_VIEW } from './view';
import { COMMENTS_CSS } from './style';

export const COMMENTS_COMPONENT = 'CommentGrid';
export const COMMENTS_VAR_PREFIX = 'comments';

export enum CommentsTheme {
  Light = 'light',
  Dark = 'dark',
  Custom = 'custom'
}

export enum CommentsDirection {
  Up = 'up',
  Down = 'down',
  Alternate = 'alternate'
}

export const COMMENTS_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const COMMENTS = [
  'Lena Marsh | @lenamakes | Set it up over coffee. By lunch the whole team was using it. | 5',
  'Omar Feld | @omarfeld | Finally a tool that gets out of the way. | 5',
  'Priya Venn | @priyav | The calmest app on my phone. I open it to think. | 5',
  'Jonas Ekl | @jonasekl | Replaced three subscriptions in a week. No regrets. | 5',
  'Ada Corin | @adacorin | It feels fast in a way I can’t explain. It just answers. | 5',
  'Milo Tran | @milotran | Our standups got shorter. Nobody complains. | 4',
  'Sofia Reyl | @sofiareyl | Beautiful defaults. I changed nothing and it looked right. | 5',
  'Ezra Hale | @ezrahale | Support replied in four minutes. On a Sunday. | 5',
  'Noor Asad | @noorasad | I came for one feature and stayed for everything else. | 5',
  'Felix Orm | @felixorm | The onboarding is the best I have seen this year. | 5',
  'Iris Pell | @irispell | Shipped our launch page in an afternoon. | 4',
  'Kai Morrow | @kaimorrow | Small details everywhere. Someone cared. | 5',
  'Yara Lund | @yaralund | My team stopped asking where things are. | 5',
  'Theo Brandt | @theobrandt | Simple on day one, deep on day ninety. | 5',
  'Mina Sato | @minasato | Worth it for the search alone. | 5',
  'Ruben Voss | @rubenvoss | We moved 40 projects over in a day. Zero drama. | 4',
  'Clara Juhl | @clarajuhl | It made our weekly review something we look forward to. | 5',
  'Leo Barrow | @leobarrow | Quietly the best tool we pay for. | 5'
].join('\n');

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const choice = (title: string, options: readonly string[], value: string, group: PropSpec['group']): PropSpec => ({ type: 'string', title, enum: [...options], default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const COMMENTS_PROPS: Record<string, PropSpec> = {
  title: text('Title', 'loved by thousands', { maxLength: 80 }),
  comments: text('Comments (Name | @handle | comment | stars, one per line)', COMMENTS, { format: PropFormat.Textarea, maxLength: 2000 }),
  avatars: text('Avatars', '', { format: PropFormat.Media, maxLength: 2000 }),
  lowercase: flag('Lowercase title', true, 'Content'),
  theme: choice('Theme', Object.values(CommentsTheme), CommentsTheme.Light, 'Style'),
  font: { type: 'string', title: 'Title font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  cardFont: { type: 'string', title: 'Card font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
  fontSize: number('Title size (% of the short side)', 12, 4, 24, 'Style', 0.5),
  fontWeight: number('Title weight', 600, 300, 800, 'Style', 100),
  tracking: number('Title tracking (em)', -0.05, -0.08, 0.05, 'Style', 0.005),
  accent: colour('Star colour', '#f5a524'),
  background: colour('Background (custom theme)', '#ecebe7'),
  cardColor: colour('Card colour (custom theme)', '#ffffff'),
  textColor: colour('Card text colour (custom theme)', '#0b0b0c'),
  titleColor: colour('Title colour (custom theme)', '#0a0a0a'),
  cardWidth: number('Card width (share of the short side)', 0.34, 0.18, 0.7, 'Layout', 0.01),
  gap: number('Gap (share of the short side)', 0.022, 0, 0.08, 'Layout', 0.002),
  radius: number('Card corner radius (share of the card width)', 0.04, 0, 0.12, 'Layout', 0.005),
  shadow: number('Card shadow', 0.35, 0, 1, 'Layout', 0.05),
  speed: number('Drift (frame heights per loop)', 0.8, 0, 3, 'Motion', 0.1),
  direction: choice('Drift direction', Object.values(CommentsDirection), CommentsDirection.Up, 'Motion'),
  gridDim: number('Dim the grid under the title', 0.5, 0, 0.9, 'Camera', 0.05),
  gridBlur: number('Blur the grid under the title (px)', 2, 0, 12, 'Camera', 0.5),
  enterAt: number('Grid starts (seconds)', 0, 0, 4, 'Motion', 0.1),
  enterSeconds: number('Card entrance (seconds)', 1.2, 0.4, 3, 'Motion', 0.1),
  stagger: number('Card stagger, centre to edge (seconds)', 1.4, 0, 3, 'Motion', 0.1),
  titleAt: number('Title starts (seconds)', 2.8, 0, 8, 'Motion', 0.1),
  leave: flag('Loop: everything leaves at the end', true, 'Motion'),
  [VAR_PREFIX]: text('Runtime variable prefix', COMMENTS_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function commentsComponent(): CustomComponent {
  return {
    source: { html: '', css: COMMENTS_CSS.trim(), js: `${COMMENTS_MODEL.trim()}\n\n${COMMENTS_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: COMMENTS_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}

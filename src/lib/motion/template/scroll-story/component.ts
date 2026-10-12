import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { STORY_MODEL } from './model';
import { STORY_VIEW } from './view';
import { STORY_CSS } from './style';

export const STORY_COMPONENT = 'ScrollStory';
export const STORY_VAR_PREFIX = 'story';

export enum SwapStyle {
  MaskUp = 'mask-up',
  MaskDown = 'mask-down',
  Fade = 'fade'
}

export const STORY_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'Space Grotesk', 'DM Sans', 'Instrument Serif'];

const PHOTO = (id: number) => `https://picsum.photos/id/${id}/1200/1500`;

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const lines = (title: string, value: string): PropSpec => text(title, value, { format: PropFormat.Textarea, maxLength: 200 });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const STORY_PROPS: Record<string, PropSpec> = {
  headline1: lines('Chapter 1 headline (one line per row)', 'start with\nthe land'),
  kicker1: text('Chapter 1 label', 'origin', { maxLength: 40 }),
  image1: text('Chapter 1 image (asset id or link)', PHOTO(1015), { maxLength: 500 }),
  headline2: lines('Chapter 2 headline (one line per row)', 'follow the\nlight in'),
  kicker2: text('Chapter 2 label', 'process', { maxLength: 40 }),
  image2: text('Chapter 2 image (asset id or link)', PHOTO(1039), { maxLength: 500 }),
  headline3: lines('Chapter 3 headline (one line per row)', 'and keep\ngoing'),
  kicker3: text('Chapter 3 label', 'arrival', { maxLength: 40 }),
  image3: text('Chapter 3 image (asset id or link)', PHOTO(1043), { maxLength: 500 }),
  lowercase: flag('Lowercase headlines', true, 'Content'),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  fontSize: number('Headline size (% of the short side)', 9, 3, 20, 'Style', 0.5),
  fontWeight: number('Headline weight', 600, 300, 800, 'Style', 100),
  tracking: number('Headline tracking (em)', -0.05, -0.08, 0.05, 'Style', 0.005),
  background: colour('Background', '#000000'),
  textColor: colour('Headline colour', '#ffffff'),
  labelColor: colour('Label colour', '#8a8a8a'),
  lineColor: colour('Grid line colour', '#ffffff'),
  lineOpacity: number('Grid line opacity', 0.14, 0, 1, 'Style', 0.01),
  showLabels: flag('Show labels and progress', true, 'Style'),
  columns: number('Grid columns', 12, 2, 24, 'Layout', 1),
  rows: number('Grid rows', 8, 2, 24, 'Layout', 1),
  margin: number('Grid margin (share of the short side)', 0.04, 0, 0.15, 'Layout', 0.005),
  imageSize: number('Image width (share of the short side)', 0.42, 0.15, 0.8, 'Layout', 0.01),
  imageRatio: number('Image height / width', 1.25, 0.5, 2, 'Layout', 0.05),
  lane1: number('Chapter 1 image column', 0, 0, 24, 'Layout', 1),
  lane2: number('Chapter 2 image column', 8, 0, 24, 'Layout', 1),
  lane3: number('Chapter 3 image column', 1, 0, 24, 'Layout', 1),
  speed1: number('Chapter 1 image speed', 0.8, 0.4, 3, 'Motion', 0.05),
  speed2: number('Chapter 2 image speed', 1.1, 0.4, 3, 'Motion', 0.05),
  speed3: number('Chapter 3 image speed', 0.95, 0.4, 3, 'Motion', 0.05),
  parallax: number('Inner image parallax', 0.06, 0, 0.2, 'Motion', 0.01),
  swapStyle: { type: 'string', title: 'Headline swap', enum: Object.values(SwapStyle), default: SwapStyle.MaskUp, group: 'Motion' },
  swapDuration: number('Line swap (seconds)', 0.9, 0.2, 2, 'Motion', 0.05),
  swapStagger: number('Line stagger (seconds)', 0.12, 0, 0.5, 'Motion', 0.01),
  swapOverlap: number('Next line follows after (share of a swap)', 0.35, 0, 1, 'Motion', 0.05),
  introAt: number('First headline starts (seconds)', 0.3, 0, 3, 'Motion', 0.1),
  [VAR_PREFIX]: text('Runtime variable prefix', STORY_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function storyComponent(): CustomComponent {
  return {
    source: { html: '', css: STORY_CSS.trim(), js: `${STORY_MODEL.trim()}\n\n${STORY_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: STORY_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}

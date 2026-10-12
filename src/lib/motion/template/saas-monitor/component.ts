import { ComponentMode, PropFormat, VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { MOCKUP_MODEL } from './model';
import { MOCKUP_VIEW } from './view';
import { MOCKUP_CSS } from './style';

export const MOCKUP_COMPONENT = 'SaasMonitor';
export const MOCKUP_VAR_PREFIX = 'mockup';

export enum ScreenSource {
  Site = 'site',
  Asset = 'asset'
}

export enum MonitorFinish {
  Black = 'black',
  Silver = 'silver'
}

export const MOCKUP_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Instrument Sans', 'Manrope', 'DM Sans', 'Space Grotesk'];

const text = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
const number = (title: string, value: number, minimum: number, maximum: number, group: PropSpec['group'], step: number): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
const flag = (title: string, value: boolean, group: PropSpec['group']): PropSpec => ({ type: 'boolean', title, default: value, group });
const choice = (title: string, options: readonly string[], value: string, group: PropSpec['group']): PropSpec => ({ type: 'string', title, enum: [...options], default: value, group });
const colour = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });

export const MOCKUP_PROPS: Record<string, PropSpec> = {
  watermark: text('Background word', 'Kairo Lab', { maxLength: 40 }),
  siteBrand: text('Site name', 'Kairo Lab', { maxLength: 40 }),
  navItems: text('Menu (comma separated)', 'Product, Solutions, Pricing, Docs', { maxLength: 120 }),
  badge: text('Badge above the headline', 'New · Kairo Agents 2.0', { maxLength: 60 }),
  headline: text('Headline', 'The AI workspace\nfor product teams', { format: PropFormat.Textarea, maxLength: 90 }),
  subtext: text('Supporting text', 'Turn research, specs and feedback into shipped features, in one calm place.', { maxLength: 160 }),
  primaryCta: text('Main button', 'Start for free', { maxLength: 30 }),
  secondaryCta: text('Second button', 'Book a demo', { maxLength: 30 }),
  productName: text('Product section title', 'Kairo Studio', { maxLength: 40 }),
  screenSource: choice('Screen shows', Object.values(ScreenSource), ScreenSource.Site, 'Content'),
  screenAsset: text('Screen asset (id or link; video:id for a video)', '', { maxLength: 400 }),
  font: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter Tight', group: 'Style' },
  accent: colour('Accent (product section, glow)', '#7c5cff'),
  backgroundFrom: colour('Background, light end', '#f3efff'),
  backgroundTo: colour('Background, violet end', '#a88bff'),
  watermarkColor: colour('Background word colour', '#ffffff'),
  watermarkOpacity: number('Background word opacity', 0.78, 0, 1, 'Style', 0.01),
  grain: number('Grain', 0.35, 0, 1, 'Style', 0.01),
  finish: choice('Monitor finish', Object.values(MonitorFinish), MonitorFinish.Black, 'Style'),
  depthBlur: number('Depth of field on the background word', 0.35, 0, 2, 'Style', 0.05),
  monitorSize: number('Monitor size (share of frame width)', 0.5, 0.3, 0.8, 'Layout', 0.01),
  monitorY: number('Monitor height (+ is lower)', -0.03, -0.2, 0.3, 'Layout', 0.01),
  watermarkSize: number('Background word size (% of frame height)', 44, 10, 80, 'Layout', 1),
  watermarkY: number('Background word height (+ is lower)', -0.17, -0.45, 0.3, 'Layout', 0.01),
  tiltYaw: number('Turn to the side (degrees)', -16, -40, 40, 'Camera', 1),
  tiltPitch: number('Tilt upward (degrees)', 7, -20, 25, 'Camera', 1),
  drift: number('Camera drift', 1, 0, 2, 'Camera', 0.05),
  enterAt: number('Monitor enters at (seconds)', 0, 0, 4, 'Motion', 0.1),
  enterSeconds: number('Entrance length (seconds)', 1.8, 0.6, 4, 'Motion', 0.1),
  typeSpeed: number('Headline typing (characters per second)', 24, 6, 80, 'Motion', 1),
  scroll: flag('Scroll to the product section', true, 'Motion'),
  scrollSeconds: number('Scroll length (seconds)', 1.8, 0.6, 4, 'Motion', 0.1),
  cursor: flag('Show the cursor on the button', true, 'Motion'),
  leave: flag('Loop: the monitor leaves at the end', true, 'Motion'),
  exitSeconds: number('Exit length (seconds)', 1.4, 0.6, 3, 'Motion', 0.1),
  [VAR_PREFIX]: text('Runtime variable prefix', MOCKUP_VAR_PREFIX, { group: 'Layout', maxLength: 20 })
};

export function mockupComponent(): CustomComponent {
  return {
    source: { html: '', css: MOCKUP_CSS.trim(), js: `${MOCKUP_MODEL.trim()}\n\n${MOCKUP_VIEW.trim()}` },
    propsSchema: { type: 'object', properties: MOCKUP_PROPS },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}

import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'bounce-in-headline',
  title: 'Bounce-in headline',
  about: 'A heavy headline fades in and drops with a damped bounce until it settles at the centre.',
  category: RendercompCategory.Text,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#111827',
  fonts: [],
  props: {
    headline: { type: 'string', title: 'Headline', default: 'Make It Bounce', group: 'Content', maxLength: 60 },
    background: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#111827', group: 'Style' },
    color: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#fbbf24', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    bounces: { type: 'number', title: 'Bounces', default: 3, minimum: 1, maximum: 10, step: 1, group: 'Motion' },
    height: { type: 'number', title: 'Bounce height (px)', default: 120, minimum: 0, maximum: 500, step: 5, group: 'Motion' },
    delay: { type: 'number', title: 'Delay (frames)', default: 8, minimum: 0, maximum: 60, step: 1, group: 'Motion' },
    duration: { type: 'number', title: 'Duration (frames)', default: 36, minimum: 1, maximum: 100, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const bounces = Number(p.bounces);
    const height = Number(p.height);
    const delay = Number(p.delay);
    const duration = Number(p.duration);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

    const text = S.h('div', { style: { fontFamily: S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif'), fontSize: 130, fontWeight: 900, color: String(p.color), letterSpacing: 6 } }, String(p.headline)) as HTMLElement;
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.background), alignItems: 'center', justifyContent: 'center' }, text));

    return (frame) => {
      const progress = S.interpolate(frame, [delay, delay + duration], [0, 1], clamped);
      const bounceY = progress >= 1 ? 0 : Math.abs(Math.sin(progress * Math.PI * bounces)) * height * (1 - progress);

      text.style.opacity = String(S.interpolate(progress, [0, 0.1], [0, 1], clamped));
      text.style.transform = `translateY(${-bounceY}px)`;
    };
  }
};

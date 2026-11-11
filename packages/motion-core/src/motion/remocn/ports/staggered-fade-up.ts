import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'staggered-fade-up',
  title: 'Staggered fade up',
  about: 'Words fade in and rise into place one after another along a single line.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Ship faster with feega', group: 'Content', maxLength: 120 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 400, maximum: 700, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    staggerDelay: { type: 'number', title: 'Stagger delay', default: 4, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    distance: { type: 'number', title: 'Distance', default: 20, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const stagger = Number(p.staggerDelay);
    const distance = Number(p.distance);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const WORD_FRAMES = 12;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

    const words = String(p.text).split(' ').map((word) => S.h('span', { style: { display: 'inline-block', marginRight: '0.25em' } }, word) as HTMLElement);
    const line = S.h('span', { style: { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.03em', fontFamily: face } }, words);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, line));

    return (at) => {
      const frame = at * speed;
      words.forEach((el, i) => {
        const local = frame - i * stagger;
        el.style.opacity = String(S.interpolate(local, [0, WORD_FRAMES], [0, 1], clamped));
        el.style.translate = `0 ${S.interpolate(local, [0, WORD_FRAMES], [distance, 0], clamped)}px`;
      });
    };
  }
};

import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'mask-reveal-up',
  title: 'Mask reveal up',
  about: 'Each line rises into place from a soft blur, holds, then lifts away and blurs out line by line.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    text: { type: 'string', title: 'Text (one line per row)', default: 'Designed to move.\nBuilt to focus.', group: 'Content', maxLength: 200 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 400, maximum: 700, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    distance: { type: 'number', title: 'Distance', default: 30, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const distance = Number(p.distance);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const ENTER_FRAMES = 23;
    const ENTER_TRAVEL = 11;
    const EXIT_FRAMES = 16;
    const EXIT_TRAVEL_FROM = 8;
    const EXIT_LIFT_PX = -22;
    const BLUR_PX = 6;
    const ENTER_STAGGER = 3;
    const EXIT_STAGGER = 2;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const enter = { ...clamped, easing: S.Easing.bezier(0.22, 1, 0.36, 1) };
    const exit = { ...clamped, easing: S.Easing.bezier(0.64, 0, 0.78, 0) };

    const lines = String(p.text).split('\n');
    const rows = lines.map((line) => S.h('div', { style: { transformOrigin: '50% 50%' } }, line) as HTMLElement);
    const block = S.h('div', { style: { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.03em', lineHeight: 1.1, textAlign: 'center', fontFamily: face } }, rows);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, block));

    const enterEnd = ENTER_FRAMES + (lines.length - 1) * ENTER_STAGGER;
    const exitStart = Math.max(enterEnd, view.frames - EXIT_FRAMES - (lines.length - 1) * EXIT_STAGGER);

    return (at) => {
      const frame = at * speed;
      rows.forEach((el, i) => {
        const inLocal = frame - i * ENTER_STAGGER;
        const outLocal = frame - exitStart - i * EXIT_STAGGER;
        const inP = S.interpolate(inLocal, [0, ENTER_FRAMES], [0, 1], enter);
        const outP = S.interpolate(outLocal, [0, EXIT_FRAMES], [0, 1], exit);
        const y = S.interpolate(inLocal, [0, ENTER_TRAVEL], [distance, 0], enter) + S.interpolate(outLocal, [EXIT_TRAVEL_FROM, EXIT_FRAMES], [0, EXIT_LIFT_PX], exit);
        const blur = S.interpolate(inLocal, [0, ENTER_FRAMES], [BLUR_PX, 0], enter) + S.interpolate(outLocal, [0, EXIT_FRAMES], [0, BLUR_PX], exit);

        el.style.opacity = String(inP * (1 - outP));
        el.style.translate = `0 ${y}px`;
        el.style.filter = `blur(${blur}px)`;
      });
    };
  }
};

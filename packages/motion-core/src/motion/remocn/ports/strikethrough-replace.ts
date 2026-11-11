import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'strikethrough-replace',
  title: 'Strikethrough replace',
  about: 'A line strikes through one phrase, which then fades out as the replacement fades in.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 120,
  background: '#ffffff',
  fonts: ['Geist'],
  props: {
    from: { type: 'string', title: 'From', default: '$49/mo', group: 'Content', maxLength: 60 },
    to: { type: 'string', title: 'To', default: 'Free', group: 'Content', maxLength: 60 },
    fontSize: { type: 'number', title: 'Font size (px)', default: 96, minimum: 12, maximum: 160, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 700, minimum: 400, maximum: 700, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#171717', group: 'Style' },
    lineColor: { type: 'string', title: 'Line colour', format: PropFormat.Color, default: '#ff5e3a', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const fontSize = Number(p.fontSize);
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const STRIKE_END = view.frames * 0.4;
    const FADE_END = view.frames * 0.6;
    const SLIDE_PX = 8;
    const MIN_LINE_PX = 2;
    const textStyle = { fontSize, fontWeight: Number(p.fontWeight), color: String(p.color), letterSpacing: '-0.03em', fontFamily: face, whiteSpace: 'nowrap' };

    const line = S.h('span', { style: { position: 'absolute', left: 0, top: '50%', height: Math.max(MIN_LINE_PX, Math.round(fontSize * 0.08)), width: '0%', background: String(p.lineColor), translate: '0 -50%', borderRadius: 2 } }) as HTMLElement;
    const before = S.h('span', { style: { ...textStyle, position: 'absolute' } }, String(p.from), line) as HTMLElement;
    const after = S.h('span', { style: textStyle }, String(p.to)) as HTMLElement;
    const stage = S.h('div', { style: { position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } }, before, after);
    view.root.replaceChildren(S.fill({ alignItems: 'center', justifyContent: 'center' }, stage));

    return (at) => {
      const frame = at * speed;
      line.style.width = `${S.interpolate(frame, [0, STRIKE_END], [0, 100], clamped)}%`;
      before.style.opacity = String(S.interpolate(frame, [STRIKE_END, FADE_END], [1, 0], clamped));
      after.style.opacity = String(S.interpolate(frame, [STRIKE_END, FADE_END], [0, 1], clamped));
      after.style.translate = `0 ${S.interpolate(frame, [STRIKE_END, FADE_END], [SLIDE_PX, 0], clamped)}px`;
    };
  }
};

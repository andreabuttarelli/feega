import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'iris-wipe',
  title: 'Iris wipe',
  about: 'A circular iris closes scene A to a small held dot, then opens on scene B from the same point.',
  category: SnapcnCategory.Transition,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 104,
  background: '#efe9dc',
  fonts: ['Geist'],
  props: {
    labelA: { type: 'string', title: 'Scene A text', default: 'Before', group: 'Content', maxLength: 60 },
    labelB: { type: 'string', title: 'Scene B text', default: 'After', group: 'Content', maxLength: 60 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    colorA: { type: 'string', title: 'Scene A colour', format: PropFormat.Color, default: '#efe9dc', group: 'Style' },
    colorB: { type: 'string', title: 'Scene B colour', format: PropFormat.Color, default: '#1b2a41', group: 'Style' },
    color: { type: 'string', title: 'Iris colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    centerX: { type: 'number', title: 'Center X', default: 0.5, minimum: 0, maximum: 1, step: 0.05, group: 'Motion' },
    centerY: { type: 'number', title: 'Center Y', default: 0.5, minimum: 0, maximum: 1, step: 0.05, group: 'Motion' },
    holdRadius: { type: 'number', title: 'Hold radius (%)', default: 12, minimum: 0, maximum: 40, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const hold = Number(p.holdRadius);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const HOLD_FRAMES = 70;
    const TRANSITION_FRAMES = 36;
    const START = HOLD_FRAMES - TRANSITION_FRAMES;
    const COVER = 150;
    const CUT = 0.5;
    const origin = `${Number(p.centerX) * 100}% ${Number(p.centerY) * 100}%`;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const openEase = S.Easing.bezier(0.45, 0, 0.75, 0.6);

    const scene = (text: string, bg: string, ink: string) =>
      S.fill(
        { alignItems: 'center', justifyContent: 'center', background: bg },
        S.h('span', { style: { fontFamily: face, fontSize: 96, fontWeight: 600, letterSpacing: '-0.03em', color: ink } }, text)
      ) as HTMLElement;
    const a = scene(String(p.labelA), String(p.colorA), '#171717');
    const b = scene(String(p.labelB), String(p.colorB), '#f2f2f2');
    const closing = S.fill({}, a) as HTMLElement;
    const exiting = S.fill({ background: String(p.color) }, closing) as HTMLElement;
    view.root.replaceChildren(exiting, b);

    return (frame) => {
      const t = S.interpolate(frame, [START, START + TRANSITION_FRAMES], [0, 1], clamp);
      const u = Math.min(1, t / CUT);
      const closeRadius = hold * (1 - u ** 3) + (COVER - hold) * (1 - u) ** 5;
      const openRadius = S.interpolate(t, [CUT, 1], [0, COVER], { ...clamp, easing: openEase });

      closing.style.clipPath = `circle(${closeRadius}% at ${origin})`;
      b.style.clipPath = `circle(${openRadius}% at ${origin})`;
    };
  }
};

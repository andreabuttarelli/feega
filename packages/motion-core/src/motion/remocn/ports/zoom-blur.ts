import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'zoom-blur',
  title: 'Zoom blur',
  about: 'Scene A zooms in and blurs out while scene B scales up from slightly small and sharpens into focus.',
  category: SnapcnCategory.Transition,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 114,
  background: '#141318',
  fonts: ['Geist'],
  props: {
    labelA: { type: 'string', title: 'Scene A text', default: 'Scene A', group: 'Content', maxLength: 60 },
    labelB: { type: 'string', title: 'Scene B text', default: 'Zoom Blur', group: 'Content', maxLength: 60 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    colorA: { type: 'string', title: 'Scene A colour', format: PropFormat.Color, default: '#141318', group: 'Style' },
    colorB: { type: 'string', title: 'Scene B colour', format: PropFormat.Color, default: '#1a1922', group: 'Style' },
    blur: { type: 'number', title: 'Blur (px)', default: 16, minimum: 0, maximum: 40, step: 2, group: 'Motion' },
    rise: { type: 'number', title: 'Rise (px)', default: 0, minimum: 0, maximum: 160, step: 10, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const blur = Number(p.blur);
    const rise = Number(p.rise);
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const HOLD_FRAMES = 70;
    const TRANSITION_FRAMES = 18;
    const START = HOLD_FRAMES - TRANSITION_FRAMES;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

    const scene = (text: string, bg: string) =>
      S.fill(
        { alignItems: 'center', justifyContent: 'center', background: bg },
        S.h('span', { style: { fontFamily: face, fontSize: 96, fontWeight: 600, letterSpacing: '-0.03em', color: '#f2f2f2' } }, text)
      ) as HTMLElement;
    const a = scene(String(p.labelA), String(p.colorA));
    const b = scene(String(p.labelB), String(p.colorB));
    view.root.replaceChildren(a, b);

    return (frame) => {
      const t = S.interpolate(frame, [START, START + TRANSITION_FRAMES], [0, 1], clamp);

      a.style.opacity = String(1 - t);
      a.style.transform = `scale(${1 + t * 0.12})${rise > 0 ? ` translateY(${-t * rise}px)` : ''}`;
      a.style.filter = t > 0 ? `blur(${t * blur}px)` : 'none';

      b.style.opacity = String(t);
      b.style.transform = `scale(${0.9 + t * 0.1})${rise > 0 ? ` translateY(${(1 - t) * rise}px)` : ''}`;
      b.style.filter = t < 1 ? `blur(${(1 - t) * blur}px)` : 'none';
    };
  }
};

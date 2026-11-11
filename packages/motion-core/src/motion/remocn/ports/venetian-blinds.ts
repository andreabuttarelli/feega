import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'venetian-blinds',
  title: 'Venetian blinds',
  about: 'Horizontal slats of scene A rotate edge-on one after another, revealing scene B settling in behind.',
  category: SnapcnCategory.Transition,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 114,
  background: '#0a0a0a',
  fonts: ['Geist'],
  props: {
    labelA: { type: 'string', title: 'Scene A text', default: 'Scene A', group: 'Content', maxLength: 60 },
    labelB: { type: 'string', title: 'Scene B text', default: 'Scene B', group: 'Content', maxLength: 60 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    colorA: { type: 'string', title: 'Scene A colour', format: PropFormat.Color, default: '#efe9dc', group: 'Style' },
    colorB: { type: 'string', title: 'Scene B colour', format: PropFormat.Color, default: '#1b2a41', group: 'Style' },
    shadeColor: { type: 'string', title: 'Shade colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    slats: { type: 'number', title: 'Slats', default: 12, minimum: 2, maximum: 32, step: 1, group: 'Motion' },
    stagger: { type: 'number', title: 'Stagger', default: 0.55, minimum: 0, maximum: 0.9, step: 0.05, group: 'Motion' },
    direction: { type: 'string', title: 'Direction', enum: ['top-down', 'bottom-up', 'center'], default: 'top-down', group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const face = S.pick(p.fontFamily, 'Geist, -apple-system, BlinkMacSystemFont, sans-serif');
    const HOLD_FRAMES = 70;
    const TRANSITION_FRAMES = 26;
    const START = HOLD_FRAMES - TRANSITION_FRAMES;
    const FADE_FROM_DEG = 76;
    const FADE_TO_DEG = 88;
    const SHADE_MAX = 0.75;
    const count = Math.max(1, Math.round(Number(p.slats)));
    const spread = Math.min(0.9, Math.max(0, Number(p.stagger)));
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const turnEase = S.Easing.bezier(0.55, 0, 0.35, 1);
    const settleEase = S.Easing.out(S.Easing.cubic);

    const delayOf = (i: number) => {
      if (count <= 1) {
        return 0;
      }
      const t = i / (count - 1);
      if (p.direction === 'bottom-up') {
        return 1 - t;
      }
      if (p.direction === 'center') {
        return Math.abs(t - 0.5) * 2;
      }
      return t;
    };

    const scene = (text: string, bg: string, ink: string) =>
      S.fill(
        { alignItems: 'center', justifyContent: 'center', background: bg },
        S.h('span', { style: { fontFamily: face, fontSize: 96, fontWeight: 600, letterSpacing: '-0.03em', color: ink } }, text)
      ) as HTMLElement;
    const b = scene(String(p.labelB), String(p.colorB), '#f2f2f2');
    const stage = S.fill({ zIndex: 2, perspective: `${height * 2.2}px`, perspectiveOrigin: '50% 50%' }) as HTMLElement;

    const slats = Array.from({ length: count }, (_, i) => {
      const top = Math.floor((i * height) / count);
      const bottom = Math.floor(((i + 1) * height) / count);
      const shade = S.h('div', { style: { position: 'absolute', inset: 0, backgroundColor: String(p.shadeColor), opacity: 0 } }) as HTMLElement;
      const inner = S.h('div', { style: { position: 'absolute', left: 0, top: -top, width, height } }, scene(String(p.labelA), String(p.colorA), '#171717'));
      const el = S.h(
        'div',
        { style: { position: 'absolute', left: 0, top, width, height: bottom - top + (i < count - 1 ? 1 : 0), overflow: 'hidden', transformOrigin: '50% 50%', backfaceVisibility: 'hidden' } },
        inner,
        shade
      ) as HTMLElement;
      stage.appendChild(el);
      return { el, shade, start: delayOf(i) * spread };
    });
    view.root.replaceChildren(b, stage);

    return (frame) => {
      const t = S.interpolate(frame, [START, START + TRANSITION_FRAMES], [0, 1], clamp);
      b.style.transform = `scale(${S.interpolate(t, [0, 1], [1.06, 1], { ...clamp, easing: settleEase })})`;

      slats.forEach((slat) => {
        const local = turnEase(S.interpolate(t, [slat.start, slat.start + 1 - spread], [0, 1], clamp));
        const angle = local * 90;
        const fade = S.interpolate(angle, [FADE_FROM_DEG, FADE_TO_DEG], [1, 0], clamp);

        slat.el.style.display = fade <= 0 ? 'none' : 'block';
        slat.el.style.transform = `rotateX(${angle}deg)`;
        slat.el.style.opacity = String(fade);
        slat.shade.style.opacity = String(Math.sin((angle * Math.PI) / 180) * SHADE_MAX);
      });
    };
  }
};

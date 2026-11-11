import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'flip-page-transition',
  title: 'Page flip transition',
  about: 'The first page pivots on its left edge like a book page and peels away in 3D, revealing the second page underneath.',
  category: RendercompCategory.Transition,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#283618',
  fonts: [],
  props: {
    labelBefore: { type: 'string', title: 'Before label', default: 'Before', group: 'Content', maxLength: 30 },
    labelAfter: { type: 'string', title: 'After label', default: 'After', group: 'Content', maxLength: 30 },
    colorBefore: { type: 'string', title: 'Before colour', format: PropFormat.Color, default: '#fefae0', group: 'Style' },
    colorAfter: { type: 'string', title: 'After colour', format: PropFormat.Color, default: '#283618', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#283618', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const SCENE_EASING = S.Easing.inOut(S.Easing.ease);
    const FLIP_DELAY = 30;
    const FLIP_DURATION = 45;
    const PRE_LIFT_FRAMES = 16;
    const colorAfter = String(p.colorAfter);
    const afterTextColor = colorAfter === '#283618' || colorAfter === '#1a1a1a' ? '#fefae0' : String(p.textColor);

    const page = (bg: string, label: string, color: string) =>
      S.fill({ backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        S.h('div', { style: { fontFamily: face, fontSize: 180, fontWeight: 800, letterSpacing: 6, color, textShadow: '0 4px 24px rgba(0,0,0,0.15)' } }, label)
      );

    const afterScene = S.fill({}, page(colorAfter, String(p.labelAfter), afterTextColor)) as HTMLElement;
    const castShadow = S.fill({ pointerEvents: 'none' }) as HTMLElement;
    const shade = S.fill({ pointerEvents: 'none' }) as HTMLElement;
    const turning = S.fill({ transformOrigin: 'left center', backfaceVisibility: 'hidden' }, page(String(p.colorBefore), String(p.labelBefore), String(p.textColor)), shade) as HTMLElement;
    const stage = S.fill({ perspective: '1600px', perspectiveOrigin: '50% 50%' }, turning);
    view.root.replaceChildren(S.fill({ backgroundColor: colorAfter }, afterScene, castShadow, stage));

    return (frame) => {
      const progress = S.interpolate(frame, [Math.max(0, FLIP_DELAY - PRE_LIFT_FRAMES), FLIP_DELAY, FLIP_DELAY + FLIP_DURATION], [0, 0.045, 1], { ...clamped, easing: SCENE_EASING });
      const rotateY = 90 * progress;
      const absAngle = Math.abs(rotateY);

      turning.style.transform = `rotateY(${rotateY}deg)`;
      turning.style.opacity = String(S.interpolate(absAngle, [0, 72, 86, 90], [1, 1, 0.35, 0], clamped));
      shade.style.background = `linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,${S.interpolate(absAngle, [0, 90], [0.02, 0.5], clamped).toFixed(3)}) 100%)`;

      const shadowAlpha = S.interpolate(progress, [0, 0.15, 0.6, 1], [0, 0.34, 0.2, 0], clamped);
      const shadowSpread = S.interpolate(progress, [0, 1], [18, 62], clamped);
      castShadow.style.background = `linear-gradient(90deg, rgba(0,0,0,${shadowAlpha.toFixed(3)}) 0%, rgba(0,0,0,0) ${shadowSpread.toFixed(1)}%)`;

      const settle = S.interpolate(frame, [FLIP_DELAY + FLIP_DURATION * 0.4, view.frames - 12], [1.035, 1], { ...clamped, easing: S.Easing.out(S.Easing.cubic) });
      afterScene.style.transform = `scale(${settle.toFixed(4)})`;
    };
  }
};

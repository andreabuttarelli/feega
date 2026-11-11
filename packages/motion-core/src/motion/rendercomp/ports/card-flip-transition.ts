import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'card-flip-transition',
  title: 'Card flip transition',
  about: 'The whole screen turns like a card around its vertical axis, swapping the front scene for the back one at the halfway point.',
  category: RendercompCategory.Transition,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#14141f',
  fonts: [],
  props: {
    labelBefore: { type: 'string', title: 'Front label', default: 'Before', group: 'Content', maxLength: 30 },
    labelAfter: { type: 'string', title: 'Back label', default: 'After', group: 'Content', maxLength: 30 },
    colorBefore: { type: 'string', title: 'Front colour', format: PropFormat.Color, default: '#22223b', group: 'Style' },
    colorAfter: { type: 'string', title: 'Back colour', format: PropFormat.Color, default: '#9a8c98', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    backdropColor: { type: 'string', title: 'Backdrop colour', format: PropFormat.Color, default: '#14141f', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const FLIP_START = 30;
    const FLIP_END = 75;

    const faceOf = (bg: string, label: string, rotateY: number) =>
      S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden', transform: `rotateY(${rotateY}deg)` } },
        S.h('div', { style: { fontFamily: face, fontSize: 180, fontWeight: 800, letterSpacing: 6, color: String(p.textColor), textShadow: '0 4px 24px rgba(0,0,0,0.35)' } }, label)
      );

    const wash = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 45%, transparent 70%)' } });
    const shadow = S.h('div', { style: { position: 'absolute', left: '50%', top: '76%', width: '78%', height: '16%', marginLeft: '-39%', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, transparent 72%)', filter: 'blur(18px)' } }) as HTMLElement;
    const card = S.h('div', { style: { position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d' } }, faceOf(String(p.colorBefore), String(p.labelBefore), 0), faceOf(String(p.colorAfter), String(p.labelAfter), 180)) as HTMLElement;
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backdropColor), perspective: '2200px', alignItems: 'center', justifyContent: 'center' }, wash, shadow, card));

    return (frame) => {
      const rotateY = S.interpolate(frame, [FLIP_START, FLIP_END], [0, 180], { ...clamped, easing: S.Easing.inOut(S.Easing.ease) });
      const faceOn = Math.abs(Math.cos((rotateY * Math.PI) / 180));
      shadow.style.transform = `scaleX(${0.25 + faceOn * 0.75})`;
      shadow.style.opacity = String(0.5 + faceOn * 0.35);
      card.style.transform = `rotateY(${rotateY}deg)`;
    };
  }
};

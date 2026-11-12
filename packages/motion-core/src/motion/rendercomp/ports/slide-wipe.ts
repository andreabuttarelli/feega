import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'slide-wipe',
  title: 'Slide wipe',
  about: 'The first page slides off to the left while the second slides in from the right, the two abutting edge to edge.',
  category: RendercompCategory.Transition,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0a1626',
  fonts: [],
  props: {
    labelBefore: { type: 'string', title: 'Before label', default: 'Before', group: 'Content', maxLength: 30 },
    labelAfter: { type: 'string', title: 'After label', default: 'After', group: 'Content', maxLength: 30 },
    colorBefore: { type: 'string', title: 'Before colour', format: PropFormat.Color, default: '#0d4f8b', group: 'Style' },
    colorAfter: { type: 'string', title: 'After colour', format: PropFormat.Color, default: '#ffb703', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    backdropColor: { type: 'string', title: 'Backdrop colour', format: PropFormat.Color, default: '#0a1626', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const DELAY = 30;
    const TRANSITION = 45;

    const page = (bg: string, label: string) =>
      S.fill({ backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        S.h('div', { style: { fontFamily: face, fontSize: view.height * 0.166, fontWeight: 800, letterSpacing: 6, color: String(p.textColor), textShadow: '0 4px 24px rgba(0,0,0,0.35)' } }, label)
      ) as HTMLElement;

    const before = page(String(p.colorBefore), String(p.labelBefore));
    const after = page(String(p.colorAfter), String(p.labelAfter));
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backdropColor), overflow: 'hidden' }, before, after));

    return (frame) => {
      const progress = S.interpolate(frame, [DELAY, DELAY + TRANSITION], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: S.Easing.inOut(S.Easing.ease) });
      before.style.transform = `translateX(${-progress * 100}%)`;
      after.style.transform = `translateX(${(1 - progress) * 100}%)`;
    };
  }
};

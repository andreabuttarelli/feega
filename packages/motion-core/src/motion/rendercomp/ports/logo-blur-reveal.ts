import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'logo-blur-reveal',
  title: 'Logo blur reveal',
  about: 'A wordmark resolves from a heavy out-of-focus blur to a crisp logo with a subtle lens-focus scale, then fades out.',
  category: RendercompCategory.Logo,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#F8FAFC',
  fonts: [],
  props: {
    logoText: { type: 'string', title: 'Logo text', default: 'HELLO', group: 'Content', maxLength: 30 },
    blurAmount: { type: 'number', title: 'Start blur (px)', default: 40, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    revealDuration: { type: 'number', title: 'Reveal (seconds)', default: 1.6, minimum: 0.1, maximum: 4, step: 0.1, group: 'Motion' },
    duration: { type: 'number', title: 'Total (seconds)', default: 4, minimum: 1, maximum: 4, step: 0.1, group: 'Motion' },
    logoColor: { type: 'string', title: 'Logo colour', format: PropFormat.Color, default: '#0F172A', group: 'Style' },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#F8FAFC', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 260, minimum: 40, maximum: 500, step: 1, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const fps = 30;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const blurAmount = Number(p.blurAmount);
    const totalFrames = Math.max(1, Math.floor(Number(p.duration) * fps));
    const revealFrames = Math.max(1, Math.floor(Number(p.revealDuration) * fps));
    const fadeOutStart = totalFrames - Math.floor(fps * 0.4);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const CUBIC_OUT = S.Easing.out(S.Easing.cubic);

    const logo = S.h('div', { style: { fontFamily: face, fontSize: Number(p.fontSize), fontWeight: 900, color: String(p.logoColor), letterSpacing: '0.06em', lineHeight: 1, userSelect: 'none' } }, String(p.logoText)) as HTMLElement;
    const stage = S.fill({ alignItems: 'center', justifyContent: 'center', background: String(p.backgroundColor) }, logo) as HTMLElement;
    view.root.replaceChildren(stage);

    return (frame) => {
      const progress = S.interpolate(frame, [0, revealFrames], [0, 1], { ...clamped, easing: CUBIC_OUT });

      logo.style.opacity = String(progress);
      logo.style.filter = `blur(${(1 - progress) * blurAmount}px)`;
      logo.style.transform = `scale(${S.interpolate(progress, [0, 1], [1.08, 1])})`;
      stage.style.opacity = String(S.interpolate(frame, [fadeOutStart, totalFrames], [1, 0], clamped));
    };
  }
};

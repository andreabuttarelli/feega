import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'logo-bounce-drop',
  title: 'Logo bounce drop',
  about: 'The logo drops in from above, bounces on landing with a slight squash, then fades out.',
  category: RendercompCategory.Logo,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#F8FAFC',
  fonts: [],
  props: {
    logoText: { type: 'string', title: 'Logo text', default: 'FEEGA', group: 'Content', maxLength: 30 },
    svgPath: { type: 'string', title: 'SVG path (|| separated, empty = text)', default: '', group: 'Content', maxLength: 2000 },
    viewBox: { type: 'string', title: 'SVG viewBox', default: '0 0 300 300', group: 'Content', maxLength: 40 },
    dropHeight: { type: 'number', title: 'Drop height (screens)', default: 0.6, minimum: 0.1, maximum: 2, step: 0.05, group: 'Motion' },
    bounceStrength: { type: 'number', title: 'Bounce strength', default: 4, minimum: 1, maximum: 10, step: 0.5, group: 'Motion' },
    duration: { type: 'number', title: 'Total (seconds)', default: 3, minimum: 1, maximum: 3, step: 0.1, group: 'Motion' },
    logoColor: { type: 'string', title: 'Logo colour', format: PropFormat.Color, default: '#0F172A', group: 'Style' },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#F8FAFC', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 240, minimum: 40, maximum: 500, step: 1, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const fps = 30;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const logoColor = String(p.logoColor);
    const totalFrames = Math.max(1, Math.floor(Number(p.duration) * fps));
    const damping = Math.max(4, Math.min(20, 4 + Number(p.bounceStrength) * 1.5));
    const startY = -Number(p.dropHeight) * view.height;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const paths = String(p.svgPath).split(/\s*\|\|\s*/).map((d) => d.trim()).filter((d) => d.length > 0);

    const content = paths.length > 0
      ? S.h('svg', { viewBox: String(p.viewBox), style: { width: 400, height: 400 } }, paths.map((d) => S.h('path', { d, fill: logoColor })))
      : S.h('div', { style: { fontFamily: face, fontSize: Number(p.fontSize), fontWeight: 900, color: logoColor, letterSpacing: '0.04em', lineHeight: 1, userSelect: 'none' } }, String(p.logoText));
    const holder = S.h('div', { style: { transformOrigin: 'center bottom', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, content) as HTMLElement;
    const stage = S.fill({ alignItems: 'center', justifyContent: 'center', background: String(p.backgroundColor) }, holder) as HTMLElement;
    view.root.replaceChildren(stage);

    return (frame) => {
      const progress = S.spring({ frame, fps, config: { damping, mass: 1, stiffness: 80 } });
      const y = S.interpolate(progress, [0, 1], [startY, 0]);
      const squash = S.interpolate(progress, [0.85, 1], [0, 1], clamped);
      const scaleY = 1 - 0.06 * Math.sin(squash * Math.PI);
      const scaleX = 1 + 0.04 * Math.sin(squash * Math.PI);

      holder.style.transform = `translateY(${y}px) scale(${scaleX}, ${scaleY})`;
      stage.style.opacity = String(S.interpolate(frame, [totalFrames - Math.floor(fps * 0.5), totalFrames], [1, 0], clamped));
    };
  }
};

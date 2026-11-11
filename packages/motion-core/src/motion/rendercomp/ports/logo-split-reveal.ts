import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'logo-split-reveal',
  title: 'Logo split reveal',
  about: 'The wordmark is cut in two halves that slide in from opposite sides and meet at the centre with a brief seam flash, then the tracking settles.',
  category: RendercompCategory.Logo,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#F8FAFC',
  fonts: [],
  props: {
    logoText: { type: 'string', title: 'Logo text', default: 'FEEGA', group: 'Content', maxLength: 30 },
    splitOffset: { type: 'number', title: 'Split offset (px)', default: 960, minimum: 0, maximum: 2000, step: 10, group: 'Motion' },
    revealDuration: { type: 'number', title: 'Reveal (seconds)', default: 1.4, minimum: 0.1, maximum: 4, step: 0.1, group: 'Motion' },
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
    const logoColor = String(p.logoColor);
    const logoText = String(p.logoText);
    const splitOffset = Number(p.splitOffset);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const CUBIC_OUT = S.Easing.out(S.Easing.cubic);
    const totalFrames = Math.max(1, Math.floor(Number(p.duration) * fps));
    const revealFrames = Math.max(1, Math.floor(Number(p.revealDuration) * fps));
    const safeWidth = view.width * 0.86;
    const estimatedWidth = Math.max(1, logoText.length * Number(p.fontSize) * 0.74);
    const safeFontSize = Number(p.fontSize) * Math.min(1, safeWidth / estimatedWidth);
    const settleStart = revealFrames;
    const settleEnd = Math.max(settleStart + 1, totalFrames - Math.floor(fps * 0.3));

    const half = (clipPath: string) => S.h('div', { style: { fontFamily: face, fontSize: safeFontSize, fontWeight: 900, color: logoColor, lineHeight: 1, userSelect: 'none', position: 'absolute', top: '50%', left: '50%', whiteSpace: 'nowrap', clipPath } }, logoText) as HTMLElement;
    const left = half('inset(0 50% 0 0)');
    const right = half('inset(0 0 0 50%)');
    const seam = S.h('div', { style: { position: 'absolute', top: '50%', left: '50%', width: Math.max(2, safeFontSize * 0.012), transform: 'translate(-50%, -50%)', backgroundColor: logoColor } }) as HTMLElement;

    view.root.replaceChildren(S.fill({ background: String(p.backgroundColor), overflow: 'hidden' }, left, right, seam));

    return (frame) => {
      const progress = S.interpolate(frame, [0, revealFrames], [0, 1], { ...clamped, easing: CUBIC_OUT });
      const leftX = S.interpolate(progress, [0, 1], [-splitOffset, 0]);
      const rightX = S.interpolate(progress, [0, 1], [splitOffset, 0]);
      const opacity = S.interpolate(progress, [0, 0.4], [0.22, 1], { extrapolateRight: 'clamp' });
      const tracking = S.interpolate(frame, [settleStart, settleEnd], [0.085, 0.06], { ...clamped, easing: CUBIC_OUT });
      const seamOpacity = S.interpolate(progress, [0.72, 0.94, 1], [0, 0.85, 0], clamped);
      const seamHeight = S.interpolate(progress, [0.72, 1], [1.35, 0.75], clamped);

      left.style.transform = `translate(calc(-50% + ${leftX}px), -50%)`;
      right.style.transform = `translate(calc(-50% + ${rightX}px), -50%)`;
      [left, right].forEach((el) => {
        el.style.opacity = String(opacity);
        el.style.letterSpacing = `${tracking.toFixed(4)}em`;
      });
      seam.style.height = `${safeFontSize * seamHeight}px`;
      seam.style.opacity = String(seamOpacity);
    };
  }
};

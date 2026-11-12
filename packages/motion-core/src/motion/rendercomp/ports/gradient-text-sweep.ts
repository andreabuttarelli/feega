import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'gradient-text-sweep',
  title: 'Gradient text sweep',
  about: 'A bold headline springs in while an accent-coloured highlight sweeps across the letters on a loop, with an underline and a spaced subline.',
  category: RendercompCategory.Text,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 110,
  background: '#050818',
  fonts: [],
  props: {
    headline: { type: 'string', title: 'Headline', default: 'BUILD BOLD', group: 'Content', maxLength: 40 },
    subline: { type: 'string', title: 'Subline', default: 'ACME INC.', group: 'Content', maxLength: 60 },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#050818', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#22d3ee', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#ecfeff', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { height } = view;
    const fps = 30;
    const totalFrames = 110;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const accent = String(p.accentColor);
    const textColor = String(p.textColor);
    const title = String(p.headline || 'BUILD BOLD').toUpperCase();
    const sub = String(p.subline || '').toUpperCase();
    const baseFont = Math.round(height * 0.155);
    const lenAdj = Math.min(1, 14 / Math.max(title.length, 1));
    const fontSize = Math.round(baseFont * (0.7 + 0.3 * lenAdj));
    const subFontSize = Math.round(fontSize * 0.2);
    const underlineW = Math.round(fontSize * 3.2);
    const sweepStart = 14;
    const sweepPeriod = 56;

    const glow = S.fill({ background: `radial-gradient(circle at 50% 46%, ${S.withAlpha(accent, 0x26 / 255)} 0%, ${S.withAlpha(accent, 0)} 58%)`, opacity: 0.5 });
    const headline = S.h('span', { style: { fontSize, fontWeight: 800, letterSpacing: Math.round(fontSize * 0.01), lineHeight: 1, textAlign: 'center', color: textColor, WebkitBackgroundClip: 'text', backgroundClip: 'text', textShadow: `0 0 ${Math.round(fontSize * 0.18)}px ${S.withAlpha(accent, 0x55 / 255)}` } }, title) as HTMLElement;
    const underline = S.h('div', { style: { marginTop: Math.round(fontSize * 0.16), height: Math.max(3, Math.round(fontSize * 0.045)), background: `linear-gradient(90deg, ${S.withAlpha(accent, 0)}, ${accent}, ${S.withAlpha(accent, 0)})`, borderRadius: 999, opacity: 0.9 } }) as HTMLElement;
    const subline = S.h('span', { style: { marginTop: Math.round(fontSize * 0.22), fontSize: subFontSize, fontWeight: 600, letterSpacing: Math.round(subFontSize * 0.35), color: accent } }, sub) as HTMLElement;
    const group = S.h('div', { style: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' } }, headline, underline, sub.length > 0 ? subline : null) as HTMLElement;
    const root = S.fill({ backgroundColor: String(p.backgroundColor), fontFamily: S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif'), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, glow, group) as HTMLElement;
    view.root.replaceChildren(root);

    return (frame) => {
      const enter = S.spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 90 }, durationInFrames: 26 });
      const sweepLocal = (((frame - sweepStart) % sweepPeriod) + sweepPeriod) % sweepPeriod;
      const sweeping = frame >= sweepStart;
      const bandPos = S.interpolate(sweepLocal, [0, sweepPeriod], [-20, 120]);
      const underlineGrow = S.spring({ frame: frame - 22, fps, config: { damping: 20, stiffness: 80 }, durationInFrames: 24 });
      const subEnter = S.spring({ frame: frame - 30, fps, config: { damping: 20, stiffness: 90 }, durationInFrames: 22 });

      root.style.opacity = String(S.interpolate(frame, [totalFrames - 10, totalFrames], [1, 0.94], clamped));
      group.style.transform = `translateY(${S.interpolate(enter, [0, 1], [height * 0.04, 0])}px) scale(${S.interpolate(enter, [0, 1], [0.86, 1])})`;
      group.style.opacity = String(S.interpolate(enter, [0, 1], [0, 1], { extrapolateRight: 'clamp' }));

      headline.style.backgroundImage = `linear-gradient(100deg, ${textColor} 0%, ${textColor} ${Math.max(0, bandPos - 18)}%, ${accent} ${bandPos}%, ${textColor} ${Math.min(100, bandPos + 18)}%, ${textColor} 100%)`;
      headline.style.setProperty('-webkit-text-fill-color', sweeping ? 'transparent' : textColor);

      underline.style.width = `${Math.round(underlineW * underlineGrow)}px`;
      subline.style.transform = `translateY(${S.interpolate(subEnter, [0, 1], [subFontSize * 1.2, 0])}px)`;
      subline.style.opacity = String(S.interpolate(subEnter, [0, 1], [0, 1], { extrapolateRight: 'clamp' }));
    };
  }
};

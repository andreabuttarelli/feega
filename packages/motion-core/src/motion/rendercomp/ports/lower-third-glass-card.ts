import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'lower-third-glass-card',
  title: 'Glass lower third',
  about: 'A frosted glass name card slides up from below with a glowing accent bar, then the name and title settle in and the card fades out.',
  category: RendercompCategory.Social,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0c1a2e',
  fonts: [],
  props: {
    nameText: { type: 'string', title: 'Name', default: 'Alex Morgan', group: 'Content', maxLength: 60 },
    titleText: { type: 'string', title: 'Title', default: 'Head of Product, Feega', group: 'Content', maxLength: 80 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0c1a2e', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#06b6d4', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#f0f9ff', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const FPS = 30;
    const width = view.width;
    const height = view.height;
    const FONT = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const accent = String(p.accentColor);
    const textColor = String(p.textColor);
    const WASH_ALPHA = 0x22 / 255;
    const GLOW_ALPHA = 0x55 / 255;

    const cardW = width * 0.42;
    const cardH = height * 0.2;
    const cardX = width * 0.06;
    const restY = height * 0.74;
    const radius = height * 0.022;
    const padX = cardW * 0.07;

    const abs = { position: 'absolute' } as const;

    const wash = S.h('div', { style: { ...abs, left: 0, top: 0, width: '100%', height: '100%', background: `radial-gradient(120% 90% at 22% 88%, ${S.withAlpha(accent, WASH_ALPHA)} 0%, transparent 55%)` } }) as HTMLElement;

    const glow = S.h('div', { style: { ...abs, left: '-10%', top: '-40%', width: '60%', height: '180%', borderRadius: '50%', background: `radial-gradient(circle, ${S.withAlpha(accent, GLOW_ALPHA)} 0%, transparent 70%)`, filter: 'blur(8px)' } }) as HTMLElement;
    const sheen = S.h('div', { style: { ...abs, left: 0, top: 0, width: '100%', height: '42%', background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)' } });
    const bar = S.h('div', { style: { ...abs, left: 0, top: '18%', width: cardW * 0.012, height: '64%', borderRadius: 99, backgroundColor: accent, boxShadow: `0 0 ${height * 0.02}px ${accent}` } });
    const glass = S.h(
      'div',
      { style: { ...abs, left: 0, top: 0, width: '100%', height: '100%', borderRadius: radius, background: 'linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 100%)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: `0 ${height * 0.018}px ${height * 0.05}px rgba(0,0,0,0.45)`, overflow: 'hidden' } },
      glow,
      sheen,
      bar
    );

    const nameEl = S.h('div', { style: { ...abs, left: padX, top: cardH * 0.24, fontFamily: FONT, fontSize: height * 0.058, fontWeight: 800, color: textColor, letterSpacing: '0.01em', whiteSpace: 'nowrap', textShadow: '0 2px 12px rgba(0,0,0,0.4)' } }, String(p.nameText)) as HTMLElement;
    const titleEl = S.h('div', { style: { ...abs, left: padX, top: cardH * 0.6, fontFamily: FONT, fontSize: height * 0.026, fontWeight: 500, color: textColor, letterSpacing: '0.05em', whiteSpace: 'nowrap' } }, String(p.titleText)) as HTMLElement;
    const card = S.h('div', { style: { ...abs, left: cardX, width: cardW, height: cardH } }, glass, nameEl, titleEl) as HTMLElement;

    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backgroundColor), overflow: 'hidden' }, wash, card));

    return (frame) => {
      const cardIn = S.spring({ frame, fps: FPS, config: { damping: 18, stiffness: 90 }, durationInFrames: 28 });
      const nameIn = S.spring({ frame: frame - 12, fps: FPS, config: { damping: 16, stiffness: 110 }, durationInFrames: 20 });
      const titleIn = S.interpolate(frame, [24, 42], [0, 1], clamped);
      const exitOpacity = S.interpolate(frame, [104, 119], [1, 0], clamped);
      const glowPulse = 0.5 + 0.5 * Math.sin(frame * 0.08);

      wash.style.opacity = String(exitOpacity);
      glow.style.opacity = String(0.45 + glowPulse * 0.45);

      card.style.top = `${restY + (1 - cardIn) * height * 0.18}px`;
      card.style.opacity = String(cardIn * exitOpacity);

      nameEl.style.opacity = String(nameIn);
      nameEl.style.transform = `translateY(${(1 - nameIn) * 12}px)`;
      titleEl.style.opacity = String(titleIn * 0.85);
      titleEl.style.transform = `translateY(${(1 - titleIn) * 6}px)`;
    };
  }
};

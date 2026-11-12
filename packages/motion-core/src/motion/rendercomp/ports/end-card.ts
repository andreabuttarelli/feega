import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'end-card',
  title: 'End card',
  about: 'Rings expand behind a springing title, the subtitle fades up, and a call-to-action pill rises in with a sliding sheen.',
  category: RendercompCategory.Social,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#0b1f3a',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'Thanks for watching', group: 'Content', maxLength: 80 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'LEARN MORE AT OUR SITE', group: 'Content', maxLength: 80 },
    ctaText: { type: 'string', title: 'Button text', default: 'Visit our website', group: 'Content', maxLength: 40 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    background: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0b1f3a', group: 'Style' },
    titleColor: { type: 'string', title: 'Title colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#d4af37', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const FPS = 30;
    const width = view.width;
    const height = view.height;
    const FONT = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const EASE_OUT = S.Easing.out(S.Easing.ease);
    const CUBIC_OUT = S.Easing.out(S.Easing.cubic);
    const DUR_NORMAL = 9;
    const CTA_DELAY = 60;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const background = String(p.background);
    const titleColor = String(p.titleColor);
    const accent = String(p.accentColor);

    const portrait = height > width;
    const base = Math.min(width, height);
    const titleSize = portrait ? width * 0.075 : height * 0.075;
    const subSize = portrait ? width * 0.03 : height * 0.03;
    const ctaSize = portrait ? width * 0.038 : height * 0.034;

    const ring = (size: number, borderWidth: number) =>
      S.h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, borderRadius: '50%', border: `${borderWidth}px solid ${accent}` } }) as HTMLElement;
    const outerRing = ring(base * 0.8, 2);
    const innerRing = ring(base * 0.5, 1);

    const accentLine = S.h('div', { style: { width: 80, height: 4, backgroundColor: accent, transformOrigin: 'center' } }) as HTMLElement;
    const titleEl = S.h('div', { style: { fontFamily: FONT, fontSize: titleSize, fontWeight: 900, color: titleColor, letterSpacing: 2, textAlign: 'center', lineHeight: 1.3, maxWidth: width * 0.85 } }, String(p.title)) as HTMLElement;
    const subEl = S.h('div', { style: { fontFamily: FONT, fontSize: subSize, fontWeight: 400, color: titleColor, textAlign: 'center', letterSpacing: 4 } }, String(p.subtitle)) as HTMLElement;

    const sheen = S.h('div', { style: { position: 'absolute', top: '-40%', bottom: '-40%', width: '38%', background: 'linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.42) 50%, transparent 100%)', transform: 'skewX(-18deg)' } }) as HTMLElement;
    const chevronSize = ctaSize * 0.62;
    const chevron = S.h(
      'svg',
      { width: chevronSize, height: chevronSize, viewBox: '0 0 24 24', style: { position: 'relative' } },
      S.h('polyline', { points: '8,4 17,12 8,20', fill: 'none', stroke: background, strokeWidth: 3.4, strokeLinecap: 'round', strokeLinejoin: 'round' })
    ) as unknown as HTMLElement;
    const cta = S.h(
      'div',
      { style: { display: 'inline-flex', alignItems: 'center', gap: ctaSize * 0.55, position: 'relative', overflow: 'hidden', padding: `${ctaSize * 0.66}px ${ctaSize * 1.5}px`, borderRadius: 999, backgroundColor: accent, boxShadow: `0 ${ctaSize * 0.5}px ${ctaSize * 1.4}px rgba(0,0,0,0.35)` } },
      sheen,
      S.h('span', { style: { fontFamily: FONT, fontSize: ctaSize, fontWeight: 700, letterSpacing: 1, lineHeight: 1, color: background, position: 'relative', whiteSpace: 'nowrap' } }, String(p.ctaText)),
      chevron
    ) as HTMLElement;

    const column = S.fill({ alignItems: 'center', justifyContent: 'center', gap: portrait ? 24 : 32, padding: 64 }, accentLine, titleEl, subEl, S.h('div', { style: { marginTop: portrait ? 60 : 80 } }, cta));
    view.root.replaceChildren(S.fill({ backgroundColor: background }, outerRing, innerRing, column));

    return (frame) => {
      const ringScale = S.interpolate(frame, [0, 90], [0.3, 1.6], { ...clamped, easing: CUBIC_OUT });
      const ringOpacity = S.interpolate(frame, [0, 30, 90], [0, 0.25, 0.1], clamped);
      outerRing.style.transform = `scale(${ringScale})`;
      outerRing.style.opacity = String(ringOpacity);
      innerRing.style.transform = `scale(${ringScale * 0.85})`;
      innerRing.style.opacity = String(ringOpacity * 0.6);

      const titleScale = S.spring({ frame: frame - 8, fps: FPS, config: { damping: 12, mass: 1, stiffness: 80 } });
      const titleOpacity = S.interpolate(frame, [8, 24], [0, 1], clamped);
      accentLine.style.opacity = String(titleOpacity);
      accentLine.style.transform = `scaleX(${titleOpacity})`;
      titleEl.style.opacity = String(titleOpacity);
      titleEl.style.transform = `scale(${titleScale})`;

      const subOpacity = S.interpolate(frame, [24, 40], [0, 1], clamped);
      const subY = S.interpolate(frame, [24, 40], [20, 0], { ...clamped, easing: CUBIC_OUT });
      subEl.style.opacity = String(subOpacity * 0.7);
      subEl.style.transform = `translateY(${subY}px)`;

      const enter = S.interpolate(frame, [CTA_DELAY, CTA_DELAY + DUR_NORMAL * 1.6], [0, 1], { ...clamped, easing: EASE_OUT });
      const rel = Math.max(0, frame - CTA_DELAY);
      const sheenT = (rel / (FPS * 2.4)) % 1;
      cta.style.opacity = String(enter);
      cta.style.transform = `translateY(${(1 - enter) * 34}px) scale(${0.94 + enter * 0.06})`;
      sheen.style.left = `${S.interpolate(sheenT, [0, 1], [-140, 240])}%`;
      chevron.style.transform = `translateX(${3 * Math.sin((rel / FPS) * Math.PI)}px)`;
    };
  }
};

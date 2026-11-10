import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'logo-assemble',
  title: 'Logo assemble',
  about: 'A ring of image cards revolves around a line of text, drains into the centre and gives birth to the logo and brand name.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 108,
  background: '#0a0a0b',
  fonts: ['Inter'],
  props: {
    logoSrc: { type: 'string', title: 'Logo', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content', maxLength: 2000 },
    brandName: { type: 'string', title: 'Brand name', default: 'feega', group: 'Content', maxLength: 60 },
    middleText: { type: 'string', title: 'Middle text (\\n for lines)', default: 'Cinematic components\nfor React', group: 'Content', maxLength: 200 },
    images: { type: 'string', title: 'Ring images', format: PropFormat.Media, default: '', group: 'Content', maxLength: 2000 },
    count: { type: 'number', title: 'Cards on the ring', default: 10, minimum: 1, maximum: 40, step: 1, group: 'Content' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    color: { type: 'string', title: 'Text colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'dark', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const speed = Number(p.speed);
    const face = S.pick(p.fontFamily, 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
    const fg = S.pick(p.color, String(t.foreground));
    const stage = S.pick(p.background, String(t.background));
    const cardShadow = S.withAlpha(S.mixOklch(stage, '#000', 0.75), 0.4);
    const images = S.media(p.images);
    const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
    const EASE_IN = S.Easing.bezier(0.5, 0, 0.75, 0.4);
    const W = view.width;
    const H = view.height;
    const cx = W / 2;
    const cy = H / 2;
    const short = Math.min(W, H);
    const R = short * 0.36;
    const cardW = Math.round(short * 0.15);
    const cardH = cardW * 1.22;
    const n = Math.max(1, Math.floor(Number(p.count)));
    const logoSize = Math.round(short * 0.125);
    const gap = Math.round(short * 0.035);
    const restX = short * 0.13;
    const nameSize = Math.round(short * 0.055);
    const abs = (style: Record<string, string | number>) => ({ position: 'absolute', ...style });

    const cards = Array.from({ length: n }, (_, i) => {
      const src = images.length ? images[i % images.length] : '';
      const img = src ? S.h('img', { src, style: abs({ inset: 0, width: '100%', height: '100%', maxWidth: 'none', objectFit: 'cover' }) }) : null;
      return S.h('div', { style: abs({ width: cardW, height: cardH, overflow: 'hidden', borderRadius: 4, boxShadow: `0 14px 34px ${cardShadow}`, background: src ? 'transparent' : String(t.muted) }) }, img) as HTMLElement;
    });
    const middle = S.h('div', { style: abs({ left: cx - R, top: cy - cardH, width: R * 2, height: cardH * 2, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: fg, fontSize: Math.round(short * 0.04), fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.02em', whiteSpace: 'pre-line' }) }, String(p.middleText)) as HTMLElement;
    const logo = S.h(String(p.logoSrc) ? 'img' : 'div', { src: String(p.logoSrc) || null, style: abs({ top: cy - logoSize / 2, width: logoSize, height: logoSize, maxWidth: 'none', objectFit: 'contain', transformOrigin: 'center center', borderRadius: String(p.logoSrc) ? 0 : logoSize * 0.22, background: String(p.logoSrc) ? 'transparent' : fg }) }) as HTMLElement;
    const name = S.h('div', { style: abs({ left: cx - restX + logoSize / 2 + gap, top: cy - nameSize, height: nameSize * 2, display: 'flex', alignItems: 'center', color: fg, fontSize: nameSize, fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }) }, String(p.brandName)) as HTMLElement;
    view.root.replaceChildren(S.fill({ display: 'block', overflow: 'hidden', fontFamily: face, fontOpticalSizing: 'none', textRendering: 'geometricPrecision' }, cards, String(p.middleText) ? middle : null, logo, name));

    const show = (el: HTMLElement, opacity: number) => {
      el.style.visibility = opacity > 0 ? 'visible' : 'hidden';
      el.style.opacity = String(opacity);
    };

    return (at) => {
      const frame = at * speed;
      const contract = S.interpolate(frame, [50, 66], [0, 1], { ...CLAMP, easing: EASE_IN });
      const a = frame * 0.1 + contract * Math.PI * 1.1;
      const rs = 1 - contract;
      const cScale = 1 - 0.66 * contract;
      const cOpacity = S.interpolate(frame, [58, 66], [1, 0], CLAMP);
      cards.forEach((card, i) => {
        const theta = (i / n) * Math.PI * 2 + a;
        card.style.left = `${cx + Math.cos(theta) * R * rs - cardW / 2}px`;
        card.style.top = `${cy + Math.sin(theta) * R * rs - cardH / 2}px`;
        card.style.transform = `scale(${cScale})`;
        show(card, cOpacity);
      });
      show(middle, S.interpolate(frame, [6, 16, 46, 52], [0, 1, 1, 0], CLAMP));

      const shift = S.interpolate(frame, [74, 90], [0, 1], { ...CLAMP, easing: EASE });
      logo.style.left = `${cx - restX * shift - logoSize / 2}px`;
      logo.style.transform = `scale(${S.interpolate(frame, [58, 68, 76], [0.6, 1.05, 1], { ...CLAMP, easing: EASE })})`;
      show(logo, S.interpolate(frame, [58, 66], [0, 1], CLAMP));

      name.style.transform = `translateX(${S.interpolate(frame, [74, 86], [18, 0], { ...CLAMP, easing: EASE })}px)`;
      show(name, S.interpolate(frame, [74, 84], [0, 1], CLAMP));
    };
  }
};

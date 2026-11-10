import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'logo-flicker',
  title: 'Logo flicker',
  about: 'Images flip full-screen at a fast constant rate, then cross-fade into the logo and brand name.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 100,
  background: '#0a0a0b',
  fonts: ['Inter'],
  props: {
    logoSrc: { type: 'string', title: 'Logo image URL', default: '', group: 'Content', maxLength: 2000 },
    brandName: { type: 'string', title: 'Brand name', default: 'snapcn', group: 'Content', maxLength: 80 },
    images: { type: 'string', title: 'Flicker image URLs (comma separated)', default: '', group: 'Content', maxLength: 2000 },
    flipInterval: { type: 'number', title: 'Frames per image', default: 2, minimum: 1, maximum: 30, step: 1, group: 'Motion' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'dark', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const face = S.pick(p.fontFamily, 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
    const svg = (markup: string) => 'data:image/svg+xml,' + encodeURIComponent(markup);
    const sample = (hue: number) => svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},60%,20%)"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/></svg>`);
    const given = String(p.images).split(',').map((s) => s.trim()).filter(Boolean);
    const images = given.length ? given : [12, 48, 96, 160, 205, 250, 290, 330].map(sample);
    const logoSrc = String(p.logoSrc) || svg('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="80" height="80" rx="18" fill="#fff"/></svg>');
    const interval = Math.max(1, Number(p.flipInterval));
    const speed = Number(p.speed);
    const short = Math.min(view.width, view.height);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const EASE = S.Easing.bezier(0.2, 0.6, 0.35, 1);
    const FADE_START = 66;
    const FADE_END = 84;

    const pics = images.map((src) => S.h('img', { src, style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', maxWidth: 'none', objectFit: 'cover', display: 'none' } }) as HTMLElement);
    const logoSize = Math.round(short * 0.15);
    const logo = S.h('img', { src: logoSrc, style: { width: logoSize, height: logoSize, maxWidth: 'none', objectFit: 'contain' } });
    const name = S.h('div', { style: { color: String(t.foreground), fontSize: Math.round(short * 0.055), fontWeight: 600, letterSpacing: '-0.02em' } }, String(p.brandName));
    const lockup = S.fill({ alignItems: 'center', justifyContent: 'center', gap: Math.round(short * 0.02), transformOrigin: 'center center' }, logo, name) as HTMLElement;
    view.root.replaceChildren(S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', fontFamily: face, fontOpticalSizing: 'none', textRendering: 'geometricPrecision' } }, pics, lockup));

    return (at) => {
      const frame = at * speed;
      const flk = S.interpolate(frame, [FADE_START, FADE_END], [1, 0], clamped);
      const reveal = S.interpolate(frame, [FADE_START, FADE_END], [0, 1], clamped);
      const idx = images.length ? (Math.floor(frame / interval) * 7) % images.length : -1;
      pics.forEach((img, i) => {
        img.style.display = i === idx && flk > 0 ? 'block' : 'none';
        img.style.opacity = String(flk);
      });
      lockup.style.display = reveal > 0 ? 'flex' : 'none';
      lockup.style.opacity = String(reveal);
      lockup.style.transform = `scale(${S.interpolate(frame, [FADE_START, FADE_END], [0.92, 1], { ...clamped, easing: EASE })})`;
    };
  }
};

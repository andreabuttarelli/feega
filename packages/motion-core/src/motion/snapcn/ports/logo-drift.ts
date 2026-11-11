import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'logo-drift',
  title: 'Logo drift',
  about: 'Logo tiles fade in and drift as the camera pulls back, under a headline that blurs in word by word.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 108,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    headline: { type: 'string', title: 'Headline', default: 'Built for the stack you already use.', group: 'Content', maxLength: 160 },
    pullback: { type: 'number', title: 'Pull-back rate (per second)', default: 0.1762, minimum: 0, maximum: 1, step: 0.001, group: 'Motion' },
    tileSpeed: { type: 'number', title: 'Tile drift speed', default: 1, minimum: 0, maximum: 4, step: 0.05, group: 'Motion' },
    tileScale: { type: 'number', title: 'Tile scale', default: 1, minimum: 0.2, maximum: 3, step: 0.05, group: 'Style' },
    tileFade: { type: 'number', title: 'Tile fade (s)', default: 0.4, minimum: 0.01, maximum: 3, step: 0.01, group: 'Motion' },
    tileRadius: { type: 'number', title: 'Tile radius (share of size)', default: 0.02, minimum: 0, maximum: 0.5, step: 0.01, group: 'Style' },
    wordAt: { type: 'number', title: 'First word at (s)', default: 0.017, minimum: 0, maximum: 5, step: 0.01, group: 'Motion' },
    wordStagger: { type: 'number', title: 'Word stagger (s)', default: 0.15, minimum: 0, maximum: 2, step: 0.01, group: 'Motion' },
    wordDuration: { type: 'number', title: 'Word duration (s)', default: 0.14, minimum: 0.01, maximum: 2, step: 0.01, group: 'Motion' },
    wordScale: { type: 'number', title: 'Word start scale', default: 1.216, minimum: 0.2, maximum: 3, step: 0.01, group: 'Motion' },
    wordBlur: { type: 'number', title: 'Word start blur (px)', default: 4.3, minimum: 0, maximum: 30, step: 0.1, group: 'Motion' },
    exitAt: { type: 'number', title: 'Exit at (s)', default: 3.13, minimum: 0, maximum: 10, step: 0.01, group: 'Motion' },
    exitDuration: { type: 'number', title: 'Exit duration (s)', default: 0.34, minimum: 0.01, maximum: 3, step: 0.01, group: 'Motion' },
    exitScale: { type: 'number', title: 'Exit scale', default: 0.8, minimum: 0.1, maximum: 2, step: 0.01, group: 'Motion' },
    exitBlur: { type: 'number', title: 'Exit blur (px)', default: 6.5, minimum: 0, maximum: 30, step: 0.1, group: 'Motion' },
    fontSize: { type: 'number', title: 'Headline size (px)', default: 20, minimum: 8, maximum: 80, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Headline weight', default: 500, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    glyphScale: { type: 'number', title: 'Glyph scale', default: 0.34, minimum: 0.05, maximum: 1, step: 0.01, group: 'Style' },
    glow: { type: 'boolean', title: 'Glow', default: true, group: 'Style' },
    glowColor: { type: 'string', title: 'Glow colour (transparent = accent)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    glowOpacity: { type: 'number', title: 'Glow opacity', default: 0.07, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    accentColor: { type: 'string', title: 'Accent (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const n = (k: string) => Number(p[k]);
    const REF_W = 810;
    const REF_H = 458;
    const WORD_EASE = S.Easing.out(S.Easing.quad);
    const TILES = [
      { glyph: 'Rm', label: 'Remotion', background: '#1f2430', color: '#ffffff', x: 163, y: 232, vx: -54, vy: 12, size: 109, at: 0.28 },
      { glyph: 'sh', label: 'shadcn/ui', background: '#f2f4f7', color: '#16181d', x: 128, y: -209, vx: 81, vy: 32, size: 122, at: 0.48 },
      { glyph: 'Re', label: 'React', background: '#10131a', color: '#7dd3fc', x: -384, y: 344, vx: -27, vy: -68, size: 200, at: 0.95 },
      { glyph: 'N', label: 'Next.js', background: '#e7e8ea', color: '#16181d', x: 519, y: 45, vx: -31, vy: 64, size: 144, at: 1.51 },
      { glyph: 'tw', label: 'Tailwind', background: '#f1ece2', color: '#8a5a2b', x: -692, y: -125, vx: 41, vy: -71, size: 214, at: 1.55 },
      { glyph: 'Fg', label: 'Figma', background: '#2b3a36', color: '#ffffff', x: -350, y: -339, vx: 65, vy: -26, size: 188, at: 1.75 },
      { glyph: 'Mo', label: 'Motion', background: '#f4703a', color: '#ffffff', x: 672, y: -277, vx: 2, vy: 81, size: 256, at: 1.76 },
      { glyph: 'TS', label: 'TypeScript', background: '#2f6fdb', color: '#ffffff', x: -721, y: 211, vx: 9, vy: -84, size: 215, at: 2.06 },
      { glyph: '▲', label: 'Vercel', background: '#0b0b0d', color: '#ffffff', x: 676, y: 348, vx: -65, vy: 52, size: 244, at: 2.48 }
    ];
    const face = S.pick(p.fontFamily, 'Inter');
    const accent = S.pick(p.accentColor, String(t.primary));
    const wash = S.pick(p.glowColor, accent);
    const fontSize = n('fontSize');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const stageScale = Math.min(view.width / REF_W, view.height / REF_H);
    const words = String(p.headline).split(/\s+/).filter(Boolean);

    const field = S.h('div', { style: { position: 'absolute', left: 0, top: 0, width: REF_W, height: REF_H } });
    const wordEls = words.map((w) => S.h('span', { style: { display: 'inline-block' } }, w) as HTMLElement);
    const glow = p.glow ? S.h('div', { style: { position: 'absolute', left: 0, top: 0, width: REF_W, height: REF_H, background: `radial-gradient(${0.45 * REF_W}px ${0.34 * REF_H}px at 50% 49%, ${S.withAlpha(wash, n('glowOpacity'))} 0%, transparent 74%)` } }) : null;
    const headline = S.h('div', { style: { position: 'absolute', left: 0, top: 0, width: REF_W, height: REF_H, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, S.h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: fontSize * 0.28, fontFamily: face, fontSize, fontWeight: n('fontWeight'), lineHeight: 1.2, letterSpacing: '-0.012em', color: String(t.foreground), whiteSpace: 'pre', textRendering: 'geometricPrecision' } }, wordEls));
    const stage = S.h('div', { style: { position: 'absolute', left: '50%', top: '50%', width: REF_W, height: REF_H, transform: `translate(-50%, -50%) scale(${stageScale})`, overflow: 'hidden', background: String(t.background) } }, glow, field, headline);
    view.root.replaceChildren(S.fill({ background: String(t.background), fontOpticalSizing: 'none' }, stage));

    const tileEl = (tile: (typeof TILES)[number], now: number) => {
      const k = Math.max(0.02, 1 - n('pullback') * now);
      const wx = tile.x + tile.vx * n('tileSpeed') * now;
      const wy = tile.y + tile.vy * n('tileSpeed') * now;
      const size = k * tile.size * n('tileScale');
      const age = now - tile.at;
      const opacity = age <= 0 ? 0 : 1 - Math.exp(-age / Math.max(1e-3, n('tileFade')));
      if (opacity <= 0.002 || size < 1) {
        return null;
      }
      const label = size > 74 ? S.h('span', { style: { fontSize: size * 0.1, fontWeight: 500, lineHeight: 1, opacity: 0.72, textRendering: 'geometricPrecision' } }, tile.label) : null;
      return S.h('div', { style: { position: 'absolute', left: REF_W / 2 + k * wx - size / 2, top: REF_H / 2 + k * wy - size / 2, width: size, height: size, borderRadius: size * n('tileRadius'), background: tile.background, opacity, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: size * 0.04, color: tile.color, fontFamily: face, overflow: 'hidden' } }, S.h('span', { style: { fontSize: size * n('glyphScale'), fontWeight: 600, lineHeight: 1, letterSpacing: '-0.03em', textRendering: 'geometricPrecision' } }, tile.glyph), label);
    };

    const wordState = (now: number, i: number) => {
      const start = n('wordAt') + i * n('wordStagger');
      if (now < start) {
        return { scale: n('wordScale'), blur: n('wordBlur'), opacity: 0 };
      }
      const a = S.interpolate(now, [start, start + n('wordDuration')], [0, 1], { ...clamped, easing: WORD_EASE });
      const q = S.interpolate(now, [n('exitAt'), n('exitAt') + n('exitDuration')], [0, 1], clamped);
      return { scale: (n('wordScale') + (1 - n('wordScale')) * a) * (1 + (n('exitScale') - 1) * q), blur: n('wordBlur') * (1 - a) + n('exitBlur') * q, opacity: 1 - q };
    };

    return (frame) => {
      const now = (frame * n('speed')) / view.fps;
      field.replaceChildren(...TILES.map((tile) => tileEl(tile, now)).filter((e): e is Element => e !== null));
      wordEls.forEach((el, i) => {
        const w = wordState(now, i);
        el.style.opacity = String(w.opacity);
        el.style.transform = `scale(${w.scale})`;
        el.style.filter = w.blur > 0.02 ? `blur(${w.blur}px)` : '';
      });
    };
  }
};

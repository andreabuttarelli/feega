import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'shatter-reveal',
  title: 'Shatter reveal',
  about: 'Scattered, rotated fragments converge into a single gradient tile carrying the headline, then an accent bar wipes in and a subtitle fades up.',
  category: RendercompCategory.Logo,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#050913',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'Reveal', group: 'Content', maxLength: 20 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'Fragments converge into focus', group: 'Content', maxLength: 80 },
    pieces: { type: 'number', title: 'Fragments', default: 36, minimum: 1, maximum: 100, step: 1, group: 'Motion' },
    spread: { type: 'number', title: 'Scatter distance (px)', default: 280, minimum: 0, maximum: 1000, step: 10, group: 'Motion' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    background: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#050913', group: 'Style' },
    tileBackground: { type: 'string', title: 'Tile background (CSS)', default: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 50%, #db2777 100%)', group: 'Style', maxLength: 200 },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#facc15', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const textColor = String(p.textColor);
    const spread = Number(p.spread);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const EASE_OUT = S.Easing.out(S.Easing.ease);
    const CUBIC_OUT = S.Easing.out(S.Easing.cubic);
    const SHATTER_DELAY = 2;
    const SHATTER_DURATION = 48;
    const SEED = 42;
    const LCG_MULTIPLIER = 16807;
    const LCG_MODULUS = 2147483647;
    const scale = Math.min(view.width, view.height);
    const inset = scale * 0.074;

    let state = SEED;
    const rand = () => {
      state = (state * LCG_MULTIPLIER) % LCG_MODULUS;
      return (state - 1) / (LCG_MODULUS - 1);
    };

    const count = Math.max(1, Math.floor(Number(p.pieces)));
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const pieceWidth = 100 / cols;
    const pieceHeight = 100 / rows;

    const tile = () => S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: String(p.tileBackground), display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      S.h('div', { style: { fontFamily: face, fontSize: scale * 0.26, fontWeight: 900, color: textColor, letterSpacing: scale * 0.013, lineHeight: 1, textShadow: '0 6px 30px rgba(0,0,0,0.3)' } }, String(p.title))
    );

    const fragments = Array.from({ length: count }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const dx = (rand() - 0.5) * 2 * spread;
      const dy = (rand() - 0.5) * 2 * spread;
      const rot = (rand() - 0.5) * 360;
      const window = S.h('div', { style: { position: 'absolute', left: `-${col * 100}%`, top: `-${row * 100}%`, width: `${cols * 100}%`, height: `${rows * 100}%` } }, tile());
      const el = S.h('div', { style: { position: 'absolute', left: `${col * pieceWidth}%`, top: `${row * pieceHeight}%`, width: `${pieceWidth}%`, height: `${pieceHeight}%`, overflow: 'hidden' } }, window) as HTMLElement;
      return { el, dx, dy, rot };
    });

    const bar = S.h('div', { style: { width: scale * 0.222, height: scale * 0.0046, background: String(p.accentColor), transformOrigin: 'left center' } }) as HTMLElement;
    const subtitle = String(p.subtitle);
    const subEl = S.h('div', { style: { fontFamily: face, fontSize: scale * 0.03, color: textColor, letterSpacing: scale * 0.0037 } }, subtitle) as HTMLElement;

    view.root.replaceChildren(
      S.fill({ background: String(p.background) },
        S.h('div', { style: { position: 'absolute', top: inset, left: inset, right: inset, bottom: inset } },
          S.h('div', { style: { position: 'relative', width: '100%', height: '100%' } }, fragments.map((f) => f.el))
        ),
        S.fill({ alignItems: 'center', justifyContent: 'flex-end', gap: scale * 0.017, padding: scale * 0.059, pointerEvents: 'none' }, bar, subtitle ? subEl : null)
      )
    );

    return (frame) => {
      const progress = S.interpolate(frame, [SHATTER_DELAY, SHATTER_DELAY + SHATTER_DURATION], [0, 1], { ...clamped, easing: EASE_OUT });
      const remaining = 1 - progress;

      fragments.forEach(({ el, dx, dy, rot }) => {
        el.style.opacity = String(progress);
        el.style.transform = `translate(${dx * remaining}px, ${dy * remaining}px) rotate(${rot * remaining}deg)`;
      });

      subEl.style.opacity = String(S.interpolate(frame, [60, 90], [0, 1], { ...clamped, easing: CUBIC_OUT }) * 0.85);
      bar.style.transform = `scaleX(${S.interpolate(frame, [70, 100], [0, 1], { ...clamped, easing: CUBIC_OUT })})`;
    };
  }
};

import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'brush-stroke-reveal',
  title: 'Brush stroke reveal',
  about: 'The title is painted on in horizontal brush bands that wipe across one after another, then an accent dot and a supporting line fade in.',
  category: RendercompCategory.Logo,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#fffdf6',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'Brush Stroke', group: 'Content', maxLength: 40 },
    description: { type: 'string', title: 'Description', default: 'painted on, stroke by stroke', group: 'Content', maxLength: 120 },
    strokes: { type: 'number', title: 'Brush bands', default: 3, minimum: 1, maximum: 8, step: 1, group: 'Motion' },
    direction: { type: 'string', title: 'Direction', enum: ['left', 'right'], default: 'left', group: 'Motion' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#1a1a1a', group: 'Style' },
    background: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#fffdf6', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#a93226', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const textColor = String(p.textColor);
    const strokes = Math.max(1, Math.floor(Number(p.strokes)));
    const originX = p.direction === 'right' ? 'right' : 'left';
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const EASE_OUT = S.Easing.out(S.Easing.ease);
    const CUBIC_OUT = S.Easing.out(S.Easing.cubic);
    const BAND_DELAY = 2;
    const BAND_DURATION = 28;
    const BAND_STAGGER = 3;

    const titleBlock = () => S.h('div', { style: { fontFamily: face, fontSize: 160, fontWeight: 900, color: textColor, letterSpacing: 12, textAlign: 'center', lineHeight: 1.1 } }, String(p.title));

    const bands = Array.from({ length: strokes }, (_, i) => {
      const top = i * (100 / strokes);
      const bottom = 100 - (i + 1) * (100 / strokes);
      const inner = S.h('div', { style: { transformOrigin: `${originX} center` } }, titleBlock()) as HTMLElement;
      const band = S.h('div', { style: { position: i === 0 ? 'relative' : 'absolute', top: i === 0 ? undefined : 0, left: i === 0 ? undefined : 0, right: i === 0 ? undefined : 0, bottom: i === 0 ? undefined : 0, clipPath: `inset(${top}% 0 ${bottom}% 0)` } }, inner);
      return { band, inner };
    });

    const dot = S.h('div', { style: { width: 18, height: 18, borderRadius: '50%', background: String(p.accentColor) } }) as HTMLElement;
    const desc = String(p.description);
    const descEl = S.h('div', { style: { fontFamily: face, fontSize: 32, color: textColor, letterSpacing: 3, textAlign: 'center' } }, desc) as HTMLElement;

    view.root.replaceChildren(
      S.fill({ alignItems: 'center', justifyContent: 'center', gap: 36, padding: 64, background: String(p.background) },
        S.h('div', { style: { position: 'relative' } }, bands.map((b) => b.band)),
        dot,
        desc ? descEl : null
      )
    );

    return (frame) => {
      bands.forEach(({ inner }, i) => {
        const start = BAND_DELAY + i * BAND_STAGGER;
        const progress = S.interpolate(frame, [start, start + BAND_DURATION], [0, 1], { ...clamped, easing: EASE_OUT });
        inner.style.transform = `scaleX(${progress})`;
      });

      dot.style.opacity = String(S.interpolate(frame, [54, 72], [0, 1], clamped));
      descEl.style.opacity = String(S.interpolate(frame, [44, 64], [0, 1], { ...clamped, easing: CUBIC_OUT }) * 0.7);
    };
  }
};

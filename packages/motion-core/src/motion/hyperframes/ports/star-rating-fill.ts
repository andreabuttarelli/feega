import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'star-rating-fill',
  title: 'Star rating fill',
  about: 'A row of stars fills from left to right to a rating, each star popping as the colour passes, with the score counting up beside it.',
  category: HfCategory.Chart,
  origin: HfOrigin.Component,
  source: 'star-rating-fill',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0b0d12',
  fonts: ['Inter'],
  props: {
    rating: { type: 'number', title: 'Rating', default: 4.8, minimum: 0, maximum: 5, group: 'Content' },
    starCount: { type: 'number', title: 'Star count', default: 5, minimum: 1, maximum: 10, group: 'Content' },
    showValue: { type: 'string', title: 'Show value', enum: ['yes', 'no'], default: 'yes', group: 'Content' },
    star: { type: 'string', title: 'Star', format: PropFormat.Color, default: '#f5b942', group: 'Style' },
    base: { type: 'string', title: 'Empty star', format: PropFormat.Color, default: '#3a4352', group: 'Style' },
    ink: { type: 'string', title: 'Text', format: PropFormat.Color, default: '#f4f7fb', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const PATH = 'M50 0 61.8 36.2 100 36.2 69.1 58.6 80.9 95 50 72.4 19.1 95 30.9 58.6 0 36.2 38.2 36.2Z';
    const ratingNum = p.rating === '' || p.rating == null ? NaN : Number(p.rating);
    const requested = Number.isFinite(ratingNum) ? Math.max(0, Math.min(5, ratingNum)) : 4.8;
    const countNum = p.starCount === '' || p.starCount == null ? NaN : Number(p.starCount);
    const count = Math.max(1, Math.min(10, Number.isFinite(countNum) ? Math.round(countNum) : 5));
    const rating = Math.min(requested, count);
    const showValue = p.showValue !== 'no';
    const fillPercent = (rating / count) * 100;
    const width = Math.min(W * 0.68, H * 0.72 * count);
    const size = width / count;

    const cells = (color: string) =>
      Array.from({ length: count }, () =>
        S.h('span', { style: { display: 'block', width: size, height: size, flex: '0 0 auto', transformOrigin: 'center' } }, S.h('svg', { viewBox: '0 0 100 100', style: { display: 'block', width: '100%', height: '100%', overflow: 'visible' } }, S.h('path', { d: PATH, fill: color }))) as HTMLElement
      );
    const baseCells = cells(String(p.base));
    const fillCells = cells(String(p.star));
    const base = S.h('div', { style: { width: '100%', display: 'flex', alignItems: 'center' } }, ...baseCells);
    const fill = S.h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' } }, ...fillCells) as HTMLElement;
    const stars = S.h('div', { style: { position: 'relative', width } }, base, fill);
    const value = S.h('div', { style: { minWidth: '2.2em', color: String(p.ink), fontSize: Math.min(W * 0.09, H * 0.16), fontWeight: 720, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em', lineHeight: 1, textAlign: 'right', display: showValue ? 'block' : 'none' } }, '0.0') as HTMLElement;
    const stage = S.h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: W * 0.03 } }, stars, value) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' } }, stage);
    view.root.replaceChildren(clip);

    const duration = view.frames / view.fps;
    const IN = 1.5;
    const OUT = 0.4;
    const fit = Math.min(1, duration / (IN + OUT));
    const outAt = IN * fit + Math.max(0, duration - (IN + OUT) * fit);
    const fillAt = 0.2 * fit;
    const fillFor = 1.1 * fit;
    const popFor = 0.2 * fit;
    const state = { v: 0 };

    const tl = S.timeline();
    tl.set(fill, { clipPath: 'inset(0 100% 0 0)' }, 0);
    tl.to(fill, { clipPath: `inset(0 ${100 - fillPercent}% 0 0)`, duration: fillFor, ease: 'power2.out' }, fillAt);

    if (showValue) {
      tl.to(state, { v: rating, duration: fillFor, ease: 'power2.out', onUpdate: () => { value.textContent = state.v.toFixed(1); } }, fillAt);
    }

    for (let i = 0; i < Math.ceil(rating); i++) {
      const at = fillAt + fillFor * (i / Math.max(1, rating)) * 0.82;
      const pair = [baseCells[i], fillCells[i]];
      tl.to(pair, { scale: 1.06, duration: popFor * 0.45, ease: 'power2.out' }, at);
      tl.to(pair, { scale: 1, duration: popFor * 0.55, ease: 'power2.out' }, at + popFor * 0.45);
    }
    tl.to(stage, { opacity: 0, duration: OUT * fit, ease: 'power2.in' }, outAt);

    return (frame) => tl.render(frame / view.fps);
  }
};

import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'logo-stroke-draw',
  title: 'Logo stroke draw',
  about: 'A badge ring is drawn on by a pen tip, fills in with the monogram, catches a shine sweep, and the brand name fades up under an accent underline.',
  category: RendercompCategory.Logo,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 110,
  background: '#0a0800',
  fonts: [],
  props: {
    monogram: { type: 'string', title: 'Monogram', default: 'A', group: 'Content', maxLength: 3 },
    brandText: { type: 'string', title: 'Brand text', default: 'ACME INC.', group: 'Content', maxLength: 30 },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0a0800', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#eab308', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#fefce8', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const fps = 30;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const accent = String(p.accentColor);
    const textColor = String(p.textColor);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const cx = width / 2;
    const cy = height * 0.42;
    const R = height * 0.2;
    const strokeW = height * 0.011;
    const ringLen = 2 * Math.PI * R;
    const sweepW = R * 0.5;

    const badge = S.h('circle', { cx, cy, r: R - strokeW / 2, fill: accent });
    const ring = S.h('circle', { cx, cy, r: R, fill: 'none', stroke: accent, strokeWidth: strokeW, strokeLinecap: 'round', strokeDasharray: String(ringLen), transform: `rotate(-90 ${cx} ${cy})` });
    const tip = S.h('circle', { r: strokeW * 1.3, fill: textColor, opacity: 0.9 });
    const letter = S.h('text', { x: cx, y: cy, textAnchor: 'middle', dominantBaseline: 'central', fontFamily: face, fontWeight: 800, fontSize: R * 1.15, fill: accent, letterSpacing: '-0.02em' }, String(p.monogram));
    const band = S.h('rect', { y: cy - R * 1.4, width: sweepW, height: R * 2.8, fill: textColor, opacity: 0.28 });
    const shineGroup = S.h('g', { clipPath: 'url(#lsd-shine-clip)' }, band);
    const lockup = S.h('g', null, badge, ring, tip, letter, shineGroup);
    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } },
      S.h('defs', null, S.h('clipPath', { id: 'lsd-shine-clip' }, S.h('circle', { cx, cy, r: R - strokeW / 2 }))),
      lockup
    );

    const glow = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(circle at ${cx}px ${cy}px, ${accent}22 0%, transparent ${R * 2.2}px)` } }) as HTMLElement;
    const brand = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: cy + R + height * 0.07, textAlign: 'center', fontFamily: face, fontSize: height * 0.05, fontWeight: 700, color: textColor, letterSpacing: '0.22em' } }, String(p.brandText)) as HTMLElement;
    const underline = S.h('div', { style: { position: 'absolute', left: cx - (width * 0.12) / 2, top: cy + R + height * 0.155, height: height * 0.004, backgroundColor: accent, borderRadius: height * 0.004 } }) as HTMLElement;
    const content = S.fill({}, svg, brand, underline) as HTMLElement;

    view.root.replaceChildren(S.fill({ background: String(p.backgroundColor), overflow: 'hidden' }, glow, content));

    return (frame) => {
      const drawProgress = S.interpolate(frame, [0, 50], [0, 1], clamped);
      const fillIn = S.interpolate(frame, [44, 66], [0, 1], clamped);
      const shine = S.interpolate(frame, [58, 84], [0, 1], clamped);
      const textIn = S.interpolate(frame, [60, 78], [0, 1], clamped);
      const settle = S.spring({ frame: frame - 44, fps, config: { damping: 14, stiffness: 90, mass: 0.8 }, durationInFrames: 30 });
      const lockupScale = S.interpolate(settle, [0, 1], [0.94, 1]);
      const tipAngle = -Math.PI / 2 + drawProgress * 2 * Math.PI;
      const sweepX = S.interpolate(shine, [0, 1], [cx - R * 1.6, cx + R * 1.6]);

      glow.style.opacity = String(fillIn);
      content.style.opacity = String(S.interpolate(frame, [100, 109], [1, 0.92], clamped));
      lockup.setAttribute('transform', `translate(${cx} ${cy}) scale(${lockupScale}) translate(${-cx} ${-cy})`);
      badge.setAttribute('opacity', String(fillIn * 0.16));
      ring.setAttribute('stroke-dashoffset', String(ringLen - ringLen * drawProgress));
      tip.setAttribute('cx', String(cx + R * Math.cos(tipAngle)));
      tip.setAttribute('cy', String(cy + R * Math.sin(tipAngle)));
      tip.setAttribute('display', drawProgress > 0.01 && drawProgress < 0.99 ? 'inline' : 'none');
      letter.setAttribute('opacity', String(fillIn));
      band.setAttribute('x', String(sweepX - sweepW / 2));
      band.setAttribute('transform', `rotate(18 ${sweepX} ${cy})`);
      shineGroup.setAttribute('display', shine > 0.02 && shine < 0.98 ? 'inline' : 'none');
      brand.style.opacity = String(textIn);
      brand.style.transform = `translateY(${(1 - textIn) * height * 0.025}px)`;
      underline.style.width = `${width * 0.12 * textIn}px`;
      underline.style.opacity = String(textIn);
    };
  }
};

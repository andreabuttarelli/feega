import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'logo-mask-wipe',
  title: 'Logo mask wipe',
  about: 'A diagonal wipe with a bright leading edge reveals a monogram badge, which settles into place while the brand name fades up under an accent underline.',
  category: RendercompCategory.Logo,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 100,
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
    const frames = 100;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const accent = String(p.accentColor);
    const textColor = String(p.textColor);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const cx = width / 2;
    const cy = height * 0.43;
    const R = height * 0.2;
    const diag = Math.hypot(width, height);
    const maskAngle = -28;
    const lineLen = R * 3.2;

    const clipRect = S.h('rect', { x: cx - diag, y: cy - diag, width: diag, height: diag * 2 });
    const lockup = S.h('g', null,
      S.h('circle', { cx, cy, r: R, fill: accent, opacity: 0.16 }),
      S.h('circle', { cx, cy, r: R, fill: 'none', stroke: accent, strokeWidth: height * 0.011 }),
      S.h('text', { x: cx, y: cy, textAnchor: 'middle', dominantBaseline: 'central', fontFamily: face, fontWeight: 800, fontSize: R * 1.15, fill: accent, letterSpacing: '-0.02em' }, String(p.monogram))
    );
    const sweepRect = S.h('rect', { y: cy - lineLen / 2, width: height * 0.008, height: lineLen, fill: textColor, opacity: 0.85 });
    const sweep = S.h('g', { transform: `rotate(${maskAngle} ${cx} ${cy})` }, sweepRect);
    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } },
      S.h('defs', null, S.h('clipPath', { id: 'lmw-wipe', clipPathUnits: 'userSpaceOnUse' }, clipRect)),
      S.h('g', { clipPath: 'url(#lmw-wipe)' }, lockup),
      sweep
    );

    const glow = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(circle at ${cx}px ${cy}px, ${accent}22 0%, transparent ${R * 2.4}px)` } }) as HTMLElement;
    const brand = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: cy + R + height * 0.07, textAlign: 'center', fontFamily: face, fontSize: height * 0.05, fontWeight: 700, color: textColor, letterSpacing: '0.22em' } }, String(p.brandText)) as HTMLElement;
    const underline = S.h('div', { style: { position: 'absolute', left: cx - (width * 0.12) / 2, top: cy + R + height * 0.155, height: height * 0.004, backgroundColor: accent, borderRadius: height * 0.004 } }) as HTMLElement;
    const content = S.fill({}, svg, brand, underline) as HTMLElement;

    view.root.replaceChildren(S.fill({ background: String(p.backgroundColor), overflow: 'hidden' }, glow, content));

    return (frame) => {
      const wipe = S.interpolate(frame, [0, 46], [0, 1], clamped);
      const textIn = S.interpolate(frame, [40, 58], [0, 1], clamped);
      const settle = S.spring({ frame: frame - 30, fps, config: { damping: 16, stiffness: 95, mass: 0.9 }, durationInFrames: 30 });
      const lockupScale = S.interpolate(settle, [0, 1], [1.06, 1]);
      const edge = S.interpolate(wipe, [0, 1], [-diag * 0.62, diag * 0.62]);
      const lineVisible = wipe > 0.02 && wipe < 0.985;

      glow.style.opacity = String(wipe);
      content.style.opacity = String(S.interpolate(frame, [frames - 10, frames], [1, 0.94], clamped));
      clipRect.setAttribute('transform', `rotate(${maskAngle} ${cx} ${cy}) translate(${edge} 0)`);
      lockup.setAttribute('transform', `translate(${cx} ${cy}) scale(${lockupScale}) translate(${-cx} ${-cy})`);
      sweepRect.setAttribute('x', String(cx + edge - height * 0.004));
      sweep.setAttribute('display', lineVisible ? 'inline' : 'none');
      brand.style.opacity = String(textIn);
      brand.style.transform = `translateY(${(1 - textIn) * height * 0.025}px)`;
      underline.style.width = `${width * 0.12 * textIn}px`;
      underline.style.opacity = String(textIn);
    };
  }
};

import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'transition-circle-wipe',
  title: 'Circle wipe transition',
  about: 'Scene 01 holds under a slow push, then an accent-edged iris opens from the centre and reveals Scene 02 through it.',
  category: RendercompCategory.Transition,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#0b0f1a',
  fonts: [],
  props: {
    fromLabel: { type: 'string', title: 'From label', default: 'Scene 01', group: 'Content', maxLength: 40 },
    toLabel: { type: 'string', title: 'To label', default: 'Scene 02', group: 'Content', maxLength: 40 },
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0b0f1a', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#6366f1', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#eef2ff', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height, frames } = view;
    const backgroundColor = String(p.backgroundColor);
    const accent = String(p.accentColor);
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const IRIS_START = 0.16;
    const IRIS_END = 0.66;
    const RULE_START = 0.44;
    const RULE_END = 0.94;

    const scale = Math.min(width, height);
    const last = Math.max(1, frames - 1);
    const at = (fraction: number) => fraction * last;
    const maxRadius = Math.sqrt(width * width + height * height) / 2;
    const labelSize = scale * 0.075;
    const mix = (a: string, b: string, t: number) => {
      const ca = S.parseColor(a);
      const cb = S.parseColor(b);
      return S.toCss({ r: ca.r + (cb.r - ca.r) * t, g: ca.g + (cb.g - ca.g) * t, b: ca.b + (cb.b - ca.b) * t, alpha: 1 });
    };
    const sceneTwoBase = mix(backgroundColor, accent, 0.26);
    const sceneTwoEdge = mix(backgroundColor, accent, 0.07);
    const labelStyle = { fontFamily: face, fontSize: labelSize, fontWeight: 800, color: String(p.textColor), letterSpacing: scale * 0.004 };

    const outgoing = S.fill({ backgroundColor, alignItems: 'center', justifyContent: 'center' }, S.h('div', { style: labelStyle }, String(p.fromLabel))) as HTMLElement;
    const rule = S.h('div', { style: { width: 0, height: Math.max(2, scale * 0.005), backgroundColor: accent } }) as HTMLElement;
    const incoming = S.fill({},
      S.fill({ background: `radial-gradient(circle at 50% 42%, ${sceneTwoBase} 0%, ${sceneTwoEdge} 78%)` }),
      S.fill({ alignItems: 'center', justifyContent: 'center' },
        S.h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: labelSize * 0.34 } }, S.h('div', { style: labelStyle }, String(p.toLabel)), rule))
    ) as HTMLElement;
    const ring = S.h('circle', { cx: width / 2, cy: height / 2, r: 0, fill: 'none', stroke: accent, strokeWidth: 0, opacity: 0 });
    const edge = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, ring) as SVGElement;
    view.root.replaceChildren(S.fill({ backgroundColor }, outgoing, incoming, edge));

    return (frame) => {
      const iris = S.interpolate(frame, [at(IRIS_START), at(IRIS_END)], [0, 1], { ...clamped, easing: S.Easing.inOut(S.Easing.cubic) });
      const irisRadius = Math.max(0, iris * maxRadius * 1.04);
      const edgeWidth = S.interpolate(iris, [0, 1], [scale * 0.05, scale * 0.014], clamped);
      const edgeOpacity = S.interpolate(iris, [0, 0.04, 0.9, 1], [0, 1, 1, 0], clamped);

      outgoing.style.transform = `scale(${S.interpolate(frame, [0, last], [1, 1.035], clamped).toFixed(4)})`;
      incoming.style.clipPath = `circle(${irisRadius.toFixed(1)}px at 50% 50%)`;
      rule.style.width = `${S.interpolate(frame, [at(RULE_START), at(RULE_END)], [0, 1], { ...clamped, easing: S.Easing.out(S.Easing.cubic) }) * labelSize * 5}px`;

      edge.style.display = edgeOpacity > 0.001 ? 'block' : 'none';
      ring.setAttribute('r', String(Math.max(0, irisRadius - edgeWidth / 2)));
      ring.setAttribute('stroke-width', String(edgeWidth));
      ring.setAttribute('opacity', String(edgeOpacity));
    };
  }
};

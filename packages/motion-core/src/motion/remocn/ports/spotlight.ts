import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'spotlight',
  title: 'Spotlight',
  about: 'A stage light searches left and right, then lands on a logo lockup and lights it up.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 80,
  background: '#111111',
  fonts: [],
  props: {
    text: { type: 'string', title: 'Lockup text', default: 'feega', group: 'Content', maxLength: 40 },
    dim: { type: 'number', title: 'Unlit brightness', default: 0.16, minimum: 0, maximum: 0.6, step: 0.01, group: 'Style' },
    beamColor: { type: 'string', title: 'Beam', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height, fps } = view;
    const speed = Math.max(0, Number(p.speed));
    const dim = Number(p.dim);
    const beamColor = String(p.beamColor);
    const stage = String(p.background);
    const SEARCH = 12;
    const SWING = 26;
    const HOUSE = 38;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const apexX = width / 2;
    const apexY = -height * 0.12;
    const floorY = height * 0.8;
    const spread = width * 0.27;
    const apexHalf = width * 0.012;

    const glow = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: `radial-gradient(ellipse 80% 70% at 50% 40%, ${beamColor} 0%, transparent 70%)` } }) as HTMLElement;
    const pool = S.h('ellipse', { fill: 'url(#spotlight-pool)', rx: spread * 1.25, ry: height * 0.07, cy: floorY });
    const cone = S.h('polygon', { fill: 'url(#spotlight-beam)', filter: 'url(#spotlight-soft)' });
    const group = S.h('g', null, pool, cone);
    const defs = S.h('defs', null,
      S.h('linearGradient', { id: 'spotlight-beam', gradientUnits: 'userSpaceOnUse', x1: 0, y1: apexY, x2: 0, y2: floorY },
        S.h('stop', { offset: 0, stopColor: beamColor, stopOpacity: 0.55 }),
        S.h('stop', { offset: 0.6, stopColor: beamColor, stopOpacity: 0.2 }),
        S.h('stop', { offset: 1, stopColor: beamColor, stopOpacity: 0.12 })),
      S.h('radialGradient', { id: 'spotlight-pool' },
        S.h('stop', { offset: 0, stopColor: beamColor, stopOpacity: 0.45 }),
        S.h('stop', { offset: 0.6, stopColor: beamColor, stopOpacity: 0.14 }),
        S.h('stop', { offset: 1, stopColor: beamColor, stopOpacity: 0 })),
      S.h('filter', { id: 'spotlight-soft', x: -width, y: -height, width: width * 3, height: height * 3, filterUnits: 'userSpaceOnUse' }, S.h('feGaussianBlur', { stdDeviation: width * 0.012 })));
    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, defs, group);
    const mark = S.h('div', { style: { width: 120, height: 120, borderRadius: 32, background: beamColor, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, S.h('div', { style: { width: 36, height: 36, borderRadius: '50%', background: stage } }));
    const word = S.h('span', { style: { fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 104, fontWeight: 800, letterSpacing: '-0.04em', color: beamColor } }, String(p.text));
    const lockup = S.fill({ alignItems: 'center', justifyContent: 'center' }, S.h('div', { style: { display: 'flex', alignItems: 'center', gap: 28 } }, mark, word)) as HTMLElement;
    view.root.replaceChildren(glow, svg, lockup);

    return (at) => {
      const t = at * speed;
      let target: number;
      if (t < SEARCH) {
        target = S.interpolate(t, [0, SEARCH], [0.14, 0.27], { ...clamp, easing: S.Easing.inOut(S.Easing.sin) });
      } else if (t < SWING) {
        target = S.interpolate(t, [SEARCH, SWING], [0.27, 0.74], { ...clamp, easing: S.Easing.inOut(S.Easing.cubic) });
      } else {
        const land = S.spring({ frame: t - SWING, fps, config: { damping: 11, stiffness: 120, mass: 0.8 } });
        target = 0.74 + (0.5 - 0.74) * land;
      }
      const tx = target * width;
      const beamOn = S.interpolate(t, [0, 5], [0, 1], { ...clamp, easing: S.Easing.out(S.Easing.quad) });
      const house = S.interpolate(t, [HOUSE, HOUSE + 12], [0, 1], { ...clamp, easing: S.Easing.inOut(S.Easing.sin) });
      const coverage = Math.max(0, 1 - Math.abs(target - 0.5) / 0.3);
      const lit = Math.max(dim, dim + (1 - dim) * S.Easing.inOut(S.Easing.quad)(coverage) * beamOn);
      const brightness = t >= SWING + 10 ? Math.max(lit, Math.min(1, lit + house)) : lit;

      glow.style.opacity = String(0.09 * house);
      group.setAttribute('opacity', String(beamOn * (1 - 0.35 * house)));
      pool.setAttribute('cx', String(tx));
      cone.setAttribute('points', `${apexX - apexHalf},${apexY} ${apexX + apexHalf},${apexY} ${tx + spread},${floorY} ${tx - spread},${floorY}`);
      lockup.style.filter = `brightness(${brightness})`;
    };
  }
};

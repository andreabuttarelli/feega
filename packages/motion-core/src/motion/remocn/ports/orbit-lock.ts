import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'orbit-lock',
  title: 'Orbit lock',
  about: 'Moons spiral in on a tilted orbit, collide with a core and flash into a logo lockup.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 78,
  background: '#111111',
  fonts: [],
  props: {
    text: { type: 'string', title: 'Lockup text', default: 'feega', group: 'Content', maxLength: 40 },
    moons: { type: 'number', title: 'Moons', default: 3, minimum: 1, maximum: 8, step: 1, group: 'Style' },
    tilt: { type: 'number', title: 'Orbit tilt', default: 64, minimum: 0, maximum: 85, step: 1, group: 'Style' },
    coreColor: { type: 'string', title: 'Core', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    moonColor: { type: 'string', title: 'Moons', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    flashColor: { type: 'string', title: 'Flash', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height, fps } = view;
    const speed = Math.max(0, Number(p.speed));
    const count = Math.max(1, Math.round(Number(p.moons)));
    const tiltRad = (Math.min(85, Math.max(0, Number(p.tilt))) * Math.PI) / 180;
    const coreColor = String(p.coreColor);
    const moonColor = String(p.moonColor);
    const flashColor = String(p.flashColor);
    const bg = String(p.background);
    const IMPACT = 30;
    const TURNS = 1.9;
    const TRAIL = 10;
    const TRAIL_STEP = 0.4;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const outCubic = { ...clamp, easing: S.Easing.out(S.Easing.cubic) };
    const s = Math.min(width, height);
    const cx = width / 2;
    const cy = height / 2;
    const core = s * 0.055;
    const outer = s * 0.36;
    const moonR = s * 0.02;

    const moonAt = (t: number, index: number, inner: number) => {
      const q = Math.min(1, Math.max(0, t / IMPACT));
      const r = inner + (outer - inner) * (1 - S.Easing.in(S.Easing.cubic)(q));
      const theta = (index / count) * Math.PI * 2 + Math.PI * 2 * TURNS * S.Easing.in(S.Easing.quad)(q);
      const plane = (index / count) * Math.PI + Math.PI / 9;
      const lx = r * Math.cos(theta);
      const ly = r * Math.sin(theta) * Math.cos(tiltRad);
      return { x: lx * Math.cos(plane) - ly * Math.sin(plane), y: lx * Math.sin(plane) + ly * Math.cos(plane), z: r * Math.sin(theta) * Math.sin(tiltRad) };
    };

    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }) as SVGElement;
    const mark = S.h('div', { style: { width: 120, height: 120, borderRadius: 32, background: coreColor, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, S.h('div', { style: { width: 36, height: 36, borderRadius: '50%', background: bg } }));
    const word = S.h('span', { style: { fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 104, fontWeight: 800, letterSpacing: '-0.04em', color: moonColor } }, String(p.text)) as HTMLElement;
    const lockup = S.fill({ alignItems: 'center', justifyContent: 'center' }, S.h('div', { style: { display: 'flex', alignItems: 'center', gap: 28 } }, mark, word)) as HTMLElement;
    view.root.replaceChildren(svg, lockup);

    const moonNode = (body: { i: number; head: { x: number; y: number; z: number }; trail: { x: number; y: number }[] }, appear: number) => {
      const { i, head, trail } = body;
      const depth = 1 + (0.18 * head.z) / outer;
      const points = [head, ...trail];
      const left: string[] = [];
      const right: string[] = [];
      points.forEach((pt, k) => {
        const prev = points[Math.max(0, k - 1)];
        const next = points[Math.min(points.length - 1, k + 1)];
        const dx = prev.x - next.x;
        const dy = prev.y - next.y;
        const len = Math.hypot(dx, dy) || 1;
        const half = moonR * depth * 0.9 * (1 - k / points.length);
        const nx = (-dy / len) * half;
        const ny = (dx / len) * half;
        left.push(`${cx + pt.x + nx},${cy + pt.y + ny}`);
        right.unshift(`${cx + pt.x - nx},${cy + pt.y - ny}`);
      });
      const tail = points[points.length - 1];
      const gradId = `orbit-lock-trail-${i}`;
      return S.h('g', { opacity: appear },
        S.h('defs', null, S.h('linearGradient', { id: gradId, gradientUnits: 'userSpaceOnUse', x1: cx + head.x, y1: cy + head.y, x2: cx + tail.x, y2: cy + tail.y }, S.h('stop', { offset: 0, stopColor: moonColor, stopOpacity: 0.6 }), S.h('stop', { offset: 1, stopColor: moonColor, stopOpacity: 0 }))),
        S.h('polygon', { points: [...left, ...right].join(' '), fill: `url(#${gradId})` }),
        S.h('circle', { cx: cx + head.x, cy: cy + head.y, r: moonR * depth, fill: moonColor })
      );
    };

    return (at) => {
      const t = at * speed;
      const q = Math.min(1, t / IMPACT);
      const corePulse = 1 + 0.3 * q ** 4;
      const burst = S.interpolate(t, [IMPACT, IMPACT + 2, IMPACT + 6], [1, 1.6, 0], outCubic);
      const coreScale = t < IMPACT ? corePulse : corePulse * burst;
      const coreFill = S.interpolateColors(t, [IMPACT - 2, IMPACT + 1], [coreColor, flashColor]);
      const ring = S.interpolate(t, [IMPACT, IMPACT + 16], [0, 1], outCubic);
      const orbitOpacity = S.interpolate(t, [0, 6, IMPACT - 4, IMPACT], [0, 0.16, 0.1, 0], clamp);
      const orbitR = core + (outer - core) * (1 - S.Easing.in(S.Easing.cubic)(q));
      const pop = S.spring({ frame: t - IMPACT - 3, fps, config: { damping: 11, stiffness: 170, mass: 0.7 } });
      const appear = S.interpolate(t, [0, 5], [0, 1], clamp);
      const showMoons = t < IMPACT && t >= 0;

      const bodies = Array.from({ length: count }, (_, i) => ({
        i,
        head: moonAt(t, i, core),
        trail: Array.from({ length: TRAIL }, (_, k) => moonAt(t - (k + 1) * TRAIL_STEP, i, core))
      }));

      const nodes: Element[] = Array.from({ length: count }, (_, i) =>
        S.h('ellipse', { cx, cy, rx: orbitR, ry: orbitR * Math.cos(tiltRad), transform: `rotate(${(i / count) * 180 + 20} ${cx} ${cy})`, fill: 'none', stroke: moonColor, strokeOpacity: orbitOpacity, strokeWidth: 1.5 })
      );
      if (showMoons) {
        bodies.filter((b) => b.head.z < 0).forEach((b) => nodes.push(moonNode(b, appear)));
      }
      if (coreScale > 0) {
        nodes.push(S.h('circle', { cx, cy, r: core * coreScale * appear, fill: coreFill }));
      }
      if (showMoons) {
        bodies.filter((b) => b.head.z >= 0).forEach((b) => nodes.push(moonNode(b, appear)));
      }
      if (t >= IMPACT && ring < 1) {
        nodes.push(S.h('circle', { cx, cy, r: core + ring * s * 0.62, fill: 'none', stroke: flashColor, strokeWidth: Math.max(1, s * 0.03 * (1 - ring)), opacity: 1 - ring }));
      }
      svg.replaceChildren(...nodes);

      lockup.style.opacity = String(S.interpolate(t, [IMPACT + 3, IMPACT + 6], [0, 1], clamp));
      lockup.style.transform = `scale(${0.55 + 0.45 * pop})`;
    };
  }
};

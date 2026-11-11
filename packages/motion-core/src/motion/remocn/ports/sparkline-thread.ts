import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'sparkline-thread',
  title: 'Sparkline thread',
  about: 'A thin thread traces a sparkline, thickens into a glowing area, and lands on a big metric.',
  category: SnapcnCategory.Social,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#02030a',
  fonts: ['Geist', 'Geist Mono'],
  props: {
    theme: { type: 'string', title: 'Theme', enum: ['dark', 'light'], default: 'dark', group: 'Style' },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#3B5BFD', group: 'Style' },
    metric: { type: 'string', title: 'Metric', default: '+212%', group: 'Content', maxLength: 24 },
    label: { type: 'string', title: 'Label', default: 'weekly renders', group: 'Content', maxLength: 60 },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.25, group: 'Motion' }
  },
  draw: (S, view) => {
    const grouped = (n: number, decimals = 0, useGrouping = true) => {
      const [whole, fraction] = n.toFixed(decimals).split('.');
      const text = useGrouping ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
      return fraction ? `${text}.${fraction}` : text;
    };
    const p = view.props;
    const accent = String(p.accent);
    const speed = Number(p.speed);
    const metric = String(p.metric);
    const DEFAULT_BG = '#02030a';
    const display = "Geist, -apple-system, BlinkMacSystemFont, sans-serif";
    const mono = "'Geist Mono', ui-monospace, monospace";
    const VALUES = [20, 26, 24, 29, 35, 34, 41, 38, 49, 56, 53, 64, 70, 77];
    const THEMES = {
      dark: { bg: '#02030a', fg: '#F3F2EF', muted: '#8B8C96', axis: 'rgba(255,255,255,0.14)', thread: 0.78, stroke: ['#3d5bff', '#8fb4ff', '#f4f7ff'], area: [['#8fb4ff', 0.42], ['#3d5bff', 0.26], ['#1a1660', 0]], wash: 'rgba(143,180,255,0.07)', grain: 0.06 },
      light: { bg: '#F5F4F0', fg: '#121214', muted: '#6E6C67', axis: 'rgba(18,18,20,0.16)', thread: 0.7, stroke: ['#8fb4ff', '#3d5bff', '#1a1660'], area: [['#3d5bff', 0.3], ['#8fb4ff', 0.2], ['#8fb4ff', 0]], wash: 'rgba(255,255,255,0.7)', grain: 0.045 }
    };
    const th = p.theme === 'light' ? THEMES.light : THEMES.dark;
    const bg = String(p.background).toLowerCase() === DEFAULT_BG ? th.bg : String(p.background);
    const POP = -6;
    const POP_STAGGER = 2;
    const THREAD = [22, 64];
    const THICKEN = [62, 84];
    const BLOOM = 82;
    const SAMPLES = 16;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const easeIO = S.Easing.bezier(0.65, 0, 0.35, 1);
    const easeOut = S.Easing.bezier(0.22, 1, 0.36, 1);
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

    const W = view.width;
    const H = view.height;
    const u = H / 720;
    const L = W * 0.07;
    const R = W * 0.54;
    const T = H * 0.3;
    const B = H * 0.7;
    const base = H * 0.8;
    const lo = Math.min(...VALUES);
    const hi = Math.max(...VALUES);
    const pts: [number, number][] = VALUES.map((v, i) => [lerp(L, R, i / (VALUES.length - 1)), lerp(B, T, hi === lo ? 0.5 : (v - lo) / (hi - lo))]);

    const monotone = (ps: [number, number][]) => {
      const n = ps.length;
      const dx = ps.slice(1).map((q, i) => q[0] - ps[i][0]);
      const sl = ps.slice(1).map((q, i) => (q[1] - ps[i][1]) / dx[i]);
      const m = ps.map((_, i) => {
        if (i === 0) {
          return sl[0];
        }
        if (i === n - 1) {
          return sl[n - 2];
        }
        if (sl[i - 1] * sl[i] <= 0) {
          return 0;
        }
        return (2 * sl[i - 1] * sl[i]) / (sl[i - 1] + sl[i]);
      });
      const out: [number, number][] = [];
      for (let i = 0; i < n - 1; i++) {
        const [x0, y0] = ps[i];
        const y1 = ps[i + 1][1];
        const h = dx[i];
        for (let k = 0; k < SAMPLES; k++) {
          const s = k / SAMPLES;
          const s2 = s * s;
          const s3 = s2 * s;
          out.push([x0 + s * h, (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * m[i + 1]]);
        }
      }
      out.push(ps[n - 1]);
      return out;
    };
    const curve = monotone(pts);
    const cut = (x: number) => {
      const out: [number, number][] = [];
      for (let i = 0; i < curve.length; i++) {
        const [cx, cy] = curve[i];
        if (cx <= x) {
          out.push([cx, cy]);
          continue;
        }
        if (i > 0) {
          const [px, py] = curve[i - 1];
          out.push([x, py + (cy - py) * ((x - px) / (cx - px))]);
        }
        break;
      }
      return out;
    };
    const toD = (ps: [number, number][]) => ps.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');

    const parts = (() => {
      const m = metric.match(/^([^\d]*)([\d.,]+)(.*)$/);
      if (!m) {
        return null;
      }
      const n = Number.parseFloat(m[2].replace(/,/g, ''));
      if (!Number.isFinite(n)) {
        return null;
      }
      return { pre: m[1], n, post: m[3], decimals: (m[2].split('.')[1] ?? '').length, grouped: m[2].includes(',') };
    })();

    const last = pts[pts.length - 1];
    const metricX = R + W * 0.055;
    const numSize = 136 * u;
    const hair = Math.max(1, u);

    const fillGrad = S.h('linearGradient', { id: 'st-f', gradientUnits: 'userSpaceOnUse', x1: 0, y1: T, x2: 0, y2: base }, th.area.map(([c, o], i) => S.h('stop', { offset: i / (th.area.length - 1), stopColor: c, stopOpacity: o })));
    const strokeGrad = S.h('linearGradient', { id: 'st-s', gradientUnits: 'userSpaceOnUse', x1: L, y1: B, x2: R, y2: T }, th.stroke.map((c, i) => S.h('stop', { offset: i / (th.stroke.length - 1), stopColor: c })));
    const haloGrad = S.h('radialGradient', { id: 'st-h' }, S.h('stop', { offset: 0, stopColor: th.stroke[1], stopOpacity: 0.32 }), S.h('stop', { offset: 1, stopColor: th.stroke[1], stopOpacity: 0 }));
    const axis = S.h('line', { x1: L, y1: base, y2: base, stroke: th.axis, strokeWidth: hair }) as SVGElement;
    const ticks = pts.map(([x]) => S.h('line', { x1: x, y1: base, x2: x, y2: base + 7 * u, stroke: th.axis, strokeWidth: hair, opacity: 0 }) as SVGElement);
    const fillPath = S.h('path', { fill: 'url(#st-f)', opacity: 0 }) as SVGElement;
    const threadPath = S.h('path', { fill: 'none', stroke: th.fg, strokeOpacity: th.thread, strokeWidth: 1.3 * u, strokeLinecap: 'round', strokeLinejoin: 'round' }) as SVGElement;
    const thickPath = S.h('path', { fill: 'none', stroke: 'url(#st-s)', strokeWidth: 3.6 * u, strokeLinecap: 'round', strokeLinejoin: 'round' }) as SVGElement;
    const dots = pts.map(([x, y]) => S.h('circle', { cx: x, cy: y, r: 0, fill: th.fg, opacity: 0 }) as SVGElement);
    const headGlow = S.h('circle', { r: 16 * u, fill: 'url(#st-h)', opacity: 0 }) as SVGElement;
    const headDot = S.h('circle', { r: 2.6 * u, fill: th.fg, opacity: 0 }) as SVGElement;
    const bloomGlow = S.h('circle', { cx: last[0], cy: last[1], r: 30 * u, fill: 'url(#st-h)' }) as SVGElement;
    const ringEl = S.h('circle', { cx: last[0], cy: last[1], fill: 'none', stroke: accent, strokeWidth: 1.4 * u }) as SVGElement;
    const leaderEl = S.h('line', { x1: last[0] + 14 * u, y1: last[1], y2: last[1], stroke: th.fg, strokeOpacity: 0.3, strokeWidth: hair, strokeDasharray: `${2 * u} ${5 * u}`, strokeLinecap: 'round' }) as SVGElement;
    const endRing = S.h('circle', { cx: last[0], cy: last[1], fill: th.bg, stroke: th.stroke[2], strokeWidth: 3 * u }) as SVGElement;
    const endDot = S.h('circle', { cx: last[0], cy: last[1], fill: th.stroke[2] }) as SVGElement;
    const bloomG = S.h('g', { style: { display: 'none' } }, bloomGlow, ringEl, leaderEl, endRing, endDot) as SVGElement;
    const svg = S.h('svg', { width: W, height: H, style: { position: 'absolute', top: 0, left: 0 } }, S.h('defs', null, fillGrad, strokeGrad, haloGrad), axis, ticks, fillPath, threadPath, thickPath, dots, headGlow, headDot, bloomG);

    const wash = S.fill({}) as HTMLElement;
    const numEl = S.h('div', { style: { fontFamily: display, fontWeight: 400, fontSize: numSize, lineHeight: 1, letterSpacing: '-0.05em', color: th.fg, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } }) as HTMLElement;
    const labelEl = S.h('div', { style: { marginTop: 18 * u, marginLeft: 6 * u, fontFamily: mono, fontWeight: 400, fontSize: 18 * u, letterSpacing: '0.08em', textTransform: 'uppercase', color: th.muted, whiteSpace: 'nowrap' } }, String(p.label)) as HTMLElement;
    const block = S.h('div', { style: { position: 'absolute', left: metricX, top: last[1] - numSize * 0.52 } }, numEl, labelEl) as HTMLElement;
    const vignette = S.fill({ background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 60%, ${bg} 100%)`, opacity: 0.6 });
    const grain = S.h('svg', { width: '100%', height: '100%', style: { position: 'absolute', top: 0, left: 0, opacity: th.grain } },
      S.h('filter', { id: 'st-grain' }, S.h('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.9, numOctaves: 2, seed: 7, stitchTiles: 'stitch' }), S.h('feColorMatrix', { values: '0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 0' })),
      S.h('rect', { width: '100%', height: '100%', filter: 'url(#st-grain)' }));
    view.root.replaceChildren(S.fill({ background: bg, overflow: 'hidden' }, wash, svg, block, vignette, grain));

    const setPath = (el: SVGElement, ps: [number, number][], extra = '') => {
      el.style.display = ps.length > 1 ? '' : 'none';
      el.setAttribute('d', ps.length > 1 ? toD(ps) + extra : '');
    };

    return (at) => {
      const t = at * speed;
      const threadX = S.interpolate(t, THREAD, [L, R], { ...clamp, easing: easeIO });
      const thickX = S.interpolate(t, THICKEN, [L, R], { ...clamp, easing: easeIO });
      const threadPts = cut(threadX);
      const thickPts = cut(thickX);
      const head = threadPts[threadPts.length - 1] ?? pts[0];
      const headO = S.interpolate(t, [THREAD[0], THREAD[0] + 4], [0, 1], clamp) * S.interpolate(t, [THREAD[1] - 4, THREAD[1] + 2], [1, 0], clamp);
      const bloom = S.spring({ frame: t - BLOOM, fps: view.fps, config: { damping: 14, stiffness: 160, mass: 0.7 } });
      const ring = S.interpolate(t, [BLOOM, BLOOM + 28], [0, 1], { ...clamp, easing: easeOut });
      const leader = S.interpolate(t, [BLOOM + 2, BLOOM + 16], [0, 1], { ...clamp, easing: easeOut });
      const numIn = S.interpolate(t, [BLOOM + 6, BLOOM + 24], [0, 1], { ...clamp, easing: easeOut });
      const count = S.interpolate(t, [BLOOM + 6, BLOOM + 30], [0, 1], { ...clamp, easing: easeOut });
      const labIn = S.interpolate(t, [BLOOM + 16, BLOOM + 34], [0, 1], { ...clamp, easing: easeOut });
      const fillIn = S.interpolate(t, [THICKEN[0] + 6, THICKEN[1] + 10], [0, 1], clamp);
      const blooming = t >= BLOOM;

      const wx = blooming ? last[0] : head[0];
      const wy = blooming ? last[1] : head[1];
      wash.style.background = `radial-gradient(circle ${H * 0.55}px at ${wx}px ${wy}px, ${th.wash}, transparent 100%)`;

      axis.setAttribute('x2', String(S.interpolate(t, [0, 26], [lerp(L, R, 0.3), R], { ...clamp, easing: easeOut })));
      ticks.forEach((tick, i) => tick.setAttribute('opacity', String(S.interpolate(t, [POP + i * POP_STAGGER, POP + i * POP_STAGGER + 8], [0, 1], clamp))));

      const tail = thickPts.length > 1 ? thickPts[thickPts.length - 1] : pts[0];
      setPath(fillPath, thickPts, ` L${tail[0].toFixed(2)} ${base.toFixed(2)} L${L.toFixed(2)} ${base.toFixed(2)} Z`);
      fillPath.setAttribute('opacity', String(fillIn));
      setPath(threadPath, threadPts);
      setPath(thickPath, thickPts);

      dots.forEach((dot, i) => {
        const isLast = i === pts.length - 1;
        const x = pts[i][0];
        const delay = POP + i * POP_STAGGER;
        const pop = S.spring({ frame: t - delay, fps: view.fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
        const threaded = S.interpolate(threadX - x, [0, 2 * u, 40 * u], [0, 1, 0], clamp);
        const absorbed = isLast || t < THICKEN[0] ? 0 : S.interpolate(thickX - x, [-6 * u, 10 * u], [0, 1], clamp);
        const r = 4 * u * (0.5 + 0.5 * pop) * (1 + 0.45 * threaded) * (1 - absorbed);
        dot.style.display = isLast && blooming ? 'none' : '';
        dot.setAttribute('r', String(Math.max(0, r)));
        dot.setAttribute('fill', absorbed > 0 ? th.stroke[1] : th.fg);
        dot.setAttribute('opacity', String(S.interpolate(t, [delay, delay + 5], [0, 1], clamp)));
      });

      [headGlow, headDot].forEach((el) => {
        el.setAttribute('cx', String(head[0]));
        el.setAttribute('cy', String(head[1]));
        el.setAttribute('opacity', String(headO));
      });

      bloomG.style.display = blooming ? '' : 'none';
      bloomGlow.setAttribute('opacity', String(bloom));
      ringEl.setAttribute('r', String(lerp(8, 52, ring) * u));
      ringEl.setAttribute('opacity', String((1 - ring) * 0.75));
      leaderEl.setAttribute('x2', String(lerp(last[0] + 14 * u, metricX - 18 * u, leader)));
      endRing.setAttribute('r', String(lerp(4, 8, bloom) * u));
      endDot.setAttribute('r', String(lerp(0, 3, bloom) * u));

      numEl.textContent = parts
        ? `${parts.pre}${grouped(parts.n * count, parts.decimals, parts.grouped)}${parts.post}`
        : metric;
      block.style.opacity = String(numIn);
      block.style.transform = `translateX(${(1 - numIn) * -22 * u}px)`;
      labelEl.style.opacity = String(labIn);
      labelEl.style.transform = `translateY(${(1 - labIn) * 8 * u}px)`;
    };
  }
};

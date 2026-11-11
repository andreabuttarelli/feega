import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'share-donut',
  title: 'Share donut',
  about: 'A donut chart draws its segments in turn, then pulls one slice out and counts its percentage.',
  category: SnapcnCategory.Social,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 140,
  background: '#0A0A0B',
  fonts: ['DM Sans', 'Fraunces'],
  props: {
    theme: { type: 'string', title: 'Theme', enum: ['dark', 'light'], default: 'dark', group: 'Style' },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#3B5BFD', group: 'Style' },
    highlight: { type: 'number', title: 'Highlight', default: 0, minimum: 0, maximum: 10, step: 1, group: 'Content' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.25, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const accent = String(p.accent);
    const speed = Number(p.speed);
    const DEFAULT_BG = '#0a0a0b';
    const sans = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
    const display = "Fraunces, Georgia, serif";
    const THEMES = {
      dark: { bg: '#0A0A0B', fg: '#F3F2EF', muted: '#8B8A90', hair: 'rgba(255,255,255,0.22)', track: 'rgba(255,255,255,0.05)', grays: ['#B9B7B2', '#85848A', '#5C5B61', '#3E3D43'], halo: ['#E2457A', '#FFB36B'], haze: ['rgba(226,69,122,0.12)', 'rgba(61,77,255,0.09)'], grain: 0.06 },
      light: { bg: '#F5F4F0', fg: '#121214', muted: '#6E6C67', hair: 'rgba(18,18,20,0.22)', track: 'rgba(18,18,20,0.05)', grays: ['#4F4D49', '#85837E', '#AEACA6', '#D0CEC8'], halo: ['#E2457A', '#FF9A4D'], haze: ['rgba(226,69,122,0.08)', 'rgba(61,77,255,0.05)'], grain: 0.045 }
    };
    const th = p.theme === 'light' ? THEMES.light : THEMES.dark;
    const bg = String(p.background).toLowerCase() === DEFAULT_BG ? th.bg : String(p.background);
    const SEGMENTS = [{ label: 'feega', value: 38 }, { label: 'Kitebase', value: 24 }, { label: 'Lumen', value: 17 }, { label: 'Fernway', value: 12 }, { label: 'Other', value: 9 }];
    const DRAW_START = 6;
    const DRAW_LEN = 52;
    const MIN_DUR = 9;
    const TAU = Math.PI * 2;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const easeIO = S.Easing.bezier(0.65, 0, 0.35, 1);
    const easeOut = S.Easing.bezier(0.22, 1, 0.36, 1);
    const easeSeg = S.Easing.bezier(0.55, 0, 0.25, 1);

    const u = Math.min(view.width / 1280, view.height / 720);
    const cx = view.width / 2;
    const cy = view.height / 2;
    const R = view.height * 0.3;
    const sw = 12 * u;
    const gapA = (6 * u) / R;
    const hl = Math.min(Math.max(0, Math.round(Number(p.highlight))), SEGMENTS.length - 1);
    const total = SEGMENTS.reduce((s, x) => s + x.value, 0);

    const pt = (r: number, a: number) => ({ x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) });
    const arc = (r: number, a0: number, a1: number) => {
      const s = pt(r, a0);
      const e = pt(r, a1);
      return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
    };

    let acc = 0;
    let grayIdx = 0;
    let clock = DRAW_START;
    const segs = SEGMENTS.map((s, i) => {
      const frac = s.value / total;
      const a0 = acc * TAU;
      acc += frac;
      const a1 = acc * TAU;
      const dur = Math.max(MIN_DUR, DRAW_LEN * frac);
      const start = clock;
      clock += dur - 2;
      const color = i === hl ? accent : th.grays[Math.min(grayIdx++, 3)];
      return { ...s, i, a0: a0 + gapA / 2, a1: a1 - gapA / 2, mid: (a0 + a1) / 2, start, end: start + dur, color, pct: Math.round(frac * 100) };
    });
    const hit = segs[segs.length - 1].end + 8;
    const target = segs[hl];

    const g0 = pt(R, target.a0);
    const g1 = pt(R, target.a1);
    const gradient = S.h('linearGradient', { id: 'sd-halo', gradientUnits: 'userSpaceOnUse', x1: g0.x, y1: g0.y, x2: g1.x, y2: g1.y },
      S.h('stop', { offset: 0, stopColor: accent }), S.h('stop', { offset: 0.58, stopColor: th.halo[0] }), S.h('stop', { offset: 1, stopColor: th.halo[1] }));
    const track = S.h('circle', { cx, cy, r: R, fill: 'none', stroke: th.track, strokeWidth: sw }) as SVGElement;
    const paths = segs.map((s) => S.h('path', { fill: 'none', stroke: s.i === hl ? 'url(#sd-halo)' : s.color, strokeLinecap: s.i === hl ? 'round' : 'butt', style: { display: 'none' } }) as SVGElement);
    const ticks = segs.map(() => S.h('line', { stroke: th.hair, strokeWidth: Math.max(1, u), opacity: 0 }) as SVGElement);
    const spinG = S.h('g', null, track, paths, ticks) as SVGElement;
    const svg = S.h('svg', { width: view.width, height: view.height, style: { position: 'absolute', top: 0, left: 0 } }, S.h('defs', null, gradient), spinG) as SVGElement;

    const labels = segs.map((s) => {
      const pctEl = S.h('span', { style: { fontFamily: sans, fontWeight: 500, fontSize: 22 * u, letterSpacing: '-0.02em', color: th.fg, fontVariantNumeric: 'tabular-nums' } }, `${s.pct}%`);
      const nameEl = S.h('span', { style: { fontFamily: sans, fontWeight: 400, fontSize: 15 * u, color: th.muted } }, s.label);
      return S.h('div', { style: { position: 'absolute', display: 'flex', flexDirection: 'column', gap: 2 * u, whiteSpace: 'nowrap', opacity: 0 } }, pctEl, nameEl) as HTMLElement;
    });

    const numEl = S.h('span') as HTMLElement;
    const bigEl = S.h('div', { style: { fontFamily: display, fontWeight: 300, fontSize: 176 * u, lineHeight: 0.9, letterSpacing: '-0.035em', color: th.fg, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', marginTop: 10 * u } }, numEl, S.h('span', { style: { fontSize: 92 * u, fontStyle: 'italic', letterSpacing: '-0.02em', marginLeft: 4 * u, color: th.muted } }, '%')) as HTMLElement;
    const nameRow = S.h('div', { style: { marginTop: 14 * u, display: 'flex', alignItems: 'center', gap: 10 * u } },
      S.h('span', { style: { width: 10 * u, height: 10 * u, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, ${th.halo[0]}, ${th.halo[1]})` } }),
      S.h('span', { style: { fontFamily: sans, fontWeight: 400, fontSize: 22 * u, letterSpacing: '-0.01em', color: th.muted, whiteSpace: 'nowrap' } }, target.label)
    ) as HTMLElement;

    const haze = S.fill({ background: `radial-gradient(circle at 50% 50%, transparent ${R * 0.62}px, ${th.haze[0]} ${R * 1.02}px, ${th.haze[1]} ${R * 1.3}px, transparent ${R * 1.85}px)` }) as HTMLElement;
    const scene = S.fill({ transformOrigin: '50% 50%' }, svg, labels, S.fill({ alignItems: 'center', justifyContent: 'center' }, bigEl, nameRow)) as HTMLElement;
    const vignette = S.fill({ background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 62%, ${bg} 100%)`, opacity: 0.6 });
    const grain = S.h('svg', { width: '100%', height: '100%', style: { position: 'absolute', top: 0, left: 0, opacity: th.grain } },
      S.h('filter', { id: 'sd-grain' }, S.h('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.9, numOctaves: 2, seed: 29, stitchTiles: 'stitch' }), S.h('feColorMatrix', { values: '0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 0' })),
      S.h('rect', { width: '100%', height: '100%', filter: 'url(#sd-grain)' }));
    view.root.replaceChildren(S.fill({ background: bg, overflow: 'hidden' }, haze, scene, vignette, grain));

    return (at) => {
      const t = at * speed;
      const detach = S.spring({ frame: t - hit, fps: view.fps, config: { damping: 15, stiffness: 150, mass: 0.7 } });
      const dim = S.interpolate(t, [hit, hit + 16], [0, 1], { ...clamp, easing: easeIO });
      const land = S.interpolate(t, [hit + 4, hit + 24], [0, 1], { ...clamp, easing: easeOut });
      const count = S.interpolate(t, [hit + 4, hit + 30], [0.55, 1], { ...clamp, easing: easeOut });
      const labIn = S.interpolate(t, [hit + 12, hit + 30], [0, 1], { ...clamp, easing: easeOut });
      const stage = S.interpolate(t, [0, 10], [0.4, 1], clamp);
      const spin = S.interpolate(t, [0, hit + 10], [-14, 0], { ...clamp, easing: easeIO });
      const push = S.interpolate(t, [0, hit + 60], [0, 1], { ...clamp, easing: easeIO });
      const off = detach * 18 * u;

      haze.style.opacity = String(0.25 + 0.75 * land);
      haze.style.transform = `rotate(${spin}deg)`;
      scene.style.transform = `scale(${0.97 + 0.04 * push})`;
      svg.style.opacity = String(stage);
      spinG.setAttribute('transform', `rotate(${spin} ${cx} ${cy})`);
      track.setAttribute('opacity', String(1 - dim));

      segs.forEach((s, i) => {
        const isHl = i === hl;
        const k = S.interpolate(t, [s.start, s.end], [0, 1], { ...clamp, easing: easeSeg });
        const path = paths[i];
        path.style.display = k > 0 && s.a1 > s.a0 ? '' : 'none';
        path.setAttribute('d', arc(R, s.a0, s.a0 + (s.a1 - s.a0) * k));
        path.setAttribute('stroke-width', String(isHl ? sw * (1 + 0.5 * detach) : sw));
        path.setAttribute('opacity', String(isHl ? 1 : 1 - 0.5 * dim));
        if (isHl) {
          path.setAttribute('transform', `translate(${Math.sin(s.mid) * off} ${-Math.cos(s.mid) * off})`);
        }

        const a = S.interpolate(t, [s.end - 6, s.end + 8], [0, 1], { ...clamp, easing: easeOut });
        const p0 = pt(R + sw / 2 + 8 * u, s.mid);
        const p1 = pt(R + sw / 2 + 8 * u + 14 * u * a, s.mid);
        const tick = ticks[i];
        tick.setAttribute('x1', String(p0.x));
        tick.setAttribute('y1', String(p0.y));
        tick.setAttribute('x2', String(p1.x));
        tick.setAttribute('y2', String(p1.y));
        tick.setAttribute('opacity', String(a * (isHl ? 1 - dim : 1 - 0.55 * dim)));

        const la = S.interpolate(t, [s.end - 4, s.end + 12], [0, 1], { ...clamp, easing: easeOut });
        const ang = s.mid + (spin * Math.PI) / 180;
        const q = pt(R + sw / 2 + 38 * u + (1 - la) * -8 * u, ang);
        const right = Math.sin(ang) >= -0.05;
        const el = labels[i];
        el.style.left = `${q.x}px`;
        el.style.top = `${q.y}px`;
        el.style.transform = `translate(${right ? 0 : -100}%, -50%)`;
        el.style.alignItems = right ? 'flex-start' : 'flex-end';
        el.style.opacity = String(la * (isHl ? 1 - dim : 1 - 0.6 * dim) * stage);
      });

      numEl.textContent = String(Math.round(target.pct * count));
      bigEl.style.opacity = String(land);
      bigEl.style.filter = land < 0.99 ? `blur(${(1 - land) * 8 * u}px)` : '';
      bigEl.style.transform = `translateY(${(1 - land) * 22 * u}px) scale(${1.05 - 0.05 * land})`;
      nameRow.style.opacity = String(labIn);
      nameRow.style.transform = `translateY(${(1 - labIn) * 8 * u}px)`;
    };
  }
};

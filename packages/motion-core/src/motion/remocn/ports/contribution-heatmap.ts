import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'contribution-heatmap',
  title: 'Contribution heatmap',
  about: 'A year-long activity grid sweeps in cell by cell, then dims behind a big counted total.',
  category: SnapcnCategory.Social,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#0A0A0B',
  fonts: ['Geist', 'Geist Mono'],
  props: {
    theme: { type: 'string', title: 'Theme', enum: ['dark', 'light'], default: 'dark', group: 'Style' },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#3B5BFD', group: 'Style' },
    label: { type: 'string', title: 'Label', default: 'renders this year', group: 'Content', maxLength: 60 },
    value: { type: 'number', title: 'Value', default: 12480, minimum: 0, maximum: 37440, step: 1, group: 'Content' },
    weeks: { type: 'number', title: 'Weeks', default: 52, minimum: 0, maximum: 156, step: 1, group: 'Content' },
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
    const value = Number(p.value);
    const speed = Number(p.speed);
    const DEFAULT_BG = '#0a0a0b';
    const sans = "Geist, -apple-system, BlinkMacSystemFont, sans-serif";
    const mono = "'Geist Mono', ui-monospace, monospace";
    const THEMES = {
      dark: { bg: '#0A0A0B', fg: '#F3F2EF', muted: '#8B8A90', empty: 'rgba(255,255,255,0.055)', ramp: ['#7E9BFF', '#F4F7FF'], toward: [18, 22, 64], levels: [0.68, 0.46, 0.22, 0], glow: 'rgba(61,91,255,0.20)', ground: 'rgba(61,91,255,0.14)', dim: 0.42, grain: 0.06 },
      light: { bg: '#F5F4F0', fg: '#121214', muted: '#6E6C67', empty: 'rgba(18,18,20,0.06)', ramp: ['#7A3CFF', '#FF4FB8'], toward: [245, 244, 240], levels: [0.74, 0.52, 0.28, 0], glow: 'rgba(122,60,255,0.10)', ground: 'rgba(255,79,184,0.06)', dim: 0.36, grain: 0.045 }
    };
    const th = p.theme === 'light' ? THEMES.light : THEMES.dark;
    const bg = String(p.background).toLowerCase() === DEFAULT_BG ? th.bg : String(p.background);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    const SWEEP_START = 4;
    const SWEEP_END = 50;
    const CELL_IN = 10;
    const HIT = 62;
    const DIAG = 2.4;
    const ROWS = 7;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const easeIO = S.Easing.bezier(0.65, 0, 0.35, 1);
    const easeOut = S.Easing.bezier(0.22, 1, 0.36, 1);
    const easePop = S.Easing.bezier(0.3, 1.25, 0.6, 1);

    const u = Math.min(view.width / 1280, view.height / 720);
    const cols = Math.max(4, Math.round(Number(p.weeks)));
    const pitch = Math.min((view.width * 0.8) / cols, 34 * u);
    const cell = pitch * 0.8;
    const radius = cell * 0.26;
    const gridW = cols * pitch - (pitch - cell);
    const gridH = ROWS * pitch - (pitch - cell);
    const gx = (view.width - gridW) / 2;
    const gy = view.height / 2 - gridH / 2;
    const span = cols + 6 * DIAG;

    const rgb = (hex: string) => {
      const m = /^#([0-9a-f]{6})$/i.exec(hex);
      if (!m) {
        return null;
      }
      const v = Number.parseInt(m[1], 16);
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    };
    const mix = (hex: string, toward: number[], amt: number) => {
      const a = rgb(hex);
      if (!a) {
        return hex;
      }
      const c = a.map((v, i) => Math.round(v + (toward[i] - v) * amt));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    };
    const hash = (a: number, b: number, seed: number) => {
      let x = Math.imul(a + 1, 374761393) ^ Math.imul(b + 7, 668265263) ^ seed;
      x = Math.imul(x ^ (x >>> 13), 1274126177);
      x ^= x >>> 16;
      return (x >>> 0) / 4294967295;
    };
    const levelOf = (week: number, day: number) => {
      const r = hash(week, day, 0x51ed);
      const trend = 0.42 + 0.58 * (week / Math.max(1, cols - 1)) ** 0.8;
      const weekend = day === 0 || day === 6 ? 0.42 : 1;
      const quiet = hash(week, 99, 0x2b1) > 0.9 ? 0.3 : 1;
      const burst = hash(week, day, 0x9e37) > 0.94 ? 0.45 : 0;
      const a = r * trend * weekend * quiet + burst;
      if (a < 0.12) {
        return 0;
      }
      if (a < 0.28) {
        return 1;
      }
      if (a < 0.47) {
        return 2;
      }
      if (a < 0.67) {
        return 3;
      }
      return 4;
    };

    const flashColor = th === THEMES.dark ? mix(accent, [255, 255, 255], 0.6) : accent;
    const gradients = th.levels.map((amt, i) =>
      S.h('linearGradient', { id: `hm-grad-${i}`, gradientUnits: 'userSpaceOnUse' },
        S.h('stop', { offset: 0, stopColor: mix(accent, th.toward, amt) }),
        S.h('stop', { offset: 0.6, stopColor: mix(th.ramp[0], th.toward, amt) }),
        S.h('stop', { offset: 0.86, stopColor: mix(th.ramp[1], th.toward, amt * 0.9 + 0.12) }),
        S.h('stop', { offset: 1, stopColor: mix(th.ramp[1], th.toward, amt) })
      ) as SVGElement
    );

    const cells: { lv: number; s0: number; x: number; y: number; fillEl: SVGElement; flashEl: SVGElement }[] = [];
    const cellNodes: Element[] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < ROWS; r++) {
        const lv = levelOf(c, r);
        const x = gx + c * pitch;
        const y = gy + r * pitch;
        const empty = S.h('rect', { x, y, width: cell, height: cell, rx: radius, fill: th.empty });
        const fillEl = S.h('rect', { rx: radius, fill: lv > 0 ? `url(#hm-grad-${lv - 1})` : 'none', opacity: 0, style: { display: 'none' } }) as SVGElement;
        const flashEl = S.h('rect', { rx: radius, fill: flashColor, opacity: 0, style: { display: 'none' } }) as SVGElement;
        cells.push({ lv, s0: SWEEP_START + ((c + r * DIAG) / span) * (SWEEP_END - SWEEP_START), x, y, fillEl, flashEl });
        cellNodes.push(empty, fillEl, flashEl);
      }
    }

    const grainId = 'hm-grain';
    const grain = S.h('svg', { width: '100%', height: '100%', style: { position: 'absolute', top: 0, left: 0, opacity: th.grain } },
      S.h('filter', { id: grainId }, S.h('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.9, numOctaves: 2, seed: 17, stitchTiles: 'stitch' }), S.h('feColorMatrix', { values: '0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 0' })),
      S.h('rect', { width: '100%', height: '100%', filter: `url(#${grainId})` })
    );

    const monthEls = MONTHS.map((m, i) => S.h('div', { style: { position: 'absolute', left: gx + Math.round((i * cols) / 12) * pitch, top: gy - 30 * u, fontFamily: mono, fontWeight: 400, fontSize: 12 * u, letterSpacing: '0.06em', textTransform: 'uppercase', color: th.muted, opacity: 0 } }, m) as HTMLElement);
    const dayEls = DAYS.map((d, r) => (d ? S.h('div', { style: { position: 'absolute', right: view.width - gx + 14 * u, top: gy + r * pitch + cell / 2 - 8 * u, fontFamily: mono, fontWeight: 400, fontSize: 12 * u, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: `${16 * u}px`, color: th.muted, opacity: 0 } }, d) as HTMLElement : null));

    const svg = S.h('svg', { width: view.width, height: view.height, style: { position: 'absolute', top: 0, left: 0 } }, S.h('defs', null, gradients), cellNodes);
    const gridLayer = S.fill({ transformOrigin: '50% 50%' }, svg, monthEls, dayEls) as HTMLElement;
    const ground = S.fill({}) as HTMLElement;
    const glow = S.fill({ background: `radial-gradient(ellipse 46% 34% at 50% 36%, ${th.glow}, transparent 72%)` }) as HTMLElement;
    const valueEl = S.h('div', { style: { fontFamily: sans, fontWeight: 400, fontSize: 200 * u, lineHeight: 0.92, letterSpacing: '-0.04em', color: th.fg, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } }) as HTMLElement;
    const labelEl = S.h('div', { style: { marginTop: 22 * u, display: 'flex', alignItems: 'center', gap: 12 * u } },
      S.h('span', { style: { width: 44 * u, height: 12 * u, borderRadius: 4 * u, background: `linear-gradient(90deg, ${accent}, ${th.ramp[0]} 62%, ${th.ramp[1]})` } }),
      S.h('span', { style: { fontFamily: sans, fontWeight: 400, fontSize: 24 * u, letterSpacing: '-0.015em', color: th.muted, whiteSpace: 'nowrap' } }, String(p.label))
    ) as HTMLElement;
    const stat = S.fill({ alignItems: 'center', justifyContent: 'center', transform: `translateY(${-0.15 * view.height}px)` }, valueEl, labelEl);
    const vignette = S.fill({ background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 62%, ${bg} 100%)`, opacity: 0.6 });
    view.root.replaceChildren(S.fill({ background: bg, overflow: 'hidden' }, ground, gridLayer, glow, stat, vignette, grain));

    return (at) => {
      const t = at * speed;
      const stage = S.interpolate(t, [0, 8], [0.45, 1], clamp);
      const settle = S.interpolate(t, [HIT - 4, HIT + 22], [0, 1], { ...clamp, easing: easeIO });
      const drift = S.interpolate(t, [0, HIT + 60], [0, 1], { ...clamp, easing: easeIO });
      const zoom = S.interpolate(t, [0, HIT - 2], [1.12, 1], { ...clamp, easing: easeIO });
      const gridBlur = 0.9 * u * settle;
      const axisO = S.interpolate(t, [2, 14], [0, 1], { ...clamp, easing: easeOut }) * S.interpolate(t, [HIT - 4, HIT + 6], [1, 0], clamp);
      const land = S.interpolate(t, [HIT + 6, HIT + 26], [0, 1], { ...clamp, easing: easeOut });
      const count = S.interpolate(t, [HIT + 6, HIT + 34], [0.8, 1], { ...clamp, easing: easeOut });
      const labIn = S.interpolate(t, [HIT + 14, HIT + 32], [0, 1], { ...clamp, easing: easeOut });

      ground.style.background = `radial-gradient(70% 55% at ${58 + 10 * drift}% 108%, ${th.ground}, transparent 72%)`;
      gridLayer.style.transform = `translate(${(0.5 - drift) * 14 * u}px, ${settle * 0.16 * view.height}px) scale(${zoom * (1 - 0.1 * settle)})`;
      gridLayer.style.opacity = String(stage * (1 - th.dim * settle));
      gridLayer.style.filter = gridBlur > 0.05 ? `blur(${gridBlur}px)` : '';

      gradients.forEach((grad) => {
        grad.setAttribute('x1', String(gx - gridW * 0.08 * (1 - drift)));
        grad.setAttribute('y1', String(gy + gridH));
        grad.setAttribute('x2', String(gx + gridW * (1.02 - 0.06 * drift)));
        grad.setAttribute('y2', String(gy));
      });

      cells.forEach((c) => {
        const k = S.interpolate(t, [c.s0, c.s0 + CELL_IN], [0, 1], clamp);
        const pop = easePop(k);
        const flash = S.interpolate(t - c.s0, [0, 3, 13], [0, 1, 0], clamp);
        const sz = cell * (0.66 + 0.34 * pop);
        const off = (cell - sz) / 2;
        const showFill = c.lv > 0 && k > 0;
        const showFlash = flash > 0.01;
        c.fillEl.style.display = showFill ? '' : 'none';
        c.flashEl.style.display = showFlash ? '' : 'none';
        [[showFill, c.fillEl, easeOut(k)], [showFlash, c.flashEl, flash * (c.lv > 0 ? 0.75 : 0.18)]].forEach(([on, el, opacity]) => {
          if (!on) {
            return;
          }
          const node = el as SVGElement;
          node.setAttribute('x', String(c.x + off));
          node.setAttribute('y', String(c.y + off));
          node.setAttribute('width', String(sz));
          node.setAttribute('height', String(sz));
          node.setAttribute('rx', String(radius * (sz / cell)));
          node.setAttribute('opacity', String(opacity));
        });
      });

      monthEls.forEach((el, i) => {
        const a = S.interpolate(t, [2 + i * 1.5, 14 + i * 1.5], [0, 1], { ...clamp, easing: easeOut });
        el.style.opacity = String(a * axisO);
        el.style.transform = `translateY(${(1 - a) * 6 * u}px)`;
      });
      dayEls.forEach((el) => {
        if (el) {
          el.style.opacity = String(axisO);
        }
      });

      glow.style.opacity = String(land);
      valueEl.textContent = grouped(Math.round(value * count));
      valueEl.style.opacity = String(land);
      valueEl.style.filter = land < 0.99 ? `blur(${(1 - land) * 10 * u}px)` : '';
      valueEl.style.transform = `translateY(${(1 - land) * 28 * u}px) scale(${1.04 - 0.04 * land})`;
      labelEl.style.opacity = String(labIn);
      labelEl.style.transform = `translateY(${(1 - labIn) * 10 * u}px)`;
    };
  }
};

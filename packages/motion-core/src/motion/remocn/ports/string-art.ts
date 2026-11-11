import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'string-art',
  title: 'String art',
  about: 'Threads strung between pins on a ring draw a times-table curve that morphs from cardioid to epicycloid, with an accent sweep.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 340,
  background: '#111111',
  fonts: [],
  props: {
    pins: { type: 'number', title: 'Pins', default: 200, minimum: 40, maximum: 400, step: 10, group: 'Content' },
    from: { type: 'number', title: 'From multiplier', default: 2, minimum: 1, maximum: 12, step: 0.5, group: 'Content' },
    to: { type: 'number', title: 'To multiplier', default: 4, minimum: 1, maximum: 12, step: 0.5, group: 'Content' },
    showLabel: { type: 'boolean', title: 'Label', default: true, group: 'Content' },
    threadOpacity: { type: 'number', title: 'Thread opacity', default: 0.42, minimum: 0.1, maximum: 1, step: 0.02, group: 'Style' },
    color: { type: 'string', title: 'Threads', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    morphFrames: { type: 'number', title: 'Morph frames', default: 240, minimum: 30, maximum: 600, step: 10, group: 'Motion' },
    sweep: { type: 'number', title: 'Accent sweep', default: 0.08, minimum: 0, maximum: 0.3, step: 0.01, group: 'Motion' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const TAU = Math.PI * 2;
    const MORPH_DELAY = 24;
    const HOLD = 0.3;
    const SWEEP_BUCKETS = 4;
    const STRING_FRAMES = 60;
    const SWEEP_SPEED = 0.9;
    const n = Math.max(8, Math.round(Number(p.pins)));
    const from = Number(p.from);
    const to = Number(p.to);
    const sweep = Number(p.sweep);
    const speed = Number(p.speed);
    const morphFrames = Math.max(1, Number(p.morphFrames));
    const color = String(p.color);
    const accent = String(p.accent);
    const unit = Math.min(W, H) / 720;
    const radius = Math.min(W, H) * 0.42;
    const cx = W / 2;
    const cy = H / 2;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const fmt = (v: number) => Math.round(v * 10) / 10;
    const point = (index: number) => {
      const a = Math.PI + (TAU * index) / n;
      return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
    };
    const xy = (pt: { x: number; y: number }) => `${fmt(pt.x)} ${fmt(pt.y)}`;

    const pr = 1.6 * unit;
    let pinDots = '';
    for (let i = 0; i < n; i++) {
      const { x, y } = point(i);
      pinDots += `M ${fmt(x - pr)} ${fmt(y)} a ${fmt(pr)} ${fmt(pr)} 0 1 0 ${fmt(pr * 2)} 0 a ${fmt(pr)} ${fmt(pr)} 0 1 0 ${fmt(-pr * 2)} 0 `;
    }

    const pinsPath = S.h('path', { d: pinDots, fill: color });
    const threadsPath = S.h('path', { fill: 'none', stroke: color, strokeOpacity: Number(p.threadOpacity), strokeWidth: unit, strokeLinecap: 'round' });
    const accentPaths = Array.from({ length: SWEEP_BUCKETS }, (_, b) => S.h('path', { fill: 'none', stroke: accent, strokeLinecap: 'round', strokeOpacity: 1 - b / SWEEP_BUCKETS, strokeWidth: unit * (1.6 - b * 0.15) }));
    const svg = S.h('svg', { width: '100%', height: '100%', viewBox: `0 0 ${W} ${H}`, style: { display: 'block' } }, pinsPath, threadsPath, S.h('g', null, accentPaths));
    const label = S.h('div', { style: { position: 'absolute', left: W * 0.06, bottom: H * 0.08, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 22 * unit, letterSpacing: '0.04em', color, fontVariantNumeric: 'tabular-nums' } }) as HTMLElement;
    view.root.replaceChildren(S.fill({}, svg, p.showLabel ? label : null));

    return (at) => {
      const time = at * speed;
      const strung = S.interpolate(time, [0, STRING_FRAMES], [0, n], { ...clamped, easing: S.Easing.inOut(S.Easing.quad) });
      const morphStart = STRING_FRAMES + MORPH_DELAY;
      const span = to - from;
      const steps = Math.max(1, Math.ceil(Math.abs(span) - 1e-6));
      const u = S.interpolate(time, [morphStart, morphStart + morphFrames], [0, steps], clamped) - 1e-9;
      const step = Math.max(0, Math.floor(u));
      const within = S.Easing.inOut(S.Easing.cubic)(Math.min(1, Math.max(0, (u - step) / (1 - HOLD))));
      const k = from + (span * Math.min(steps, step + within)) / steps;

      let threads = '';
      const accents: string[] = new Array(SWEEP_BUCKETS).fill('');
      const whole = Math.floor(strung);
      const head = strung + Math.max(0, time - STRING_FRAMES) * SWEEP_SPEED;
      const tail = Math.max(0, sweep) * n;
      for (let i = 0; i < Math.ceil(strung); i++) {
        const start = point(i);
        const end = point(k * i);
        const f = i < whole ? 1 : strung - whole;
        const tip = { x: start.x + (end.x - start.x) * f, y: start.y + (end.y - start.y) * f };
        const d = `M ${xy(start)} L ${xy(tip)} `;
        const behind = (((head - i) % n) + n) % n;
        if (tail > 0 && behind < tail) {
          accents[Math.min(SWEEP_BUCKETS - 1, Math.floor((behind / tail) * SWEEP_BUCKETS))] += d;
        } else {
          threads += d;
        }
      }
      threadsPath.setAttribute('d', threads);
      accentPaths.forEach((el, b) => el.setAttribute('d', accents[b]));
      pinsPath.setAttribute('fill-opacity', String(0.55 * S.interpolate(time, [0, 12], [0, 1], clamped)));
      label.style.opacity = String(0.7 * S.interpolate(time, [STRING_FRAMES - 10, STRING_FRAMES + 6], [0, 1], clamped));
      label.replaceChildren(S.h('span', { style: { color: accent } }, 'i → '), `${k.toFixed(2)} · i mod ${n}`);
    };
  }
};

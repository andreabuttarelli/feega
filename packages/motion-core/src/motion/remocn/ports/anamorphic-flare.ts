import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'anamorphic-flare',
  title: 'Anamorphic flare',
  about: 'A cinematic horizontal light streak with ghost orbs sweeps across the frame and wipes in a logo lockup.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 70,
  background: '#111111',
  fonts: [],
  props: {
    text: { type: 'string', title: 'Lockup text', default: 'feega', group: 'Content', maxLength: 40 },
    ghosts: { type: 'number', title: 'Ghosts', default: 4, minimum: 0, maximum: 8, step: 1, group: 'Style' },
    y: { type: 'number', title: 'Streak height', default: 0.5, minimum: 0.1, maximum: 0.9, step: 0.01, group: 'Style' },
    seed: { type: 'number', title: 'Seed', default: 2, minimum: 1, maximum: 99, step: 1, group: 'Style' },
    tint: { type: 'string', title: 'Tint', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    coreColor: { type: 'string', title: 'Core', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const speed = Math.max(0, Number(p.speed));
    const tint = String(p.tint);
    const coreColor = String(p.coreColor);
    const bg = String(p.background);
    const seed = Number(p.seed);
    const count = Math.max(0, Math.round(Number(p.ghosts)));
    const IGNITE = 6;
    const CROSS_START = 4;
    const CROSS_END = 26;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const cy = Number(p.y) * height;
    const cx = width / 2;
    const coreH = Math.max(2, height * 0.004);
    const glowH = height * 0.05;
    const soft = width * 0.08;
    const NS = 'anamorphic-flare';

    const ghostList = Array.from({ length: count }, (_, i) => ({
      k: -1.3 + S.random(`${NS}-${seed}-${i}-k`) * 2.2,
      r: height * (0.025 + 0.07 * S.random(`${NS}-${seed}-${i}-r`)),
      o: 0.12 + 0.18 * S.random(`${NS}-${seed}-${i}-o`),
      dy: (S.random(`${NS}-${seed}-${i}-y`) - 0.5) * height * 0.05
    }));

    const stops = (id: string, color: string) => S.h('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 0 }, S.h('stop', { offset: 0, stopColor: color, stopOpacity: 0 }), S.h('stop', { offset: 0.5, stopColor: color, stopOpacity: 1 }), S.h('stop', { offset: 1, stopColor: color, stopOpacity: 0 }));
    const trailRect = S.h('rect', { x: 0, y: cy - 1, width, height: 2, fill: `url(#${NS}-trail)` });
    const under = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, S.h('defs', null, stops(`${NS}-trail`, tint)), trailRect);

    const mark = S.h('div', { style: { width: 120, height: 120, borderRadius: 32, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, S.h('div', { style: { width: 36, height: 36, borderRadius: '50%', background: bg } }));
    const word = S.h('span', { style: { fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 104, fontWeight: 800, letterSpacing: '-0.04em', color: coreColor } }, String(p.text));
    const lockup = S.fill({ alignItems: 'center', justifyContent: 'center' }, S.h('div', { style: { display: 'flex', alignItems: 'center', gap: 28 } }, mark, word)) as HTMLElement;

    const glow = S.h('rect', { y: cy - glowH / 2, height: glowH, fill: `url(#${NS}-trail)`, opacity: 0.55, filter: `url(#${NS}-blur)` });
    const core = S.h('rect', { y: cy - coreH / 2, height: coreH, fill: `url(#${NS}-core)` });
    const bloom = S.h('ellipse', { cy, rx: height * 0.16, ry: height * 0.1, fill: `url(#${NS}-bloom)` });
    const ghostNodes = ghostList.map((g) => S.h('circle', { r: g.r, fill: `url(#${NS}-ghost)`, opacity: g.o * 2 }));
    const group = S.h('g', null, glow, core, bloom, ...ghostNodes);
    const defs = S.h('defs', null,
      stops(`${NS}-core`, coreColor),
      S.h('radialGradient', { id: `${NS}-bloom` }, S.h('stop', { offset: 0, stopColor: coreColor, stopOpacity: 1 }), S.h('stop', { offset: 0.25, stopColor: tint, stopOpacity: 0.7 }), S.h('stop', { offset: 1, stopColor: tint, stopOpacity: 0 })),
      S.h('radialGradient', { id: `${NS}-ghost` }, S.h('stop', { offset: 0, stopColor: tint, stopOpacity: 0.15 }), S.h('stop', { offset: 0.8, stopColor: tint, stopOpacity: 0.5 }), S.h('stop', { offset: 1, stopColor: tint, stopOpacity: 0 })),
      S.h('filter', { id: `${NS}-blur`, x: -width, y: -height, width: width * 3, height: height * 3, filterUnits: 'userSpaceOnUse' }, S.h('feGaussianBlur', { stdDeviation: glowH * 0.35 })));
    const over = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0, mixBlendMode: 'screen' } }, defs, group);
    view.root.replaceChildren(under, lockup, over);

    return (at) => {
      const t = at * speed;
      const head = S.interpolate(t, [CROSS_START, CROSS_END], [0.07, 1.12], { ...clamp, easing: S.Easing.bezier(0.45, 0, 0.4, 1) });
      const hx = head * width;
      const ignite = S.interpolate(t, [0, IGNITE], [0, 1], { ...clamp, easing: S.Easing.out(S.Easing.cubic) });
      const fade = S.interpolate(t, [CROSS_END - 6, CROSS_END + 2], [1, 0], clamp);
      const streakLen = width * S.interpolate(t, [0, 12], [0.04, 1.3], { ...clamp, easing: S.Easing.out(S.Easing.quad) });
      const residual = S.interpolate(t, [CROSS_END - 2, CROSS_END + 14], [0, 0.14], clamp);
      const mask = `linear-gradient(90deg, #000 0px, #000 ${hx - soft}px, transparent ${hx}px)`;

      trailRect.setAttribute('opacity', String(residual));
      lockup.style.maskImage = mask;
      lockup.style.webkitMaskImage = mask;
      group.setAttribute('opacity', String(ignite * fade));
      glow.setAttribute('x', String(hx - streakLen * 0.45));
      glow.setAttribute('width', String(streakLen * 0.9));
      core.setAttribute('x', String(hx - streakLen / 2));
      core.setAttribute('width', String(streakLen));
      bloom.setAttribute('cx', String(hx));
      ghostNodes.forEach((node, i) => {
        node.setAttribute('cx', String(cx - (hx - cx) * ghostList[i].k));
        node.setAttribute('cy', String(cy + ghostList[i].dy));
      });
    };
  }
};

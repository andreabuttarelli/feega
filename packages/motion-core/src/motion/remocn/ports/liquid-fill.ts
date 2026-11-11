import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'liquid-fill',
  title: 'Liquid fill',
  about: 'A drop falls into an outlined mark, liquid fills it with a sloshing surface and bubbles, then the outline turns solid.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 78,
  background: '#111111',
  fonts: ['Manrope'],
  props: {
    label: { type: 'string', title: 'Wordmark', default: '', group: 'Content', maxLength: 40 },
    liquidColor: { type: 'string', title: 'Liquid', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    outlineColor: { type: 'string', title: 'Outline', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    bubbleColor: { type: 'string', title: 'Bubbles', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    backgroundColor: { type: 'string', title: 'Fill background', format: PropFormat.Color, default: '#111111', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const liquid = String(p.liquidColor);
    const outline = String(p.outlineColor);
    const bubbleColor = String(p.bubbleColor);
    const label = String(p.label);
    const speed = Math.max(0, Number(p.speed));
    const SHAPE = 'M 27 2 H 73 A 25 25 0 0 1 98 27 V 73 A 25 25 0 0 1 73 98 H 27 A 25 25 0 0 1 2 73 V 27 A 25 25 0 0 1 27 2 Z';
    const LAND = 9;
    const FULL = 34;
    const SLIDE = 36;
    const BUBBLES = 6;
    const SAMPLES = 27;
    const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const size = Math.round(Math.min(view.width, view.height) * 0.24);

    const surfaceAt = (x: number, t: number) => {
      const level = S.interpolate(t, [LAND, FULL], [100, -12], { ...clamp, easing: S.Easing.bezier(0.35, 0, 0.35, 1) });
      const since = Math.max(0, t - LAND);
      const amp = t < LAND ? 0 : 7 * Math.exp(-since / 10) * (1 - (t - LAND) / (FULL - LAND + 6));
      const splash = t < LAND ? 0 : 14 * Math.exp(-since / 3.5);
      return level + Math.max(0, amp) * (Math.sin(x * 0.09 + since * 0.7) + 0.45 * Math.sin(x * 0.17 - since * 0.95 + 1.3)) - splash * Math.exp(-(((x - 50) / 10) ** 2)) + splash * 0.35 * Math.exp(-(((x - 50) / 26) ** 2));
    };

    const drop = S.h('path', { d: 'M 0 -7 C 3 -2 5 1 5 4 A 5 5 0 0 1 -5 4 C -5 1 -3 -2 0 -7 Z', fill: liquid, opacity: 0 });
    const body = S.h('path', { fill: liquid });
    const meniscus = S.h('path', { fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.4 });
    const seeds = Array.from({ length: BUBBLES }, (_, i) => ({
      start: LAND + 2 + S.random(`liquid-fill-b-${i}`) * 16,
      x: 20 + S.random(`liquid-fill-x-${i}`) * 60,
      v: 2.4 + S.random(`liquid-fill-v-${i}`) * 2,
      r: 1.2 + S.random(`liquid-fill-r-${i}`) * 2
    }));
    const dots = seeds.map((s) => S.h('circle', { r: s.r, fill: 'none', stroke: bubbleColor, strokeWidth: 0.8, opacity: 0 }));
    const frame = S.h('path', { d: SHAPE, fill: 'none', stroke: outline, strokeWidth: 3, opacity: 0 });
    const art = S.h(
      'svg',
      { width: size, height: size, viewBox: '0 0 100 100', style: { flexShrink: 0, overflow: 'visible' } },
      S.h('defs', {}, S.h('clipPath', { id: 'lf-clip' }, S.h('path', { d: SHAPE }))),
      drop,
      S.h('g', { clipPath: 'url(#lf-clip)' }, body, meniscus, dots),
      frame
    );
    const word = S.h('div', { style: { opacity: 0, fontFamily: 'Manrope, -apple-system, sans-serif', fontWeight: 600, fontSize: size * 0.4, color: '#FFFFFF', whiteSpace: 'nowrap' } }, label) as HTMLElement;
    const row = S.h('div', { style: { display: 'flex', alignItems: 'center', gap: size * 0.24 } }, art, label ? word : null) as HTMLElement;
    view.root.replaceChildren(S.fill({ background: String(p.backgroundColor), alignItems: 'center', justifyContent: 'center' }, row));

    return (at) => {
      const t = at * speed;
      const fall = S.interpolate(t, [0, LAND], [0, 1], { ...clamp, easing: S.Easing.in(S.Easing.quad) });
      const stretch = 1 + 0.5 * fall;
      const solid = S.interpolate(t, [FULL - 2, FULL + 3], [0, 1], clamp);
      const slide = S.interpolate(t, [SLIDE, SLIDE + 11], [0, 1], { ...clamp, easing: S.Easing.inOut(S.Easing.cubic) });
      const reveal = S.interpolate(t, [SLIDE + 2, SLIDE + 13], [0, 1], { ...clamp, easing: S.Easing.out(S.Easing.cubic) });
      const xs = Array.from({ length: SAMPLES }, (_, i) => -4 + i * 4.3);
      const wave = xs.map((x) => `${x.toFixed(2)} ${surfaceAt(x, t).toFixed(2)}`);

      drop.setAttribute('transform', `translate(50 ${-70 + fall * 142}) scale(${1.6 / Math.sqrt(stretch)} ${1.6 * stretch})`);
      drop.setAttribute('opacity', t < LAND + 1 ? String(S.interpolate(t, [0, 2, LAND, LAND + 1], [0, 1, 1, 0], clamp)) : '0');
      body.setAttribute('d', `M ${wave.join(' L ')} L 110 110 L -10 110 Z`);
      body.setAttribute('opacity', t >= LAND ? '1' : '0');
      meniscus.setAttribute('d', `M ${wave.join(' L ')}`);
      meniscus.setAttribute('stroke-opacity', String(t >= LAND && solid < 1 ? 0.35 * (1 - solid) : 0));

      seeds.forEach((s, i) => {
        const age = t - s.start;
        const by = 98 - age * s.v;
        const visible = age >= 0 && by >= surfaceAt(s.x, t) + s.r + 1;
        dots[i].setAttribute('cx', String(s.x + Math.sin(age * 0.6 + i) * 1.5));
        dots[i].setAttribute('cy', String(by));
        dots[i].setAttribute('opacity', visible ? String(0.7 * (1 - solid)) : '0');
      });

      frame.setAttribute('stroke', S.interpolateColors(solid, [0, 1], [outline, liquid]));
      frame.setAttribute('opacity', String(S.interpolate(t, [0, 5], [0, 1], clamp)));
      row.style.transform = label ? `translateX(calc((50% - ${size / 2}px) * ${1 - slide}))` : 'none';
      word.style.opacity = String(reveal);
      word.style.clipPath = `inset(-30% ${(1 - reveal) * 100}% -30% -5%)`;
      word.style.transform = `translateX(${(1 - reveal) * -size * 0.3}px)`;
    };
  }
};

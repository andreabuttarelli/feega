import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'long-shadow',
  title: 'Long shadow',
  about: 'A flat badge pops in and casts a long flat shadow that grows, then swings as the light moves.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 70,
  background: '#FFFFFF',
  fonts: [],
  props: {
    angleFrom: { type: 'number', title: 'Start angle', default: 45, minimum: 0, maximum: 360, step: 5, group: 'Motion' },
    angleTo: { type: 'number', title: 'End angle', default: 135, minimum: 0, maximum: 360, step: 5, group: 'Motion' },
    fade: { type: 'number', title: 'Fade', default: 0, minimum: 0, maximum: 1, step: 0.05, group: 'Style' },
    shadowColor: { type: 'string', title: 'Shadow', format: PropFormat.Color, default: '#ECEAE6', group: 'Style' },
    iconColor: { type: 'string', title: 'Badge', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    checkColor: { type: 'string', title: 'Check', format: PropFormat.Color, default: '#FFFFFF', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const angleFrom = Number(p.angleFrom);
    const angleTo = Number(p.angleTo);
    const fade = Number(p.fade);
    const speed = Number(p.speed);
    const W = view.width;
    const H = view.height;
    const PASSES = 10;
    const COPIES = 2 ** PASSES - 1;
    const REF_FRAME_HEIGHT = 720;
    const BLUR = 0.8;
    const BADGE_RATIO = 0.34;
    const POP = { damping: 13, stiffness: 170, mass: 0.8 };
    const SWING = { damping: 11, stiffness: 70, mass: 0.9 };
    const SWING_AT = 24;
    const GROW_FROM = 7;
    const GROW_TO = 22;
    const unit = Math.min(W, H) / REF_FRAME_HEIGHT;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: S.Easing.out(S.Easing.cubic) } as const;
    const id = 'ls-extrude';

    const badge = () =>
      S.h(
        'svg',
        { width: Math.min(W, H) * BADGE_RATIO, height: Math.min(W, H) * BADGE_RATIO, viewBox: '0 0 100 100' },
        S.h('circle', { cx: 50, cy: 50, r: 49, fill: String(p.iconColor) }),
        S.h('path', { d: 'M 29 52 L 44 66 L 72 36', fill: 'none', stroke: String(p.checkColor), strokeWidth: 11, strokeLinecap: 'round', strokeLinejoin: 'round' })
      );

    const offsets: Element[] = [];
    const chain: Element[] = [S.h('feColorMatrix', { in: 'SourceAlpha', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 3 0', result: 'm0' })];
    for (let i = 0; i < PASSES; i++) {
      const shift = S.h('feOffset', { in: `m${i}`, dx: 0, dy: 0, result: `o${i}` });
      offsets.push(shift);
      chain.push(shift, S.h('feMerge', { result: `m${i + 1}` }, S.h('feMergeNode', { in: `m${i}` }), S.h('feMergeNode', { in: `o${i}` })));
    }
    const soft = S.h('feGaussianBlur', { in: `m${PASSES}`, stdDeviation: BLUR * unit, result: 'soft' });
    chain.push(soft, S.h('feFlood', { floodColor: String(p.shadowColor) }), S.h('feComposite', { in2: 'soft', operator: 'in' }));
    const defs = S.h('svg', { width: 0, height: 0, style: { position: 'absolute' } }, S.h('filter', { id, x: 0, y: 0, width: 1, height: 1, colorInterpolationFilters: 'sRGB' }, chain));

    const centred = { alignItems: 'center', justifyContent: 'center' };
    const shadow = S.fill({ ...centred, filter: `url(#${id})`, opacity: 0 }, badge()) as HTMLElement;
    const front = S.fill(centred, badge());
    const stage = S.fill({ ...centred, transform: 'scale(0)' }, shadow, front) as HTMLElement;
    view.root.replaceChildren(S.fill({ overflow: 'hidden', background: String(p.background) }, defs, stage));

    return (at) => {
      const t = at * speed;
      const pop = S.spring({ fps: 30, frame: t, config: POP });
      const grow = S.interpolate(t, [GROW_FROM, GROW_TO], [0, 1], clamped);
      const swing = S.spring({ fps: 30, frame: t - SWING_AT, config: SWING });
      const angle = angleFrom + (angleTo - angleFrom) * swing;
      const rad = (angle * Math.PI) / 180;
      const step = (Math.hypot(W, H) * grow) / COPIES;

      offsets.forEach((shift, i) => {
        shift.setAttribute('dx', String(Math.cos(rad) * step * 2 ** i));
        shift.setAttribute('dy', String(Math.sin(rad) * step * 2 ** i));
      });

      const mask = fade > 0 ? `linear-gradient(${angle + 90}deg, #000 50%, rgba(0,0,0,${1 - Math.min(1, fade)}) 100%)` : '';
      stage.style.transform = `scale(${pop})`;
      shadow.style.opacity = grow > 0 ? '1' : '0';
      shadow.style.maskImage = mask;
      shadow.style.setProperty('-webkit-mask-image', mask);
    };
  }
};

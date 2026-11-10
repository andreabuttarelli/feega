import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'wordmark-cut',
  title: 'Wordmark cut',
  about: 'A wide shot of the wordmark rises and cools from warm colour to ink, then cuts to a close push on the gradient dot.',
  category: SnapcnCategory.Logo,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 66,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    word: { type: 'string', title: 'Wordmark', default: 'snapcn.', group: 'Content', maxLength: 40 },
    dotFrom: { type: 'string', title: 'Dot colour from', format: PropFormat.Color, default: '#3072db', group: 'Style' },
    dotTo: { type: 'string', title: 'Dot colour to', format: PropFormat.Color, default: '#4fd8f5', group: 'Style' },
    warm: { type: 'number', title: 'Warmth of the wide shot', default: 1, minimum: 0, maximum: 2, step: 0.05, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const th = S.themeOf(String(p.mode));
    const fg = String(th.foreground);
    const face = S.pick(p.fontFamily, 'Inter');
    const dotFrom = String(p.dotFrom);
    const dotTo = String(p.dotTo);
    const warm = Number(p.warm);
    const speed = Number(p.speed);
    const REF_W = 712;
    const REF_H = 398;
    const CUT = 1.2;
    const WIDE = { size: 245, inkTop: 224, left: -42 };
    const CLOSE = { size: 419, dot: { x: 418.5, y: 259.2 } };
    const DOT = { size: 0.2348, gap: 0.06 };
    const BASELINE_IN_BOX = 0.8633;
    const FOCUS = { sigma: 6, inner: 170, outer: 215 };
    const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const knots = (ts: number[], vs: number[], x: number) => S.interpolate(x, ts, vs, CLAMP);
    const rise = (x: number) => knots([0, 0.058, 0.158, 0.258, 0.392, 0.525, 0.825, 1.2], [50, 31, 20, 13, 7, 3, 0, 0], x);
    const drift = (x: number) => -26.8 * Math.min(1, Math.max(0, (x - 0.66) / (CUT - 0.66))) ** 3.08;
    const warmth = (x: number) => knots([0, 0.358, 0.458, 0.592, 0.858, 1.017, 1.025, 1.2], [0.455, 0.451, 0.404, 0.314, 0.106, 0.016, 0, 0], x);
    const closeScale = (x: number) => knots([0, 0.333, 0.533, 0.708, 0.808, 0.875, 0.933, 0.967, 1], [0.9995, 0.9989, 1.0159, 1.0556, 1.0986, 1.1398, 1.1994, 1.2402, 1.2971], Math.max(0, x - CUT));
    const closeOffset = (x: number) => {
      const u = Math.max(0, x - CUT);
      return { x: knots([0, 0.133, 0.3, 0.775, 0.967, 1], [6.46, 1.96, 0.12, -1.43, -4.08, -5.07], u), y: knots([0, 0.108, 0.133, 0.2, 0.267, 0.433, 0.533, 0.775, 0.933, 1], [13.83, 2.7, -1.09, -4.48, -4.53, -0.32, -0.35, -3.27, -5.13, -7.03], u) };
    };

    const text = String(p.word).replace(/\.+$/, '');
    const inkRatio = /[A-Z0-9bdfhiklt]/.test(text) ? 0.75 : 0.556;
    const k = Math.min(view.width / REF_W, view.height / REF_H);
    const box = S.h('div', { style: { position: 'absolute', left: (view.width - REF_W * k) / 2, top: (view.height - REF_H * k) / 2, width: REF_W, height: REF_H, overflow: 'hidden', transform: `scale(${k})`, transformOrigin: '0 0' } });
    view.root.replaceChildren(S.fill({ fontFamily: face, fontOpticalSizing: 'none', textRendering: 'geometricPrecision', overflow: 'hidden' }, box));

    const line = (wide: boolean, from: string, to: string) => {
      const size = wide ? WIDE.size : CLOSE.size;
      const baseline = wide ? WIDE.inkTop + inkRatio * WIDE.size : CLOSE.dot.y + (DOT.size * CLOSE.size) / 2;
      const d = DOT.size * size;
      const anchored = wide ? { left: WIDE.left } : { right: REF_W - (CLOSE.dot.x + d / 2) };
      return S.h(
        'div',
        { style: { position: 'absolute', top: baseline - BASELINE_IN_BOX * size, ...anchored, display: 'flex', alignItems: 'flex-end', whiteSpace: 'nowrap', fontFamily: face } },
        S.h('span', { style: { fontSize: size, fontWeight: 500, lineHeight: 1, letterSpacing: -0.02 * size, backgroundImage: `linear-gradient(90deg, ${from}, ${to})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } }, text),
        S.h('span', { style: { marginLeft: DOT.gap * size, marginBottom: (1 - BASELINE_IN_BOX) * size, width: d, height: d, borderRadius: '50%', backgroundImage: `linear-gradient(198deg, ${dotTo}, ${dotFrom})`, flexShrink: 0 } })
      );
    };

    const camera = (x: number, blur: number) => {
      const o = closeOffset(x);
      return S.h('div', { style: { position: 'absolute', inset: 0, transform: `translate(${o.x}px, ${o.y}px) scale(${closeScale(x)})`, transformOrigin: `${CLOSE.dot.x}px ${CLOSE.dot.y}px`, filter: blur ? `blur(${blur}px)` : undefined } }, line(false, S.mixOklch(dotFrom, fg, 1), S.mixOklch(dotTo, fg, 1)));
    };

    const mask = `radial-gradient(circle ${FOCUS.outer}px at ${REF_W / 2}px ${REF_H / 2}px, transparent 0%, transparent ${Math.round((100 * FOCUS.inner) / FOCUS.outer)}%, #000 100%)`;

    return (frame) => {
      const x = (frame * speed) / view.fps;
      if (x >= CUT) {
        box.replaceChildren(camera(x, 0), S.h('div', { style: { position: 'absolute', inset: 0, maskImage: mask, WebkitMaskImage: mask } }, camera(x, FOCUS.sigma)));
        return;
      }
      const heat = warmth(x) * warm;
      const wide = S.h('div', { style: { position: 'absolute', inset: 0, transform: `translate(${drift(x)}px, ${rise(x)}px)` } }, line(true, S.mixOklch(dotFrom, fg, 1 - heat), S.mixOklch(dotTo, fg, 1 - heat)));
      box.replaceChildren(wide);
    };
  }
};

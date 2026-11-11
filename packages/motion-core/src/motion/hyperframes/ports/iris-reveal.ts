import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'iris-reveal',
  title: 'Iris reveal',
  about: 'A circle opens from a chosen point and reveals the second panel over a dimmed, greyscale first panel, ringed by a thin accent line.',
  category: HfCategory.Transition,
  origin: HfOrigin.Component,
  source: 'iris-reveal',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 105,
  background: '#07111f',
  fonts: ['Inter'],
  props: {
    fromLabel: { type: 'string', title: 'Before label', default: 'Before', group: 'Content', maxLength: 40 },
    toLabel: { type: 'string', title: 'After label', default: 'After', group: 'Content', maxLength: 40 },
    beforeImage: { type: 'string', title: 'Before picture', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content' },
    afterImage: { type: 'string', title: 'After picture', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content' },
    fromColor: { type: 'string', title: 'Before panel', format: PropFormat.Color, default: '#172033', group: 'Style' },
    toColor: { type: 'string', title: 'After panel', format: PropFormat.Color, default: '#1f5a3a', group: 'Style' },
    iris_x: { type: 'number', title: 'Iris origin X', default: 50, minimum: 0, maximum: 100, step: 1, group: 'Layout' },
    iris_y: { type: 'number', title: 'Iris origin Y', default: 50, minimum: 0, maximum: 100, step: 1, group: 'Layout' },
    open_at: { type: 'number', title: 'Open start', default: 0.35, minimum: 0, maximum: 8, step: 0.05, group: 'Motion' },
    register: { type: 'string', title: 'Register', enum: ['color', 'plain'], default: 'color', group: 'Style' },
    accent: { type: 'string', title: 'Accent', enum: ['green', 'blue', 'violet'], default: 'green', group: 'Style' },
    exit: { type: 'string', title: 'Exit', enum: ['none', 'fade', 'up'], default: 'none', group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const num = (raw: unknown, fallback: number, lo: number, hi: number) => {
      const v = raw === '' || raw === null || raw === undefined ? fallback : Number(raw);
      return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
    };
    const irisX = num(p.iris_x, 50, 0, 100);
    const irisY = num(p.iris_y, 50, 0, 100);
    const openAt = num(p.open_at, 0.35, 0, 8);
    const accents: Record<string, string> = { green: '#22c55e', blue: '#38bdf8', violet: '#c5a3ff' };
    const accent = accents[String(p.accent)] ?? accents.green;
    const exit = p.exit === 'fade' || p.exit === 'up' ? String(p.exit) : 'none';
    const width = view.width;
    const height = view.height;
    const unit = height / 100;
    const cx = (irisX / 100) * width;
    const cy = (irisY / 100) * height;
    const full = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) * 1.02 + 2;

    const picture = (src: unknown) => (src ? S.h('img', { src: String(src), style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' } }) : null);
    const panel = (color: string, label: string, src: unknown, extra: Record<string, unknown>) =>
      S.fill({ alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: color, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, fontSize: 13.5 * unit, letterSpacing: '-0.05em', color: '#f8fafc', ...extra }, picture(src) ? null : label, picture(src)) as HTMLElement;

    const before = panel(String(p.fromColor), String(p.fromLabel), p.beforeImage, p.register === 'plain' ? {} : { filter: 'grayscale(1) brightness(0.76)' });
    const after = panel(String(p.toColor), String(p.toLabel), p.afterImage, { zIndex: 2 });
    const ring = S.h('circle', { cx, cy, r: 0, fill: 'none', stroke: accent, strokeWidth: Math.max(2, width * 0.0021) });
    const rim = S.h('svg', { viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 3 } }, ring) as HTMLElement;
    const stage = S.fill({}, before, after, rim) as HTMLElement;
    view.root.replaceChildren(stage);

    const duration = view.frames / view.fps;
    const inBase = openAt + 1.1;
    const outBase = exit === 'none' ? 0 : 0.5;
    const scale = duration < inBase + outBase ? duration / (inBase + outBase) : 1;
    const inEnd = inBase * scale;
    const out = outBase * scale;
    const stageIn = Math.min(0.32 * scale, inEnd);
    const start = openAt * scale;
    const span = 1.1 * scale;
    const outStart = Math.max(0, duration - out);

    const radius = { value: 0 };
    const write = () => {
      after.style.clipPath = `circle(${radius.value}px at ${cx}px ${cy}px)`;
      ring.setAttribute('r', String(Math.max(0, radius.value)));
    };

    const tl = S.timeline();
    tl.set(stage, { opacity: 0, y: 0 }, 0);
    tl.set(rim, { opacity: 0 }, 0);
    tl.to(stage, { opacity: 1, duration: stageIn, ease: 'power2.out' }, 0);
    tl.fromTo(radius, { value: 0 }, { value: full, duration: span, ease: 'power2.inOut', onUpdate: write }, start);
    tl.fromTo(rim, { opacity: 0 }, { opacity: 1, duration: Math.min(0.18 * scale, span), ease: 'power1.out', immediateRender: false }, start);
    tl.to(rim, { opacity: 0, duration: 0.24 * scale, ease: 'power1.in' }, Math.max(start, inEnd - 0.24 * scale));
    if (exit !== 'none') {
      tl.to(stage, { opacity: 0, duration: out, ease: 'power2.in' }, outStart);
    }
    if (exit === 'up') {
      tl.to(stage, { y: -0.06 * height, duration: out, ease: 'power2.in' }, outStart);
    }

    return (frame) => tl.render(frame / view.fps);
  }
};

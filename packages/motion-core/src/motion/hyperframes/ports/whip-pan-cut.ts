import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'whip-pan-cut',
  title: 'Whip pan cut',
  about: 'Two panels ride one strip that whips sideways with a directional blur, so the second panel lands where the first stood.',
  category: HfCategory.Transition,
  origin: HfOrigin.Component,
  source: 'whip-pan-cut',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 36,
  background: '#07111f',
  fonts: ['Inter'],
  props: {
    fromLabel: { type: 'string', title: 'Outgoing label', default: 'Before', group: 'Content', maxLength: 40 },
    toLabel: { type: 'string', title: 'Incoming label', default: 'After', group: 'Content', maxLength: 40 },
    beforeImage: { type: 'string', title: 'Outgoing picture', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content' },
    afterImage: { type: 'string', title: 'Incoming picture', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content' },
    fromColor: { type: 'string', title: 'Outgoing panel', format: PropFormat.Color, default: '#172033', group: 'Style' },
    toColor: { type: 'string', title: 'Incoming panel', format: PropFormat.Color, default: '#1f5a3a', group: 'Style' },
    direction: { type: 'string', title: 'Direction', enum: ['left', 'right'], default: 'left', group: 'Motion' },
    whip_at: { type: 'number', title: 'Whip start', default: 0.25, minimum: 0, maximum: 8, step: 0.05, group: 'Motion' },
    accent: { type: 'string', title: 'Accent', enum: ['green', 'blue', 'violet'], default: 'green', group: 'Style' },
    exit: { type: 'string', title: 'Exit', enum: ['none', 'fade', 'up'], default: 'none', group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const direction = p.direction === 'right' ? 'right' : 'left';
    const raw = p.whip_at === '' || p.whip_at === null || p.whip_at === undefined ? 0.25 : Number(p.whip_at);
    const whipAt = Number.isFinite(raw) ? Math.max(0, Math.min(8, raw)) : 0.25;
    const accents: Record<string, string> = { green: '#22c55e', blue: '#38bdf8', violet: '#c5a3ff' };
    const accent = accents[String(p.accent)] ?? accents.green;
    const exit = p.exit === 'fade' || p.exit === 'up' ? String(p.exit) : 'none';
    const unit = view.height / 100;
    const sign = direction === 'left' ? -1 : 1;

    const picture = (src: unknown) => (src ? S.h('img', { src: String(src), style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' } }) : null);
    const panel = (color: string, label: string, src: unknown, left: string) =>
      S.fill({ left, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: color, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, fontSize: 13.5 * unit, letterSpacing: '-0.05em', color: '#f8fafc' }, picture(src) ? null : label, picture(src)) as HTMLElement;

    const blurNode = S.h('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '0 0' });
    const defs = S.h('svg', { width: 0, height: 0, style: { position: 'absolute' } }, S.h('defs', null, S.h('filter', { id: 'hf-whip-blur', x: '-50%', y: '-20%', width: '200%', height: '140%' }, blurNode)));
    const seam = S.h('div', { style: { position: 'absolute', zIndex: 3, top: 0, bottom: 0, width: 0.0035 * view.width, left: direction === 'left' ? '100%' : 0, marginLeft: -0.00175 * view.width, background: accent, pointerEvents: 'none' } }) as HTMLElement;
    const strip = S.fill({ filter: 'url(#hf-whip-blur)' }, panel(String(p.fromColor), String(p.fromLabel), p.beforeImage, '0'), panel(String(p.toColor), String(p.toLabel), p.afterImage, direction === 'left' ? '100%' : '-100%'), seam) as HTMLElement;
    view.root.replaceChildren(S.fill({ overflow: 'hidden' }, defs, strip));

    const duration = view.frames / view.fps;
    const base = 0.55;
    const tail = exit === 'none' ? 0 : Math.min(0.35, duration * 0.25);
    const scale = duration - tail < whipAt + base ? (duration - tail) / (whipAt + base) : 1;
    const start = whipAt * scale;
    const whip = base * scale;
    const end = start + whip;
    const outStart = duration - tail;
    const peak = 16;

    const blur = { v: 0 };
    const write = () => blurNode.setAttribute('stdDeviation', `${blur.v} 0`);

    const tl = S.timeline();
    tl.set(strip, { x: 0, y: 0, opacity: 1 }, 0);
    tl.set(seam, { opacity: 0 }, 0);
    tl.fromTo(strip, { x: 0 }, { x: sign * view.width, duration: whip, ease: 'power3.inOut' }, start);
    tl.to(blur, { v: peak, duration: whip / 2, ease: 'power3.in', onUpdate: write }, start);
    tl.to(blur, { v: 0, duration: whip / 2, ease: 'power3.out', onUpdate: write }, start + whip / 2);
    tl.fromTo(seam, { opacity: 0 }, { opacity: 1, duration: Math.min(0.1 * scale, whip), ease: 'power1.out', immediateRender: false }, start);
    tl.to(seam, { opacity: 0, duration: 0.15 * scale, ease: 'power1.in' }, Math.max(start, end - 0.15 * scale));
    if (exit !== 'none') {
      tl.to(strip, { opacity: 0, duration: tail, ease: 'power2.in' }, outStart);
    }
    if (exit === 'up') {
      tl.to(strip, { y: -0.06 * view.height, duration: tail, ease: 'power2.in' }, outStart);
    }

    return (frame) => tl.render(frame / view.fps);
  }
};

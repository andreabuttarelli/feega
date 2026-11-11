import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'mk-background',
  title: 'Soft blob background',
  about: 'Two soft colour blobs drift slowly on a white card that shrinks into a rounded floating panel and expands back.',
  category: HfCategory.Ambient,
  origin: HfOrigin.Block,
  source: 'mk-background',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 300,
  background: '#f5f5f7',
  fonts: [],
  props: {
    base: { type: 'string', title: 'Card', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    blob1: { type: 'string', title: 'Blob 1', format: PropFormat.Color, default: '#ff7ac8', group: 'Style' },
    blob2: { type: 'string', title: 'Blob 2', format: PropFormat.Color, default: '#45d6c8', group: 'Style' },
    radius: { type: 'number', title: 'Card corner radius', default: 40, minimum: 0, maximum: 120, step: 1, group: 'Style' },
    drift: { type: 'number', title: 'Drift', default: 1, minimum: 0, maximum: 2, step: 0.1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = 1920;
    const H = 1080;
    const DUR = 10;
    const drift = Number(p.drift);
    const blob = (color: string, x: number, y: number, r: number, opacity: number) =>
      S.h('div', { style: { position: 'absolute', borderRadius: '50%', width: r * 2, height: r * 2, left: x * W - r, top: y * H - r, opacity, background: 'radial-gradient(circle closest-side, ' + color + ' 0%, rgba(255, 255, 255, 0) 72%)' } }) as HTMLElement;
    const b1 = blob(String(p.blob1), 0.28, 0.32, 950, 0.85);
    const b2 = blob(String(p.blob2), 0.74, 0.66, 1100, 0.8);
    const card = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: W, height: H, overflow: 'hidden', borderRadius: 0, background: String(p.base), boxShadow: '0 30px 80px rgba(0, 0, 0, 0.18)' } }, b1, b2) as HTMLElement;
    const wrap = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' } }, card) as HTMLElement;
    view.root.replaceChildren(wrap);

    const tl = S.timeline();
    tl.set(wrap, { opacity: 0 }, 0);
    tl.set([b1, b2], { scale: 1.14 }, 0);
    tl.set(card, { x: 0, y: 0, width: W, height: H, borderRadius: 0 }, 0);
    tl.to(wrap, { opacity: 1, duration: 0.7, ease: 'power2.out' }, 0);
    tl.to([b1, b2], { scale: 1, duration: 1.2, ease: 'power3.out' }, 0);
    tl.to(b1, { x: 70 * drift, y: 42 * drift, duration: 2.35, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 0.3);
    tl.to(b2, { x: -84 * drift, y: -36 * drift, duration: 2.35, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 0.3);
    tl.to(card, { y: 140, x: 240, width: 1440, height: 800, borderRadius: Number(p.radius), duration: 1.1, ease: 'power3.inOut' }, 3.8);
    tl.to(card, { y: 0, x: 0, width: W, height: H, borderRadius: 0, duration: 1, ease: 'power3.inOut' }, 7.6);
    tl.to(wrap, { opacity: 0, duration: 0.4, ease: 'power2.in' }, DUR - 0.45);
    tl.set(wrap, { visibility: 'hidden' }, DUR - 0.02);

    return (frame) => tl.render(frame / view.fps);
  }
};

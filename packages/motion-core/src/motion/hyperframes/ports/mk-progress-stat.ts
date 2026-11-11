import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'mk-progress-stat',
  title: 'Progress stat',
  about: 'A big number counts up while a thin accent track fills to the same share, with a label and a caption beneath.',
  category: HfCategory.Chart,
  origin: HfOrigin.Block,
  source: 'mk-progress-stat',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 210,
  background: '#f5f5f7',
  fonts: ['Inter'],
  props: {
    value: { type: 'number', title: 'Value', default: 22, minimum: 0, maximum: 100000, step: 1, group: 'Content' },
    max: { type: 'number', title: 'Max', default: 30, minimum: 1, maximum: 100000, step: 1, group: 'Content' },
    suffix: { type: 'string', title: 'Suffix', default: '', group: 'Content', maxLength: 6 },
    label: { type: 'string', title: 'Label', default: 'Goals reached', group: 'Content', maxLength: 60 },
    caption: { type: 'string', title: 'Caption', default: 'Great job, we are getting closer!', group: 'Content', maxLength: 120 },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#0071e3', group: 'Style' },
    ink: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#1d1d1f', group: 'Style' },
    dim: { type: 'string', title: 'Caption colour', format: PropFormat.Color, default: '#6e6e73', group: 'Style' },
    trackWidth: { type: 'number', title: 'Track width', default: 480, minimum: 200, maximum: 1200, step: 10, group: 'Style' },
    x: { type: 'number', title: 'Left', default: 1300, minimum: 0, maximum: 1700, step: 10, group: 'Style' },
    y: { type: 'number', title: 'Top', default: 250, minimum: 0, maximum: 900, step: 10, group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const DUR = 7;
    const value = Number(p.value);
    const share = Math.min(1, Math.max(0, value / Math.max(1, Number(p.max))));
    const suffix = String(p.suffix);
    const ink = String(p.ink);
    const num = S.h('div', { style: { fontWeight: 600, fontSize: 190, lineHeight: 1, letterSpacing: '-0.03em', color: ink, fontVariantNumeric: 'tabular-nums' } }, '0' + suffix) as HTMLElement;
    const label = S.h('div', { style: { marginTop: 10, fontWeight: 500, fontSize: 42, letterSpacing: '-0.01em', color: ink } }, String(p.label));
    const fill = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 3, background: String(p.accent), transformOrigin: 'left center' } }) as HTMLElement;
    const track = S.h('div', { style: { position: 'relative', marginTop: 28, height: 6, width: Number(p.trackWidth), borderRadius: 3, background: 'rgba(29, 29, 31, 0.1)', overflow: 'hidden' } }, fill);
    const caption = S.h('div', { style: { marginTop: 22, fontWeight: 400, fontSize: 30, color: String(p.dim) } }, String(p.caption));
    const group = S.h('div', { style: { position: 'absolute', left: Number(p.x), top: Number(p.y), fontFamily: 'Inter, -apple-system, sans-serif' } }, num, label, track, caption) as HTMLElement;
    view.root.replaceChildren(group);

    const st = { v: 0 };
    const tl = S.timeline();
    tl.set(group, { opacity: 0, y: 28 }, 0);
    tl.set(fill, { scaleX: 0 }, 0);
    tl.to(group, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.3);
    tl.to(st, { v: value, duration: 1.6, ease: 'power2.out', onUpdate: () => { num.textContent = Math.round(st.v) + suffix; } }, 0.5);
    tl.to(fill, { scaleX: share, duration: 1.6, ease: 'power2.out' }, 0.5);
    tl.to(group, { opacity: 0, y: -20, duration: 0.4, ease: 'power2.in' }, DUR - 0.5);
    tl.set(group, { visibility: 'hidden' }, DUR - 0.02);

    return (frame) => tl.render(frame / view.fps);
  }
};

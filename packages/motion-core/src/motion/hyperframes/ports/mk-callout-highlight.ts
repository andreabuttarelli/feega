import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'mk-callout-highlight',
  title: 'Word-sweep highlight',
  about: 'A sentence rises in faint grey, then each word darkens in turn from first to last as a highlight sweeps through it.',
  category: HfCategory.Caption,
  origin: HfOrigin.Block,
  source: 'mk-callout-highlight',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 240,
  background: '#f5f5f7',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', format: PropFormat.Textarea, default: 'Functionality was our goal from the very beginning', group: 'Content', maxLength: 300 },
    ink: { type: 'string', title: 'Highlighted colour', format: PropFormat.Color, default: '#1d1d1f', group: 'Style' },
    faint: { type: 'string', title: 'Faint colour', format: PropFormat.Color, default: '#bcbcc2', group: 'Style' },
    fontSize: { type: 'number', title: 'Font size', default: 60, minimum: 20, maximum: 160, step: 1, group: 'Style' },
    lineHeight: { type: 'number', title: 'Line height', default: 1.3, minimum: 0.9, maximum: 2, step: 0.05, group: 'Style' },
    maxWidth: { type: 'number', title: 'Max width', default: 700, minimum: 200, maximum: 1800, step: 10, group: 'Style' },
    x: { type: 'number', title: 'Left offset', default: 1030, minimum: 0, maximum: 1700, step: 10, group: 'Style' },
    align: { type: 'string', title: 'Align', enum: ['left', 'center', 'right'], default: 'left', group: 'Style' },
    sweepStart: { type: 'number', title: 'Sweep start (s)', default: 1.2, minimum: 0, maximum: 6, step: 0.1, group: 'Motion' },
    sweepEnd: { type: 'number', title: 'Sweep end (s)', default: 6.2, minimum: 0.5, maximum: 7.5, step: 0.1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const DUR = 8;
    const ink = String(p.ink);
    const faint = String(p.faint);
    const words = String(p.text).split(/\s+/).filter((w) => w.length > 0);
    const spans = words.map((w) => S.h('span', { style: { display: 'inline', color: faint } }, w) as HTMLElement);
    const kids = spans.flatMap((s, i) => (i > 0 ? [' ', s] : [s]));
    const box = S.h('div', { style: { flex: 'none', marginLeft: Number(p.x), maxWidth: Number(p.maxWidth), fontFamily: 'Inter, -apple-system, sans-serif', fontWeight: 500, letterSpacing: '-0.015em', fontSize: Number(p.fontSize), lineHeight: Number(p.lineHeight), textAlign: String(p.align) } }, ...kids) as HTMLElement;
    const center = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' } }, box) as HTMLElement;
    view.root.replaceChildren(center);

    const start = Number(p.sweepStart);
    const end = Math.max(start + 0.1, Number(p.sweepEnd));
    const st = { p: 0 };
    const paint = () => {
      const k = st.p * spans.length;
      spans.forEach((span, i) => {
        span.style.color = S.interpolateColors(Math.max(0, Math.min(1, k - i)), [0, 1], [faint, ink]);
      });
    };

    const tl = S.timeline();
    tl.set(box, { opacity: 0, y: 24 }, 0);
    tl.to(box, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.3);
    tl.to(st, { p: 1, duration: end - start, ease: 'none', onUpdate: paint }, start);
    tl.to(box, { opacity: 0, y: -16, duration: 0.4, ease: 'power2.in' }, DUR - 0.5);
    tl.set(center, { visibility: 'hidden' }, DUR - 0.02);
    paint();

    return (frame) => tl.render(frame / view.fps);
  }
};

import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'mk-specs-list',
  title: 'Specs list',
  about: 'A column of label and value rows slides in one after another, each with an accent line sweeping under it.',
  category: HfCategory.Card,
  origin: HfOrigin.Block,
  source: 'mk-specs-list',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 240,
  background: '#f5f5f7',
  fonts: ['Inter'],
  props: {
    rows: {
      type: 'string',
      title: 'Rows',
      format: PropFormat.Textarea,
      default: 'Design | Minimal, clean lines\nTypography | Inter SemiBold\nMotion | Restrained, no bounce\nColor | Stage + one accent\nShapes | Capsules & rounded cards',
      description: 'One row per line: label | value.',
      group: 'Content',
      maxLength: 600
    },
    ink: { type: 'string', title: 'Label colour', format: PropFormat.Color, default: '#1d1d1f', group: 'Style' },
    dim: { type: 'string', title: 'Value colour', format: PropFormat.Color, default: '#6e6e73', group: 'Style' },
    accent: { type: 'string', title: 'Accent', format: PropFormat.Color, default: '#0071e3', group: 'Style' },
    lineWidth: { type: 'number', title: 'Line width', default: 660, minimum: 200, maximum: 1400, step: 10, group: 'Style' },
    rowGap: { type: 'number', title: 'Row gap', default: 44, minimum: 10, maximum: 120, step: 2, group: 'Style' },
    x: { type: 'number', title: 'Left', default: 160, minimum: 0, maximum: 1500, step: 10, group: 'Style' },
    stagger: { type: 'number', title: 'Row stagger (s)', default: 0.18, minimum: 0, maximum: 1, step: 0.02, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const DUR = 8;
    const rows = String(p.rows).split('\n').map((line) => line.split('|').map((s) => s.trim())).filter((parts) => parts[0]);
    const gap = Number(p.rowGap);
    const lineWidth = Number(p.lineWidth);

    const els = rows.map(([label, value], i) => {
      const text = S.h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 18, whiteSpace: 'nowrap' } },
        S.h('span', { style: { fontWeight: 600, fontSize: 46, letterSpacing: '-0.015em', color: String(p.ink) } }, label),
        value ? S.h('span', { style: { fontWeight: 400, fontSize: 40, letterSpacing: '-0.01em', color: String(p.dim) } }, value) : null
      );
      const fill = S.h('div', { style: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: String(p.accent), transformOrigin: 'left center' } }) as HTMLElement;
      const line = S.h('div', { style: { position: 'relative', marginTop: 22, height: 2, width: lineWidth, background: 'rgba(0, 0, 0, 0.1)', borderRadius: 2, overflow: 'hidden' } }, fill);
      const row = S.h('div', { style: { fontFamily: 'Inter, -apple-system, sans-serif', lineHeight: 1, opacity: 0, marginTop: i > 0 ? gap : 0 } }, text, line) as HTMLElement;
      return { row, fill };
    });
    const colHeight = rows.length * (46 + 22 + 2) + (rows.length - 1) * gap;
    const col = S.h('div', { style: { position: 'absolute', left: Number(p.x), top: Math.round((view.height - colHeight) / 2), display: 'flex', flexDirection: 'column' } }, ...els.map((e) => e.row)) as HTMLElement;
    view.root.replaceChildren(col);

    const tl = S.timeline();
    els.forEach(({ row, fill }, i) => {
      const t0 = 0.3 + i * Number(p.stagger);
      tl.set(row, { opacity: 0, x: -36 }, 0);
      tl.set(fill, { scaleX: 0 }, 0);
      tl.to(row, { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' }, t0);
      tl.to(fill, { scaleX: 1, duration: 0.8, ease: 'power2.inOut' }, t0 + 0.15);
    });
    tl.to(col, { opacity: 0, y: -20, duration: 0.4, ease: 'power2.in' }, DUR - 0.5);
    tl.set(col, { visibility: 'hidden' }, DUR - 0.02);

    return (frame) => tl.render(frame / view.fps);
  }
};

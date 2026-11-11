import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'grid-pixelate-wipe',
  title: 'Grid pixelate wipe',
  about: 'A grid of squares grows from the centre to cover the first panel, then shrinks away toward the edges to show the second.',
  category: HfCategory.Transition,
  origin: HfOrigin.Component,
  source: 'grid-pixelate-wipe',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 108,
  background: '#111827',
  fonts: ['Inter'],
  props: {
    fromLabel: { type: 'string', title: 'Outgoing label', default: 'Before', group: 'Content', maxLength: 40 },
    toLabel: { type: 'string', title: 'Incoming label', default: 'After', group: 'Content', maxLength: 40 },
    fromColor: { type: 'string', title: 'Outgoing panel', format: PropFormat.Color, default: '#2563eb', group: 'Style' },
    toColor: { type: 'string', title: 'Incoming panel', format: PropFormat.Color, default: '#7c3aed', group: 'Style' },
    gridColor: { type: 'string', title: 'Grid colour', format: PropFormat.Color, default: '#000000', group: 'Style' },
    cols: { type: 'number', title: 'Columns', default: 16, minimum: 4, maximum: 32, step: 1, group: 'Layout' },
    rows: { type: 'number', title: 'Rows', default: 9, minimum: 3, maximum: 18, step: 1, group: 'Layout' }
  },
  draw: (S, view) => {
    const p = view.props;
    const cols = Math.round(Math.min(32, Math.max(4, Number(p.cols) || 16)));
    const rows = Math.round(Math.min(18, Math.max(3, Number(p.rows) || 9)));
    const scene = (background: string, label: string) => S.fill({ alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, fontSize: 146, letterSpacing: '-0.05em', color: '#ffffff', background }, label) as HTMLElement;

    const a = scene(String(p.fromColor), String(p.fromLabel));
    const b = scene(String(p.toColor), String(p.toLabel));
    const cells = Array.from({ length: cols * rows }, () => S.h('div', { style: { background: String(p.gridColor) } }) as HTMLElement);
    const grid = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, zIndex: 999 } }, ...cells);
    view.root.replaceChildren(S.fill({ overflow: 'hidden' }, a, b, grid));

    const tl = S.timeline();
    const cover = 0.4;
    const swap = cover + 1.2;
    tl.set(b, { opacity: 0 }, 0);
    tl.set(cells, { scale: 0 }, 0);
    tl.to(cells, { scale: 1, duration: 0.6, stagger: { amount: 0.6, from: 'center' }, ease: 'power2.inOut' }, cover);
    tl.set(a, { opacity: 0 }, swap);
    tl.set(b, { opacity: 1 }, swap);
    tl.to(cells, { scale: 0, duration: 0.6, stagger: { amount: 0.6, from: 'edges' }, ease: 'power2.inOut' }, swap);

    return (frame) => tl.render(frame / view.fps);
  }
};

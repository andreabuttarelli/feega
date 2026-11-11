import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'racing-chart',
  title: 'Racing bar chart',
  about: 'Horizontal bars grow and swap places by rank as the values race through a sequence of steps under a fading title.',
  category: RendercompCategory.Chart,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 210,
  background: '#0b1f3a',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'Market Share Race', group: 'Content', maxLength: 80 },
    data: {
      type: 'string',
      title: 'Series (label;v1,v2,...;colour | ...)',
      default: 'Aurora;22,28,34,41,48;#d4af37 | Beacon;30,32,33,35,36;#2563eb | Cobalt;18,24,30,32,38;#10b981 | Delta;26,25,24,22,20;#ef4444 | Echo;12,16,20,28,34;#a855f7',
      group: 'Content',
      maxLength: 800
    },
    background: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0b1f3a', group: 'Style' },
    titleColor: { type: 'string', title: 'Title colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    frames: { type: 'number', title: 'Frames per step', default: 36, minimum: 1, maximum: 120, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const BAR_HEIGHT = 48;
    const BAR_GAP = 16;
    const DELAY = 18;
    const stepFrames = Number(p.frames);

    const series = String(p.data)
      .split('|')
      .map((row) => row.split(';').map((cell) => cell.trim()))
      .filter((cells) => cells[0])
      .map((cells) => ({ label: cells[0], values: (cells[1] ?? '').split(',').map((v) => Number(v) || 0), color: cells[2] || '#60a5fa' }));
    const stepCount = series.length ? Math.max(...series.map((s) => s.values.length)) : 0;

    const rows = series.map((s) => {
      const value = S.h('span', { style: { fontSize: 16, fontWeight: 700, color: '#ffffff' } }, '0') as HTMLElement;
      const fillBar = S.h('div', { style: { height: '100%', backgroundColor: s.color, borderRadius: BAR_HEIGHT / 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16, minWidth: 60 } }, value) as HTMLElement;
      const row = S.h(
        'div',
        { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: BAR_HEIGHT, display: 'flex', alignItems: 'center', gap: 16 } },
        S.h('span', { style: { fontSize: 16, fontWeight: 600, color: '#ffffff', minWidth: 100, textAlign: 'right', flexShrink: 0 } }, s.label),
        S.h('div', { style: { flex: 1, position: 'relative', height: BAR_HEIGHT } }, fillBar)
      ) as HTMLElement;
      return { row, fillBar, value, values: s.values };
    });

    const title = S.h('div', { style: { fontSize: 64, fontWeight: 800, color: String(p.titleColor), letterSpacing: 2, textAlign: 'left' } }, String(p.title)) as HTMLElement;
    const board = S.h('div', { style: { position: 'relative', width: '100%', height: series.length * (BAR_HEIGHT + BAR_GAP) } }, rows.map((r) => r.row)) as HTMLElement;

    view.root.replaceChildren(
      S.fill(
        { backgroundColor: String(p.background), padding: 80, gap: 48, fontFamily: face },
        title,
        S.h('div', { style: { flex: 1, display: 'flex', alignItems: 'center' } }, board)
      )
    );

    return (frame) => {
      title.style.opacity = String(S.interpolate(frame, [0, 12], [0, 1], { ...clamped, easing: S.Easing.out(S.Easing.cubic) }));
      if (!rows.length || !stepCount) {
        return;
      }

      board.style.opacity = String(S.interpolate(frame, [DELAY, DELAY + 8], [0, 1], clamped));

      const lastStep = stepCount - 1;
      const rawStep = S.interpolate(frame, [DELAY, DELAY + lastStep * stepFrames], [0, lastStep], { ...clamped, easing: S.Easing.linear });
      const floor = Math.floor(rawStep);
      const ceil = Math.min(floor + 1, lastStep);
      const fraction = rawStep - floor;

      const current = rows.map((r) => {
        const from = r.values[Math.min(floor, r.values.length - 1)] ?? 0;
        const to = r.values[Math.min(ceil, r.values.length - 1)] ?? 0;
        return from + (to - from) * fraction;
      });
      const maxVal = Math.max(...current, 1);
      const order = current.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);

      order.forEach(({ i }, rank) => {
        rows[i].row.style.transform = `translateY(${rank * (BAR_HEIGHT + BAR_GAP)}px)`;
      });
      rows.forEach((r, i) => {
        r.fillBar.style.width = `${(current[i] / maxVal) * 100}%`;
        r.value.textContent = String(Math.round(current[i]));
      });
    };
  }
};

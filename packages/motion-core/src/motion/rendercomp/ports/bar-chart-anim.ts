import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'bar-chart-anim',
  title: 'Bar chart',
  about: 'A title fades in, then coloured bars spring up from the baseline one after another with their labels. Animated; Arc Bar chart is still.',
  category: RendercompCategory.Chart,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#0f172a',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'Quarterly Revenue', group: 'Content', maxLength: 80 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'Year over year +28%', group: 'Content', maxLength: 120 },
    bars: { type: 'string', title: 'Bars (label;value;colour | ...)', default: 'Q1;120;#60a5fa | Q2;180;#34d399 | Q3;240;#fbbf24 | Q4;320;#f472b6', group: 'Content', maxLength: 600 },
    background: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0f172a', group: 'Style' },
    titleColor: { type: 'string', title: 'Title colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#60a5fa', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const face = S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif');
    const accent = String(p.accentColor);
    const scale = Math.min(view.width, view.height) / 1080;
    const chartHeight = 420 * scale;
    const barWidth = 120 * scale;
    const gap = 8 * scale;
    const DELAY = 20;
    const STAGGER = 8;
    const TITLE_EASE = S.Easing.out(S.Easing.cubic);

    const bars = String(p.bars)
      .split('|')
      .map((row) => row.split(';').map((cell) => cell.trim()))
      .filter((cells) => cells[0] || cells[1])
      .map((cells) => ({ label: cells[0], value: Number(cells[1]) || 0, color: cells[2] || accent }));
    const maxValue = Math.max(...bars.map((b) => b.value), 1);

    const columns = bars.map((b) => {
      const bar = S.h('div', { style: { width: barWidth, height: 0, borderRadius: `${gap}px ${gap}px 0 0`, background: b.color, opacity: 0 } }) as HTMLElement;
      const label = b.label ? (S.h('span', { style: { fontSize: 14 * scale, color: b.color, opacity: 0, fontWeight: 600 } }, b.label) as HTMLElement) : null;
      const column = S.h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap } }, bar, label);
      return { bar, label, column, target: (b.value / maxValue) * chartHeight };
    });

    const subtitle = String(p.subtitle);
    const head = S.h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 * scale } },
      S.h('div', { style: { fontSize: 60 * scale, fontWeight: 900, color: String(p.titleColor), letterSpacing: 2 * scale } }, String(p.title)),
      subtitle ? S.h('div', { style: { fontSize: 28 * scale, fontWeight: 600, color: accent, letterSpacing: 1 * scale } }, subtitle) : null
    ) as HTMLElement;

    view.root.replaceChildren(
      S.fill(
        { backgroundColor: String(p.background), alignItems: 'center', justifyContent: 'center', padding: 80 * scale, gap: 56 * scale, fontFamily: face },
        head,
        S.h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 24 * scale, height: chartHeight } }, columns.map((c) => c.column))
      )
    );

    return (frame) => {
      head.style.opacity = String(S.interpolate(frame, [0, 14], [0, 1], { ...clamped, easing: TITLE_EASE }));
      head.style.transform = `translateY(${S.interpolate(frame, [0, 14], [-20, 0], { ...clamped, easing: TITLE_EASE })}px)`;

      columns.forEach((c, i) => {
        const progress = S.spring({ frame: frame - DELAY - i * STAGGER, fps: view.fps, config: { damping: 16, stiffness: 200 } });
        c.bar.style.height = `${c.target * progress}px`;
        c.bar.style.opacity = String(progress);
        if (c.label) {
          c.label.style.opacity = String(progress);
        }
      });
    };
  }
};

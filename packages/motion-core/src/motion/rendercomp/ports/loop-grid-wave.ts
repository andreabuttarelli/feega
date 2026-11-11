import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'loop-grid-wave',
  title: 'Grid wave',
  about: 'A grid of dots swells and glows in a diagonal wave that loops seamlessly.',
  category: RendercompCategory.Loop,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#0a0f1e',
  fonts: [],
  props: {
    backgroundColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#0a0f1e', group: 'Style' },
    dotColor: { type: 'string', title: 'Dot colour', format: PropFormat.Color, default: '#334155', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#38bdf8', group: 'Style' },
    amplitude: { type: 'number', title: 'Amplitude', default: 1, minimum: 0, maximum: 3, step: 0.05, group: 'Motion' },
    speed: { type: 'number', title: 'Speed (whole loops)', default: 1, minimum: 1, maximum: 6, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const amplitude = Number(p.amplitude);
    const speed = Number(p.speed);
    const dotColor = String(p.dotColor);
    const accentColor = String(p.accentColor);
    const loopFrames = 90;
    const cols = 18;
    const rows = 12;
    const cellW = width / cols;
    const cellH = height / rows;
    const maxR = Math.min(cellW, cellH) * 0.28;

    const dots = Array.from({ length: rows * cols }, (_, n) => {
      const row = Math.floor(n / cols);
      const col = n % cols;
      return { row, col, el: S.h('circle', { cx: cellW * (col + 0.5), cy: cellH * (row + 0.5) }) };
    });
    const svg = S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { position: 'absolute', top: 0, left: 0 } }, ...dots.map((d) => d.el));
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.backgroundColor) }, svg));

    return (frame) => {
      const t = (frame / loopFrames) * Math.PI * 2 * speed;

      dots.forEach(({ row, col, el }) => {
        const wave = Math.sin(t + col * 0.38 + row * 0.48) * 0.5 + 0.5;
        el.setAttribute('r', String(maxR * (0.2 + wave * 0.8) * amplitude));
        el.setAttribute('fill', wave > 0.7 ? accentColor : dotColor);
        el.setAttribute('opacity', String(0.1 + wave * 0.9));
      });
    };
  }
};

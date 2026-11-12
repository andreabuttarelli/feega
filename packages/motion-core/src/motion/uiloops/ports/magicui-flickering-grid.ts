import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'magicui-flickering-grid',
  title: 'Flickering grid',
  about: 'A grid of small squares whose opacity flickers at random. All cells flicker; Animated grid pattern lights few.',
  category: SnapcnCategory.Background,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#ffffff',
  fonts: [],
  props: {
    squareSize: { type: 'number', title: 'Square size', default: 4, minimum: 1, maximum: 40, step: 1, group: 'Layout' },
    gridGap: { type: 'number', title: 'Gap', default: 6, minimum: 0, maximum: 40, step: 1, group: 'Layout' },
    flickerChance: { type: 'number', title: 'Flicker chance', default: 0.3, minimum: 0, maximum: 3, step: 0.05, group: 'Motion' },
    maxOpacity: { type: 'number', title: 'Max opacity', default: 0.3, minimum: 0, maximum: 1, step: 0.01, group: 'Style' },
    color: { type: 'string', title: 'Colour', format: PropFormat.Color, default: '#000000', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const size = Number(p.squareSize);
    const gap = Number(p.gridGap);
    const max = Number(p.maxOpacity);
    const chance = Number(p.flickerChance);
    const cols = Math.ceil(view.width / (size + gap));
    const rows = Math.ceil(view.height / (size + gap));
    const c = S.parseColor(String(p.color));
    const rgb = `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)},`;
    const canvas = S.h('canvas', { style: { display: 'block', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } }) as HTMLCanvasElement;
    canvas.width = view.width;
    canvas.height = view.height;
    view.root.replaceChildren(S.fill({ overflow: 'hidden' }, canvas));
    const pen = canvas.getContext('2d') as CanvasRenderingContext2D;
    const dt = 1 / view.fps;
    let drawn = 0;
    const next = () => S.random(`magicui-flickering-grid-${drawn++}`);
    let squares = new Float32Array(0);
    let at = 0;

    const reset = () => {
      drawn = 0;
      squares = Float32Array.from({ length: cols * rows }, () => next() * max);
      at = 0;
    };

    const step = () => {
      for (let i = 0; i < squares.length; i++) {
        if (next() < chance * dt) {
          squares[i] = next() * max;
        }
      }
      at++;
    };

    reset();

    return (frame) => {
      if (frame < at) {
        reset();
      }
      while (at < frame) {
        step();
      }
      pen.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          pen.fillStyle = `${rgb}${squares[i * rows + j]})`;
          pen.fillRect(i * (size + gap), j * (size + gap), size, size);
        }
      }
    };
  }
};

import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'bokeh-circles',
  title: 'Bokeh circles',
  about: 'Soft glowing circles drift and pulse over a dark backdrop while a centred label fades in.',
  category: RendercompCategory.Loop,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#1a0f1f',
  fonts: [],
  props: {
    label: { type: 'string', title: 'Label', default: 'Background Demo', group: 'Content', maxLength: 60 },
    colors: { type: 'string', title: 'Circle colours (comma separated)', default: '#ffd1a4, #ffe6c7, #fff3d6, #ffc89e', group: 'Style', maxLength: 200 },
    baseColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#1a0f1f', group: 'Style' },
    labelColor: { type: 'string', title: 'Label colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    count: { type: 'number', title: 'Circles', default: 24, minimum: 1, maximum: 80, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const count = Math.round(Number(p.count));
    const colors = String(p.colors).split(',').map((c) => c.trim()).filter(Boolean);
    const palette = colors.length ? colors : ['#ffd1a4'];
    const label = String(p.label);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9301 + 49297) * 49297;
      return x - Math.floor(x);
    };

    const circles = Array.from({ length: count }, (_, i) => ({
      seedX: seededRandom(i * 3 + 1),
      seedY: seededRandom(i * 5 + 2),
      sizeBase: 80 + seededRandom(i * 7 + 3) * 240,
      speed: 0.4 + seededRandom(i * 11 + 4) * 0.8,
      phase: seededRandom(i * 13 + 5) * Math.PI * 2,
      color: palette[Math.floor(seededRandom(i * 17 + 6) * palette.length)],
      opacity: 0.25 + seededRandom(i * 19 + 7) * 0.45
    }));

    const nodes = circles.map((c) => S.h('div', { style: { position: 'absolute', borderRadius: '50%', background: `radial-gradient(circle, ${c.color} 0%, transparent 70%)`, opacity: c.opacity, filter: 'blur(20px)', mixBlendMode: 'screen' } }) as HTMLElement);
    const text = S.h('div', { style: { fontSize: 72, fontWeight: 700, color: String(p.labelColor), letterSpacing: 4, textShadow: '0 4px 24px rgba(0,0,0,0.5)', fontFamily: S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif') } }, label) as HTMLElement;
    const labelLayer = S.fill({ alignItems: 'center', justifyContent: 'center', background: 'transparent' }, label ? text : null);
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.baseColor), overflow: 'hidden' }, ...nodes, labelLayer));

    return (frame) => {
      circles.forEach((c, i) => {
        const t = frame * 0.02 * c.speed + c.phase;
        const x = c.seedX * 100 + Math.sin(t) * 8;
        const y = c.seedY * 100 + Math.cos(t * 0.8) * 8;
        const size = c.sizeBase * (1 + Math.sin(t * 1.2) * 0.15);
        const el = nodes[i];
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.marginLeft = `${-size / 2}px`;
        el.style.marginTop = `${-size / 2}px`;
      });

      text.style.opacity = String(S.interpolate(frame, [10, 25], [0, 1], clamped));
    };
  }
};

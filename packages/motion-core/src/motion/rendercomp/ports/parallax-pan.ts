import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'parallax-pan',
  title: 'Parallax pan',
  about: 'Mountains, hills, ground and trees slide sideways at different speeds under a sunset sky while the title fades up.',
  category: RendercompCategory.Loop,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#1e3a8a',
  fonts: [],
  props: {
    title: { type: 'string', title: 'Title', default: 'Beyond the Horizon', group: 'Content', maxLength: 80 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'A journey through layered worlds', group: 'Content', maxLength: 120 },
    skyTop: { type: 'string', title: 'Sky top', format: PropFormat.Color, default: '#1e3a8a', group: 'Style' },
    skyBottom: { type: 'string', title: 'Sky bottom', format: PropFormat.Color, default: '#f59e0b', group: 'Style' },
    mountainColor: { type: 'string', title: 'Mountains', format: PropFormat.Color, default: '#1e293b', group: 'Style' },
    hillColor: { type: 'string', title: 'Hills', format: PropFormat.Color, default: '#334155', group: 'Style' },
    groundColor: { type: 'string', title: 'Ground', format: PropFormat.Color, default: '#0f172a', group: 'Style' },
    textColor: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#fef3c7', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    panDistance: { type: 'number', title: 'Pan distance (px)', default: 600, minimum: 0, maximum: 3000, step: 10, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const panDistance = Number(p.panDistance);
    const title = String(p.title);
    const subtitle = String(p.subtitle);
    const durationInFrames = 120;
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const ease = S.Easing.out(S.Easing.cubic);
    const seededHeight = (i: number, variance: number) => {
      const v = Math.sin(i * 12.9898) * 43758.5453;
      return (v - Math.floor(v)) * variance;
    };

    const range = (color: string, baseLine: number, peaks: number, variance: number) => {
      const w = width * 3;
      const baseY = height * baseLine;
      const segmentW = w / peaks;
      const points = [`0,${height}`, `0,${baseY}`];
      for (let i = 0; i <= peaks; i++) {
        const x = i * segmentW;
        const peakHeight = (variance + seededHeight(i, variance)) * height;
        points.push(`${x - segmentW / 2},${baseY - peakHeight}`);
        points.push(`${x},${baseY}`);
      }
      points.push(`${w},${baseY}`);
      points.push(`${w},${height}`);
      return S.h('svg', { width: w, height, style: { display: 'block' } }, S.h('polygon', { points: points.join(' '), fill: color }));
    };

    const trees = () => {
      const w = width * 3;
      const treeCount = 8;
      const baseY = height * 0.86;
      const groups = Array.from({ length: treeCount }, (_, i) => {
        const x = (i + 0.5) * (w / treeCount) + seededHeight(i * 7, 100);
        const h = 60 + seededHeight(i * 3, 40);
        return S.h('g', {},
          S.h('rect', { x: x - 4, y: baseY, width: 8, height: h * 0.4, fill: '#1a1a1a' }),
          S.h('polygon', { points: `${x},${baseY - h} ${x - 22},${baseY + 4} ${x + 22},${baseY + 4}`, fill: '#0b3d1a' }),
          S.h('polygon', { points: `${x},${baseY - h * 0.7} ${x - 18},${baseY - h * 0.05} ${x + 18},${baseY - h * 0.05}`, fill: '#0a4a20' })
        );
      });
      return S.h('svg', { width: w, height, style: { display: 'block' } }, ...groups);
    };

    const layer = (zIndex: number, child: Node) => S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex } }, child) as HTMLElement;
    const mountains = layer(1, range(String(p.mountainColor), 0.55, 9, 0.18));
    const hills = layer(2, range(String(p.hillColor), 0.72, 6, 0.1));
    const ground = layer(3, range(String(p.groundColor), 0.88, 4, 0.05));
    const treeLayer = layer(4, trees());
    const sun = S.h('div', { style: { position: 'absolute', left: width * 0.7, top: height * 0.45, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,237,179,0.95) 0%, rgba(255,237,179,0.4) 50%, rgba(255,237,179,0) 80%)' } }) as HTMLElement;
    const sky = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `linear-gradient(180deg, ${String(p.skyTop)} 0%, ${String(p.skyBottom)} 100%)` } });
    const heading = S.h('div', { style: { fontSize: width >= 1920 ? 108 : 72, fontWeight: 900, letterSpacing: 4, lineHeight: 1.2 } }, title);
    const sub = subtitle ? S.h('div', { style: { marginTop: 24, fontSize: width >= 1920 ? 34 : 26, fontWeight: 500, letterSpacing: 2, opacity: 0.9 } }, subtitle) : null;
    const text = S.h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif'), color: String(p.textColor), textAlign: 'center', padding: 80, boxSizing: 'border-box', zIndex: 10, textShadow: '0 4px 24px rgba(0,0,0,0.6)' } }, heading, sub) as HTMLElement;
    view.root.replaceChildren(S.fill({ overflow: 'hidden', background: 'transparent' }, sky, sun, mountains, hills, ground, treeLayer, text));

    return (frame) => {
      const t = frame / durationInFrames;
      const bgX = -t * panDistance * 0.15;
      const midX = -t * panDistance * 0.45;
      const fgX = -t * panDistance;

      sun.style.transform = `translateX(${bgX * 0.3}px)`;
      mountains.style.transform = `translateX(${bgX}px)`;
      hills.style.transform = `translateX(${midX}px)`;
      ground.style.transform = `translateX(${fgX}px)`;
      treeLayer.style.transform = `translateX(${fgX * 1.3}px)`;

      text.style.opacity = String(S.interpolate(frame, [10, 28], [0, 1], { ...clamped, easing: ease }));
      text.style.transform = `translateY(${S.interpolate(frame, [10, 28], [40, 0], { ...clamped, easing: ease })}px)`;
    };
  }
};

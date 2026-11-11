import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../../snapcn/model';

export const PORT: SnapcnPort = {
  id: 'parallax-depth',
  title: 'Parallax depth',
  about: 'A sun and layered hills slide at different speeds as the camera trucks sideways and pushes in.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#111111',
  fonts: [],
  props: {
    distance: { type: 'number', title: 'Truck distance', default: 0.5, minimum: 0, maximum: 1.2, step: 0.05, group: 'Motion' },
    push: { type: 'number', title: 'Push-in', default: 0.16, minimum: 0, maximum: 0.6, step: 0.02, group: 'Motion' },
    direction: { type: 'string', title: 'Direction', enum: ['right', 'left'], default: 'right', group: 'Motion' },
    seed: { type: 'number', title: 'Seed', default: 3, minimum: 1, maximum: 24, step: 1, group: 'Style' },
    sunColor: { type: 'string', title: 'Sun', format: PropFormat.Color, default: '#E5322D', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const speed = Number(p.speed);
    const distance = Number(p.distance);
    const push = Number(p.push);
    const direction = String(p.direction) === 'left' ? -1 : 1;
    const seed = Number(p.seed);
    const DURATION = 60;
    const FAR = '#2C2C2C';
    const MID = '#555555';
    const NEAR = '#8E8E8E';

    const hillPath = (base: number, amp: number, waves: number, key: string) => {
      const octaves = [0, 1, 2].map((o) => ({
        f: (waves * (o + 1) * (0.8 + S.random(`${seed}-${key}-f${o}`) * 0.4)) / width,
        a: amp / (o * 1.7 + 1),
        p: S.random(`${seed}-${key}-p${o}`) * Math.PI * 2
      }));
      const steps = 120;
      const x0 = -width;
      const x1 = width * 2;
      let d = `M ${x0} ${height * 2}`;
      for (let i = 0; i <= steps; i++) {
        const x = x0 + ((x1 - x0) * i) / steps;
        let y = base;
        for (const o of octaves) {
          y -= o.a * (0.5 + 0.5 * Math.sin(x * o.f * 6.283 + o.p));
        }
        d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return `${d} L ${x1} ${height * 2} Z`;
    };

    const svgOf = (child: Element) => S.h('svg', { width, height, viewBox: `0 0 ${width} ${height}`, style: { overflow: 'visible' } }, child);
    const hill = (base: number, amp: number, waves: number, color: string, key: string) => svgOf(S.h('path', { d: hillPath(height * base, height * amp, waves, key), fill: color }));
    const layers = [
      { depth: 9, node: svgOf(S.h('circle', { cx: width * 0.6, cy: height * 0.4, r: height * 0.17, fill: String(p.sunColor) })) },
      { depth: 6, node: hill(0.6, 0.24, 2.2, FAR, 'far') },
      { depth: 2.6, node: hill(0.76, 0.16, 1.2, MID, 'mid') },
      { depth: 1.2, node: hill(0.92, 0.14, 0.9, NEAR, 'near') }
    ];
    const frames = layers.map((l) => S.fill({ transformOrigin: '50% 55%' }, l.node) as HTMLElement);
    view.root.style.overflow = 'hidden';
    view.root.replaceChildren(...frames);

    return (at) => {
      const t = (at * speed * 30) / view.fps;
      const move = S.interpolate(t, [0, DURATION], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: S.Easing.bezier(0.45, 0, 0.2, 1) });
      const camX = (move - 0.5) * distance * width * direction;
      const camZ = move * push;
      layers.forEach((layer, i) => {
        const depth = Math.max(0.2, layer.depth);
        const scale = depth / Math.max(0.05, depth - camZ);
        const x = (-camX * scale) / depth;
        frames[i].style.transform = `translateX(${x}px) scale(${scale})`;
      });
    };
  }
};

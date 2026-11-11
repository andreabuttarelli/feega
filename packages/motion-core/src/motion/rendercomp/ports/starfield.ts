import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'starfield',
  title: 'Starfield warp',
  about: 'Stars stream outward from the centre at warp speed, with a spaced-out label fading in on top.',
  category: RendercompCategory.Loop,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 150,
  background: '#02030a',
  fonts: [],
  props: {
    label: { type: 'string', title: 'Label', default: 'BACKGROUND', group: 'Content', maxLength: 60 },
    starColor: { type: 'string', title: 'Star colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    baseColor: { type: 'string', title: 'Background', format: PropFormat.Color, default: '#02030a', group: 'Style' },
    labelColor: { type: 'string', title: 'Label colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    count: { type: 'number', title: 'Stars', default: 180, minimum: 1, maximum: 600, step: 1, group: 'Motion' },
    warpSpeed: { type: 'number', title: 'Warp speed', default: 4, minimum: 0, maximum: 20, step: 0.5, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const { width, height } = view;
    const count = Math.round(Number(p.count));
    const warpSpeed = Number(p.warpSpeed);
    const starColor = String(p.starColor);
    const label = String(p.label);
    const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9301 + 49297) * 49297;
      return x - Math.floor(x);
    };

    const stars = Array.from({ length: count }, (_, i) => ({
      angle: seededRandom(i * 3 + 1) * Math.PI * 2,
      startOffset: seededRandom(i * 5 + 2) * maxR,
      sizeBase: 1 + seededRandom(i * 7 + 3) * 2.5,
      speedJitter: 0.7 + seededRandom(i * 11 + 4) * 0.6
    }));
    const nodes = stars.map((s) => S.h('div', { style: { position: 'absolute', background: `linear-gradient(90deg, transparent, ${starColor})`, transform: `rotate(${s.angle}rad)`, transformOrigin: 'center' } }) as HTMLElement);
    const text = S.h('div', { style: { fontSize: 72, fontWeight: 700, color: String(p.labelColor), letterSpacing: 8, textShadow: '0 4px 24px rgba(0,0,0,0.7)', fontFamily: S.pick(p.fontFamily, '-apple-system, "Segoe UI", Roboto, sans-serif') } }, label) as HTMLElement;
    const labelLayer = S.fill({ alignItems: 'center', justifyContent: 'center', background: 'transparent' }, label ? text : null);
    view.root.replaceChildren(S.fill({ backgroundColor: String(p.baseColor), overflow: 'hidden' }, ...nodes, labelLayer));

    return (frame) => {
      stars.forEach((s, i) => {
        const dist = (s.startOffset + frame * warpSpeed * s.speedJitter) % maxR;
        const sizeScale = dist / maxR;
        const size = s.sizeBase * (0.5 + sizeScale * 1.5);
        const trailLen = sizeScale * 18 * warpSpeed * 0.5;
        const el = nodes[i];
        el.style.left = `${cx + Math.cos(s.angle) * dist}px`;
        el.style.top = `${cy + Math.sin(s.angle) * dist}px`;
        el.style.width = `${size + trailLen}px`;
        el.style.height = `${size}px`;
        el.style.marginLeft = `${-(size + trailLen) / 2}px`;
        el.style.marginTop = `${-size / 2}px`;
        el.style.borderRadius = `${size / 2}px`;
        el.style.opacity = String(Math.min(1, sizeScale * 1.5));
        el.style.boxShadow = `0 0 ${size * 2}px ${starColor}`;
      });

      text.style.opacity = String(S.interpolate(frame, [10, 25], [0, 1], clamped));
    };
  }
};

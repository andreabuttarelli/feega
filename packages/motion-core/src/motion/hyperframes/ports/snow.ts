import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'snow',
  title: 'Snow',
  about: 'Snowflakes of three depths fall in a seamless loop and sway side to side, with the centre kept clear for a subject.',
  category: HfCategory.Ambient,
  origin: HfOrigin.Block,
  source: 'snow',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 180,
  background: '#0b1220',
  fonts: [],
  props: {
    density: { type: 'string', title: 'Density', enum: ['sparse', 'dense'], default: 'sparse', group: 'Style' },
    speed: { type: 'string', title: 'Fall speed', enum: ['calm', 'gust'], default: 'calm', group: 'Motion' },
    flake: { type: 'string', title: 'Flake colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const duration = view.frames / view.fps;
    const count = p.density === 'dense' ? 280 : 120;
    const fallSeconds = p.speed === 'gust' ? 2.2 : 4.5;
    const swaySeconds = p.speed === 'gust' ? 2.2 : 4;
    const PHI = 0.6180339887498949;
    const RT2 = 0.4142135623730951;
    const TAU = 2 * Math.PI;
    const WRAP_MARGIN = 0.02;
    const frac = (x: number) => x - Math.floor(x);
    const rnd = (n: number) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const whole = (cycleSeconds: number) => Math.max(1, Math.round(duration / cycleSeconds));
    const fallBase = whole(fallSeconds);
    const swayBase = whole(swaySeconds);
    const hole = 'radial-gradient(circle 230px at 50% 50%, transparent 0 230px, #000 653px)';

    const flakes = Array.from({ length: count }, (_, i) => {
      const depth = rnd(i);
      const size = 2 + depth * depth * 16;
      const bokeh = depth > 0.85;
      const layer = depth < 1 / 3 ? 0 : depth < 2 / 3 ? 1 : 2;
      const el = S.h('div', { style: { position: 'absolute', top: 0, left: 0, borderRadius: '50%', background: String(p.flake), width: size, height: size, opacity: bokeh ? 0.5 : 0.35 + depth * 0.55, filter: bokeh ? 'blur(2px)' : 'none' } }) as HTMLElement;
      return {
        el,
        laneX: frac(i * PHI + 0.07),
        fallCycles: fallBase + layer,
        fallPhi: frac(i * RT2 + 0.37),
        swayPx: 6 + depth * 24,
        swayCycles: swayBase + Math.round(rnd(i + 5000) * 2),
        swayPhi: TAU * rnd(i + 3000)
      };
    });

    view.root.replaceChildren(S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', WebkitMaskImage: hole, maskImage: hole } }, ...flakes.map((f) => f.el)));

    return (frame) => {
      const phase = Math.min(1, frame / view.fps / duration);
      flakes.forEach((f) => {
        const y = (-WRAP_MARGIN + frac(f.fallCycles * phase + f.fallPhi) * (1 + 2 * WRAP_MARGIN)) * H;
        const x = f.laneX * W + f.swayPx * Math.sin(TAU * f.swayCycles * phase + f.swayPhi);
        f.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
      });
    };
  }
};

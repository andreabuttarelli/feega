import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'starfield',
  title: 'Starfield',
  about: 'A night sky of tiny stars that twinkle and drift sideways in two depth layers, with the centre kept clear for a subject.',
  category: HfCategory.Ambient,
  origin: HfOrigin.Block,
  source: 'starfield',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 180,
  background: '#05070d',
  fonts: [],
  props: {
    density: { type: 'string', title: 'Density', enum: ['sparse', 'dense'], default: 'sparse', group: 'Style' },
    tone: { type: 'string', title: 'Tone', enum: ['warm', 'cool', 'white'], default: 'warm', group: 'Style' },
    speed: { type: 'string', title: 'Twinkle speed', enum: ['slow', 'fast'], default: 'slow', group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const tones: Record<string, string[]> = { warm: ['#fff7e0', '#ffe08a'], cool: ['#f2f8ff', '#a9d6ff'], white: ['#ffffff', '#ffffff'] };
    const palette = tones[String(p.tone)] ?? tones.warm;
    const count = p.density === 'dense' ? 420 : 180;
    const cycleSeconds = p.speed === 'fast' ? 0.9 : 1.6;
    const duration = view.frames / view.fps;
    const TAU = 2 * Math.PI;
    const FADE = 0.12;
    const rnd = (n: number) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const smooth = (v: number) => {
      const x = Math.min(1, Math.max(0, v / FADE));
      return x * x * (3 - 2 * x);
    };
    const hole = 'radial-gradient(circle 230px at 50% 50%, transparent 0 230px, #000 653px)';

    const stars = Array.from({ length: count }, (_, i) => {
      const r = rnd(i + 7000);
      const tier = r < 0.7 ? 0 : r < 0.95 ? 1 : 2;
      const size = [1, 1.6, 2.6][tier];
      const color = i % 3 === 0 ? palette[1] : palette[0];
      const glow = tier === 2 ? { borderRadius: '50%', boxShadow: `0 0 3px 1px ${color}, 0 0 8px 2px ${color}80` } : {};
      const el = S.h('div', { style: { position: 'absolute', left: 0, top: 0, width: size, height: size, background: color, ...glow } }) as HTMLElement;
      const cycles = Math.max(1, Math.round((duration / cycleSeconds) * (2 + rnd(i + 4000) * 2)));
      return {
        el,
        x: rnd(i + 5000) * W - size / 2,
        y: Math.round(rnd(i + 6000) * H - size / 2),
        drift: (tier === 0 ? 2 : 5) * duration,
        lag: rnd(i + 8000),
        omega: TAU * cycles,
        phi: TAU * rnd(i + 1000),
        base: 0.75 + rnd(i + 2000) * 0.25,
        amp: tier === 2 ? 0.12 : 0.2 + rnd(i + 3000) * 0.2
      };
    });

    view.root.replaceChildren(S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', WebkitMaskImage: hole, maskImage: hole } }, ...stars.map((s) => s.el)));

    return (frame) => {
      const phase = Math.min(1, frame / view.fps / duration);
      stars.forEach((s) => {
        const u = (phase + s.lag) % 1;
        const twinkle = Math.min(1, s.base + s.amp * Math.sin(s.omega * phase + s.phi));
        s.el.style.transform = `translate3d(${s.x - s.drift * (u - 0.5)}px, ${s.y}px, 0)`;
        s.el.style.opacity = String(twinkle * smooth(u) * smooth(1 - u));
      });
    };
  }
};

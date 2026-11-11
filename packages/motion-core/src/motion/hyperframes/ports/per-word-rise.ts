import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'per-word-rise',
  title: 'Per-word rise',
  about: 'Words (or letters) glide up out of a soft blur one after another and settle in the centre, with an optional exit.',
  category: HfCategory.Text,
  origin: HfOrigin.Component,
  source: 'per-word-rise',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 105,
  background: '#0b0c0e',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'WORDS IN MOTION', group: 'Content', maxLength: 160 },
    split: { type: 'string', title: 'Split', default: 'word', enum: ['word', 'char'], group: 'Content' },
    cues: { type: 'string', title: 'Landing cues (seconds, comma separated)', default: '', group: 'Motion', maxLength: 200 },
    accent: { type: 'string', title: 'Accent', default: 'green', enum: ['green', 'blue', 'violet'], group: 'Style' },
    exit: { type: 'string', title: 'Exit', default: 'none', enum: ['none', 'fade', 'up'], group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = 1920;
    const H = 1080;
    const CQW = W / 100;
    const CQH = H / 100;
    const accents = { green: '#71f5a7', blue: '#61a8ff', violet: '#c5a3ff' };
    const text = String(p.text);
    const split = p.split === 'char' ? 'char' : 'word';
    const exit = p.exit === 'fade' || p.exit === 'up' ? p.exit : 'none';
    const cues = String(p.cues).split(',').map((token) => token.trim()).filter(Boolean).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
    const count = Math.max(1, Array.from(text).length);
    const size = Math.min(Math.min(9.5, 126 / count) * CQW, 15 * CQH);
    const segments = split === 'char' ? Array.from(text) : text.trim().split(/\s+/);
    const units = segments.map((segment) => {
      const space = split === 'char' && /\s/.test(segment);
      return S.h('span', { style: { display: 'inline-block', flex: '0 0 auto', width: space ? '0.36em' : undefined } }, space ? ' ' : segment) as HTMLElement;
    });
    const stageEl = S.h('div', { style: { display: 'flex', width: 88 * CQW, alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap', columnGap: split === 'char' ? '0.045em' : 1.8 * CQW, rowGap: 2.8 * CQH, color: accents[String(p.accent)] || accents.green, fontFamily: 'Inter, sans-serif', fontSize: size, fontWeight: 780, lineHeight: 1.08, letterSpacing: split === 'char' ? 0 : '-0.035em', textAlign: 'center' } }, ...units);
    const clip = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } }, stageEl);
    view.root.replaceChildren(clip);

    const duration = view.frames / view.fps;
    const IN_BASE = 1.45;
    const OUT_BASE = exit === 'none' ? 0 : 0.5;
    const scale = duration < IN_BASE + OUT_BASE ? duration / (IN_BASE + OUT_BASE) : 1;
    const IN = IN_BASE * scale;
    const OUT = OUT_BASE * scale;
    const RISE = 0.74 * scale;
    const STAGGER = units.length > 1 ? 0.62 * scale : 0;
    const EXIT_STAGGER = units.length > 1 ? 0.14 * scale : 0;
    const EXIT_MOVE = Math.max(0.001, OUT - EXIT_STAGGER);
    const LAND_SPLIT = 0.78;
    const LAND_RESIDUAL = 0.07;
    const LAND_SEAM_SLOPE = ((1 - LAND_RESIDUAL) / LAND_SPLIT) * 0.5;
    const landEase = (t) => {
      if (t <= 0) {
        return 0;
      }
      if (t >= 1) {
        return 1;
      }
      if (t < LAND_SPLIT) {
        const x = t / LAND_SPLIT;
        const inv = 1 - x;
        return (1 - LAND_RESIDUAL) * (0.5 * (1 - inv * inv * inv) + 0.5 * x);
      }
      const u = (t - LAND_SPLIT) / (1 - LAND_SPLIT);
      const b = LAND_SEAM_SLOPE * (1 - LAND_SPLIT);
      const c = 3 * LAND_RESIDUAL - 2 * b;
      const d = b - 2 * LAND_RESIDUAL;
      return 1 - LAND_RESIDUAL + b * u + c * u * u + d * u * u * u;
    };

    let riseEnd = IN;
    let landings = [];
    if (cues.length > 0) {
      const lastCue = cues[cues.length - 1];
      const gap = cues.length >= 2 ? Math.max(0.05, (lastCue - cues[0]) / (cues.length - 1)) : RISE * 0.4;
      const latest = Math.max(RISE * 0.5, duration - OUT);
      landings = units.map((_, i) => Math.min(latest, Math.max(0.05, i < cues.length ? cues[i] : lastCue + (i - (cues.length - 1)) * gap)));
      riseEnd = Math.min(duration - OUT, Math.max(IN, Math.max(...landings)));
    } else {
      const step = units.length > 1 ? STAGGER / (units.length - 1) : 0;
      landings = units.map((_, i) => i * step + RISE);
    }
    const hold = Math.max(0, duration - (riseEnd + OUT));
    const outStart = riseEnd + hold;

    const BLUR = 1.4 * CQH;
    const tl = S.timeline();
    tl.set(units, { opacity: 0, y: 8 * CQH, filter: 'blur(' + BLUR + 'px)' }, 0);
    units.forEach((unit, i) => {
      const start = Math.max(0, landings[i] - RISE);
      tl.to(unit, { opacity: 1, y: 0, filter: 'blur(0px)', duration: Math.max(0.08, landings[i] - start), ease: landEase }, start);
    });
    if (exit === 'up') {
      tl.to(units, { opacity: 0, y: -4.5 * CQH, filter: 'blur(' + 0.7 * CQH + 'px)', duration: EXIT_MOVE, stagger: { amount: EXIT_STAGGER, from: 'start' }, ease: 'power2.in' }, outStart);
    }
    if (exit === 'fade') {
      tl.to(units, { opacity: 0, duration: EXIT_MOVE, stagger: { amount: EXIT_STAGGER, from: 'start' }, ease: 'power2.in' }, outStart);
    }

    return (frame) => tl.render(frame / view.fps);
  }
};

import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'text-shimmer',
  title: 'Text shimmer',
  about: 'A single large word sits in soft white while a bright accent glint sweeps across it from right to left.',
  category: HfCategory.Text,
  origin: HfOrigin.Component,
  source: 'text-shimmer',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#0b0c0e',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Effortless', group: 'Content', maxLength: 60 },
    accent: { type: 'string', title: 'Accent', default: 'green', enum: ['green', 'blue', 'violet'], group: 'Style' },
    sweep_at: { type: 'number', title: 'Sweep at (s)', default: 1.2, minimum: 0.2, maximum: 2, step: 0.1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const accents = { green: '#22c55e', blue: '#38bdf8', violet: '#a78bfa' };
    const accent = accents[String(p.accent)] || accents.green;
    const FG = '#f8fafc';
    const glow = S.mixOklch(FG, accent, 0.58);
    const glowOuter = S.mixOklch(FG, accent, 0.72);
    const fill = 'linear-gradient(110deg, ' + FG + ' 0%, ' + FG + ' 40%, ' + glow + ' 47%, #ffffff 50%, ' + glowOuter + ' 53%, ' + FG + ' 60%, ' + FG + ' 100%)';
    const head = S.h('span', { style: { display: 'block', maxWidth: 1728, color: 'transparent', fontFamily: 'Inter, sans-serif', fontSize: 172.8, fontWeight: 780, lineHeight: 0.96, letterSpacing: '-0.055em', overflowWrap: 'anywhere', textAlign: 'center', backgroundImage: fill, backgroundRepeat: 'no-repeat', backgroundSize: '300% 100%', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } }, String(p.text)) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 43, overflow: 'hidden' } }, head);
    view.root.replaceChildren(clip);

    const duration = view.frames / view.fps;
    const sweepAt = Math.max(0.2, Math.min(2, Number(p.sweep_at) || 1.2));
    const SWEEP = Math.min(0.9, duration);
    const start = Math.min(sweepAt, Math.max(0, duration - SWEEP));
    const IN = start + SWEEP;
    const hold = Math.max(0, duration - IN);

    const tl = S.timeline();
    tl.set(head, { backgroundPosition: '100% 50%' }, 0);
    tl.to(head, { backgroundPosition: '0% 50%', duration: SWEEP, ease: 'sine.inOut' }, start);
    if (hold > 0) {
      tl.to(head, { backgroundPosition: '4% 50%', duration: hold, ease: 'sine.inOut' }, IN);
    }

    return (frame) => tl.render(frame / view.fps);
  }
};

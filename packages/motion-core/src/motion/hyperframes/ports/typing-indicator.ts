import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'typing-indicator',
  title: 'Typing indicator',
  about: 'A chat bubble with three dots pops in, the dots bob up and down in a wave, then it disappears.',
  category: HfCategory.Card,
  origin: HfOrigin.Component,
  source: 'typing-indicator',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#ffffff',
  fonts: ['Inter'],
  props: {
    size: { type: 'number', title: 'Size', default: 124, minimum: 80, maximum: 220, group: 'Style' },
    tone: { type: 'string', title: 'Tone', enum: ['dark', 'light'], default: 'dark', group: 'Style' },
    tail: { type: 'string', title: 'Tail', enum: ['on', 'off'], default: 'on', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const ZOOM = 3;
    const TONES: Record<string, string> = { dark: '#242428', light: '#e9e9eb' };
    const DOT = '#8e8e93';
    const raw = typeof p.size === 'number' ? p.size : parseFloat(String(p.size));
    const size = Number.isFinite(raw) ? Math.min(220, Math.max(80, raw)) : 124;
    const surface = TONES[String(p.tone)] ?? TONES.dark;
    const tail = p.tail !== 'off';

    const dots = [0, 1, 2].map(() => S.h('span', { style: { width: '0.137em', height: '0.137em', borderRadius: '50%', background: DOT, display: 'inline-block' } }) as HTMLElement);
    const bubble = S.h('div', { style: { width: '1em', height: '0.54em', background: surface, borderRadius: '0.274em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.081em' } }, ...dots);
    const tail1 = S.h('div', { style: { position: 'absolute', left: '-0.016em', bottom: '-0.032em', width: '0.145em', height: '0.145em', borderRadius: '50%', background: surface, display: tail ? 'block' : 'none' } });
    const tail2 = S.h('div', { style: { position: 'absolute', left: '-0.113em', bottom: '-0.113em', width: '0.073em', height: '0.073em', borderRadius: '50%', background: surface, display: tail ? 'block' : 'none' } });
    const wrap = S.h('div', { style: { position: 'relative', display: 'inline-block', fontSize: size, transform: `scale(${ZOOM})`, fontFamily: 'Inter, system-ui, sans-serif' } }, bubble, tail1, tail2) as HTMLElement;
    const stage = S.h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, wrap);
    view.root.replaceChildren(stage);

    const START = 0.3;
    const END = 2.7;

    const tl = S.timeline();
    tl.set(wrap, { opacity: 0 }, 0);
    tl.fromTo(wrap, { scale: ZOOM * 0.6, autoAlpha: 0.4 }, { scale: ZOOM, autoAlpha: 1, duration: 0.1, ease: 'power2.out' }, START);
    dots.forEach((dot, i) => {
      tl.to(dot, { y: -6, duration: 0.28, ease: 'sine.inOut', yoyo: true, repeat: 5 }, START + 0.1 + i * 0.14);
    });
    tl.set(wrap, { autoAlpha: 0 }, END);

    return (frame) => tl.render(frame / view.fps);
  }
};

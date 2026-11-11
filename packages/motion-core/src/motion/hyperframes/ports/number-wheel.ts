import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'number-wheel',
  title: 'Number wheel',
  about: 'Each digit of a big number is a reel that spins from 0 and lands on its own digit, one after another.',
  category: HfCategory.Chart,
  origin: HfOrigin.Component,
  source: 'number-wheel',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#0b0d12',
  fonts: ['Inter'],
  props: {
    value: { type: 'string', title: 'Number', default: '30222', group: 'Content', maxLength: 16 },
    spin: { type: 'string', title: 'Spin', enum: ['single', 'double', 'triple'], default: 'single', group: 'Motion' },
    spacing: { type: 'string', title: 'Spacing', enum: ['tight', 'standard', 'wide'], default: 'standard', group: 'Layout' },
    tone: { type: 'string', title: 'Tone', enum: ['inherit', 'ink', 'paper', 'accent'], default: 'inherit', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const SIZE = 240;
    const SPINS: Record<string, number> = { single: 0, double: 1, triple: 2 };
    const GAPS: Record<string, string> = { tight: '0em', standard: '0.02em', wide: '0.14em' };
    const TONES: Record<string, string> = { inherit: '#f4f7fb', ink: '#18181b', paper: '#fafafa', accent: '#34d399' };
    const cycles = SPINS[String(p.spin)] ?? 0;
    const gap = GAPS[String(p.spacing)] ?? GAPS.standard;
    const color = TONES[String(p.tone)] ?? TONES.inherit;
    const text = String(p.value || '0');

    const strips: HTMLElement[] = [];
    const stops: number[] = [];
    const parts = Array.from(text).map((char) => {
      if (!/\d/.test(char)) {
        return char;
      }
      const stop = cycles * 10 + Number(char);
      const steps = Array.from({ length: stop + 1 }, (_, i) => S.h('span', { style: { display: 'block', height: '1em', lineHeight: '1em' } }, String(i % 10)));
      const strip = S.h('span', { style: { display: 'grid' } }, ...steps) as HTMLElement;
      strips.push(strip);
      stops.push(stop);
      return S.h('span', { style: { display: 'inline-block', height: '1em', overflow: 'hidden' } }, strip);
    });
    const wheel = S.h('span', { style: { display: 'inline-flex', alignItems: 'baseline', gap, color, fontVariantNumeric: 'tabular-nums' } }, ...parts);
    const stage = S.h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', fontSize: SIZE, fontWeight: 700, lineHeight: 1 } }, wheel);
    view.root.replaceChildren(stage);

    const tl = S.timeline();
    strips.forEach((strip, i) => {
      tl.set(strip, { y: 0 }, 0);
      tl.to(strip, { y: -stops[i] * SIZE, duration: 1.1, ease: 'power3.out' }, 0.3 + i * 0.05);
    });

    return (frame) => tl.render(frame / view.fps);
  }
};

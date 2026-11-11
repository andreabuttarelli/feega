import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'count-up',
  title: 'Count up',
  about: 'A big number rises into place, counts smoothly up to its final value and lands with one small scale pulse.',
  category: HfCategory.Chart,
  origin: HfOrigin.Component,
  source: 'count-up',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#0b0d12',
  fonts: ['Inter'],
  props: {
    start: { type: 'number', title: 'Start value', default: 0, group: 'Content' },
    end: { type: 'number', title: 'End value', default: 100, group: 'Content' },
    prefix: { type: 'string', title: 'Prefix', default: '', group: 'Content', maxLength: 12 },
    suffix: { type: 'string', title: 'Suffix', default: '%', group: 'Content', maxLength: 12 },
    accent: { type: 'string', title: 'Accent', enum: ['green', 'blue', 'violet'], default: 'green', group: 'Style' },
    glow: { type: 'boolean', title: 'Glow', default: false, group: 'Style' },
    exit: { type: 'string', title: 'Exit', enum: ['none', 'fade', 'up'], default: 'none', group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const ACCENTS: Record<string, string[]> = {
      green: ['#71f5a7', '#97f6bf', '113,245,167'],
      blue: ['#61a8ff', '#8cbffe', '97,168,255'],
      violet: ['#c5a3ff', '#d3bbfe', '197,163,255']
    };
    const [main, affixColor, rgb] = ACCENTS[String(p.accent)] ?? ACCENTS.green;
    const start = Number.isFinite(Number(p.start)) ? Number(p.start) : 0;
    const end = Number.isFinite(Number(p.end)) ? Number(p.end) : 100;
    const prefix = String(p.prefix ?? '');
    const suffix = String(p.suffix ?? '');
    const exit = p.exit === 'fade' || p.exit === 'up' ? String(p.exit) : 'none';
    const format = (v: number) => Math.round(v).toLocaleString('en-US');
    const lift = (text: string) => {
      if (/^[$€£¥₹₩]$/.test(text)) {
        return '-0.31em';
      }
      if (/^[+−±×=~<>-]+$/.test(text)) {
        return '-0.36em';
      }
      return '0';
    };

    const chars = Math.max(Array.from(prefix + format(start) + suffix).length, Array.from(prefix + format(end) + suffix).length, 1);
    const size = Math.min(Math.min(20, 150 / chars) * W / 100, 0.34 * H);
    const affix = (text: string, side: string) =>
      S.h('span', { style: { position: 'relative', top: lift(text), flex: '0 0 auto', color: affixColor, fontSize: '0.55em', fontWeight: 600, letterSpacing: '-0.02em', display: text ? 'inline' : 'none', [side]: '0.14em' } }, text);
    const value = S.h('span', { style: { display: 'inline-block', minWidth: '1ch' } }, format(start)) as HTMLElement;
    const stage = S.h(
      'div',
      { style: { display: 'flex', width: W * 0.92, alignItems: 'baseline', justifyContent: 'center', overflow: 'hidden', color: main, fontSize: size, fontVariantNumeric: 'tabular-nums', fontWeight: 600, lineHeight: 1, letterSpacing: '-0.045em', textAlign: 'center', transformOrigin: '50% 58%', whiteSpace: 'nowrap', textShadow: p.glow === true ? `0 ${H * 0.024}px ${H * 0.07}px rgba(${rgb},0.24)` : 'none' } },
      affix(prefix, 'marginRight'),
      value,
      affix(suffix, 'marginLeft')
    ) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' } }, stage);
    view.root.replaceChildren(clip);

    const duration = view.frames / view.fps;
    const IN_BASE = 2.05;
    const OUT_BASE = exit === 'none' ? 0 : 0.45;
    const fit = Math.min(1, duration / (IN_BASE + OUT_BASE));
    const IN = IN_BASE * fit;
    const OUT = OUT_BASE * fit;
    const COUNT = 1.72 * fit;
    const HALF = 0.165 * fit;
    const ARRIVE = 0.38 * fit;
    const STILL = 0.25;
    const HOLD = Math.max(0, duration - IN - OUT);
    const OUT_AT = IN + HOLD;
    const drift = Math.max(0, HOLD - STILL);
    const prog = { v: 0 };

    const tl = S.timeline();
    tl.set(stage, { opacity: 0, y: H * 0.022, scale: 0.98 }, 0);
    tl.to(stage, { opacity: 1, duration: ARRIVE, ease: 'power2.out' }, 0);
    tl.to(stage, { y: 0, scale: 1, duration: ARRIVE, ease: 'power3.out' }, 0);
    tl.to(prog, { v: 1, duration: COUNT, ease: 'sine.inOut', onUpdate: () => { value.textContent = format(start + (end - start) * prog.v); } }, 0);
    tl.to(stage, { scale: 1.07, duration: HALF, ease: 'power3.out' }, COUNT);
    tl.to(stage, { scale: 1, duration: HALF, ease: 'power2.out' }, COUNT + HALF);

    if (drift > 0) {
      tl.to(stage, { y: -H * 0.0055, duration: drift / 2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, IN);
    }
    if (exit === 'up') {
      tl.to(stage, { y: -H * 0.022, duration: OUT, ease: 'power2.in' }, OUT_AT);
      tl.to(stage, { opacity: 0, scale: 0.985, duration: OUT, ease: 'power2.in' }, OUT_AT);
    }
    if (exit === 'fade') {
      tl.to(stage, { opacity: 0, duration: OUT, ease: 'power2.in' }, OUT_AT);
    }

    return (frame) => tl.render(frame / view.fps);
  }
};

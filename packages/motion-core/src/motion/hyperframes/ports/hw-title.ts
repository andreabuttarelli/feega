import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'hw-title',
  title: 'Handwritten title',
  about: 'A handwritten line lights up word by word, a wobbly marker underline draws beneath it, and the whole thing boils like hand-drawn animation.',
  category: HfCategory.Title,
  origin: HfOrigin.Block,
  source: 'hw-title',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 180,
  background: '#1b1d23',
  fonts: ['Caveat'],
  props: {
    text: { type: 'string', title: 'Text', default: 'shine like the star you are', group: 'Content', maxLength: 80 },
    fontSize: { type: 'number', title: 'Text size', default: 120, minimum: 40, maximum: 240, step: 2, group: 'Style' },
    scheme: { type: 'string', title: 'Scheme', enum: ['chalk', 'ink'], default: 'chalk', group: 'Style' },
    accent: { type: 'string', title: 'Underline colour', format: PropFormat.Color, default: '#ffb020', group: 'Style' },
    sweep: { type: 'boolean', title: 'Word sweep', default: true, group: 'Motion' },
    sweepStart: { type: 'number', title: 'Sweep start', default: 0.8, minimum: 0, maximum: 4, step: 0.1, group: 'Motion' },
    sweepEnd: { type: 'number', title: 'Sweep end', default: 3.2, minimum: 1, maximum: 5, step: 0.1, group: 'Motion' },
    underline: { type: 'boolean', title: 'Underline', default: true, group: 'Style' },
    wobble: { type: 'number', title: 'Underline wobble', default: 6, minimum: 0, maximum: 14, step: 1, group: 'Style' },
    boil: { type: 'boolean', title: 'Boil', default: true, group: 'Motion' },
    boilAmp: { type: 'number', title: 'Boil amount', default: 1.4, minimum: 0, maximum: 4, step: 0.1, group: 'Motion' },
    boilRot: { type: 'number', title: 'Boil tilt', default: 0.3, minimum: 0, maximum: 2, step: 0.1, group: 'Motion' },
    seed: { type: 'number', title: 'Seed', default: 8, minimum: 1, maximum: 999, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const on = (v: unknown) => v !== false && v !== 'false';
    const num = (v: unknown, fallback: number) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? fallback : Number(v));
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const hash = (n: number, seed: number) => {
      const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
      return (x - Math.floor(x)) * 2 - 1;
    };
    const duration = view.frames / view.fps;
    const seed = num(p.seed, 8);
    const size = num(p.fontSize, 120);
    const inkScheme = p.scheme === 'ink';
    const full = inkScheme ? '#26241f' : '#f4f2ec';
    const faint = inkScheme ? 'rgba(38, 36, 31, 0.3)' : 'rgba(244, 242, 236, 0.32)';
    const sweep = on(p.sweep);
    const sweepStart = num(p.sweepStart, 0.8);
    const sweepEnd = Math.max(sweepStart + 0.1, num(p.sweepEnd, 3.2));
    const boil = on(p.boil);
    const intro = clamp(duration * 0.08, 0.3, 0.8);
    const outro = clamp(duration * 0.06, 0.25, 0.6);
    const words = String(p.text || 'shine like the star you are').split(/\s+/).filter(Boolean);

    const spans = words.map((w) => S.h('span', { style: { display: 'inline', color: 'transparent' } }, w) as HTMLElement);
    const children = spans.flatMap((s, i) => (i ? [' ', s] : [s]));
    const line = S.h('div', { style: { fontFamily: 'Caveat, cursive', fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap', textShadow: '0 2px 18px rgba(0, 0, 0, 0.4)', fontSize: size } }, ...children);

    const width = Math.round(String(p.text).length * size * 0.42);
    const segs = Math.max(6, Math.round(width / 90));
    const wobble = num(p.wobble, 6);
    let d = `M 2 ${(16 + hash(0, seed) * 4).toFixed(1)}`;
    for (let i = 1; i <= segs; i++) {
      const x = (width / segs) * i;
      const y = 16 + hash(i * 5 + 1, seed) * wobble;
      const cx = x - width / segs / 2 + hash(i * 5 + 2, seed) * 10;
      const cy = 16 + (i % 2 ? -1 : 1) * (8 + hash(i * 5 + 3, seed) * 4);
      d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const under = S.h('path', { d, pathLength: 1, fill: 'none', stroke: String(p.accent), strokeWidth: 7, strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke', strokeDasharray: 1 }) as SVGElement;
    const svg = S.h('svg', { viewBox: `0 0 ${width} 34`, preserveAspectRatio: 'none', style: { overflow: 'visible', display: on(p.underline) ? 'block' : 'none', width: '100%', height: 34 } }, under);

    const wrap = S.h('div', { style: { pointerEvents: 'none' } }, line, svg) as HTMLElement;
    const stage = S.fill({ alignItems: 'center', justifyContent: 'center', paddingBottom: 40 }, wrap) as HTMLElement;
    view.root.replaceChildren(stage);

    const tl = S.timeline();
    const step = (t: number) => Math.floor((t * view.fps) / 3);
    tl.set(wrap, { opacity: 0 }, 0);
    tl.set(under, { strokeDashoffset: 1 }, 0);
    tl.to(wrap, { opacity: 1, duration: intro, ease: 'power2.out' }, 0.1);
    tl.set(spans, { color: sweep ? faint : full }, 0);
    if (sweep) {
      const each = (sweepEnd - sweepStart) / spans.length;
      spans.forEach((s, i) => {
        tl.to(s, { color: full, duration: each, ease: 'none' }, sweepStart + i * each);
      });
    }
    tl.to(under, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, sweep ? sweepEnd - 0.2 : 0.8);
    tl.to(wrap, { opacity: 0, duration: outro, ease: 'power2.in' }, duration - outro - 0.05);
    tl.set(stage, { visibility: 'hidden' }, duration - 0.02);

    return (frame) => {
      tl.render(frame / view.fps);
      if (!boil) {
        return;
      }
      const n = step(frame / view.fps);
      const amp = num(p.boilAmp, 1.4);
      const rot = num(p.boilRot, 0.3);
      wrap.style.transform = `translate(${hash(n * 3, seed) * amp}px, ${hash(n * 3 + 1, seed) * amp}px) rotate(${hash(n * 3 + 2, seed) * rot}deg)`;
    };
  }
};

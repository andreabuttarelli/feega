import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'text-swap',
  title: 'Text swap',
  about: 'One line leaves and the next arrives, with six transitions from a motion-blurred fly-through to a hard cut.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 90,
  background: '#faf9f6',
  fonts: [],
  props: {
    fromText: { type: 'string', title: 'From text', default: 'Ship faster', group: 'Content', maxLength: 120 },
    toText: { type: 'string', title: 'To text', default: 'Ship smarter', group: 'Content', maxLength: 120 },
    swap: { type: 'string', title: 'Transition', enum: ['fly-through', 'fade-through', 'crossfade', 'shared-axis-y', 'shared-axis-z', 'cut'], default: 'fly-through', group: 'Motion' },
    unit: { type: 'string', title: 'Unit (auto = per transition)', enum: ['auto', 'word', 'block'], default: 'auto', group: 'Motion' },
    exitDuration: { type: 'number', title: 'Exit (frames, 0 = default)', default: 0, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    enterDuration: { type: 'number', title: 'Enter (frames, 0 = default)', default: 0, minimum: 0, maximum: 120, step: 1, group: 'Motion' },
    exitStagger: { type: 'number', title: 'Exit stagger (frames)', default: 1, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    enterStagger: { type: 'number', title: 'Enter stagger (frames)', default: 2, minimum: 0, maximum: 30, step: 1, group: 'Motion' },
    overlap: { type: 'number', title: 'Overlap (frames)', default: 1, minimum: 0, maximum: 60, step: 1, group: 'Motion' },
    microDelay: { type: 'number', title: 'Micro delay (frames)', default: 2, minimum: 0, maximum: 60, step: 1, group: 'Motion' },
    fontSize: { type: 'number', title: 'Font size (px)', default: 72, minimum: 12, maximum: 300, step: 1, group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 600, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const B = S.Easing.bezier;
    const step1 = (x: number) => (x >= 1 ? 1 : 0);
    const TABLE: Record<string, { unit: string; exit: number; enter: number; m: { exitY: number; exitScale: number; exitBlur: number; enterY: number; enterScale: number; enterBlur: number; perspective?: boolean; fadeStart?: number; trail?: number }; ease: [(x: number) => number, (x: number) => number] }> = {
      'fly-through': { unit: 'block', exit: 20, enter: 16, m: { exitY: 0, exitScale: 12, exitBlur: 0.5, perspective: true, fadeStart: 0.72, trail: 18, enterY: 0, enterScale: 0.82, enterBlur: 9 }, ease: [B(1, 0.65, 0.85, 1), B(0.2, 0.6, 0.35, 1)] },
      'fade-through': { unit: 'block', exit: 8, enter: 13, m: { exitY: -4, exitScale: 1, exitBlur: 0, enterY: 6, enterScale: 0.99, enterBlur: 2 }, ease: [B(0.4, 0, 1, 1), B(0.2, 0, 0, 1)] },
      crossfade: { unit: 'word', exit: 15, enter: 21, m: { exitY: -6, exitScale: 1, exitBlur: 0, enterY: 8, enterScale: 1, enterBlur: 0 }, ease: [B(0.7, 0, 0.84, 0), B(0.16, 1, 0.3, 1)] },
      'shared-axis-y': { unit: 'block', exit: 10, enter: 14, m: { exitY: -24, exitScale: 1, exitBlur: 0, enterY: 24, enterScale: 1, enterBlur: 0 }, ease: [B(0.4, 0, 1, 1), B(0.2, 0, 0, 1)] },
      'shared-axis-z': { unit: 'block', exit: 11, enter: 16, m: { exitY: 0, exitScale: 1.06, exitBlur: 1, enterY: 0, enterScale: 0.9, enterBlur: 2 }, ease: [B(0.4, 0, 1, 1), B(0.2, 0, 0, 1)] },
      cut: { unit: 'word', exit: 8, enter: 8, m: { exitY: 0, exitScale: 1, exitBlur: 0, enterY: 0, enterScale: 1, enterBlur: 0 }, ease: [step1, step1] }
    };
    const row = TABLE[String(p.swap)] ?? TABLE['fly-through'];
    const m = row.m;
    const [exitEase, enterEase] = row.ease;
    const unit = String(p.unit) === 'auto' ? row.unit : String(p.unit);
    const exitDur = Number(p.exitDuration) || row.exit;
    const enterDur = Number(p.enterDuration) || row.enter;
    const exitStagger = Number(p.exitStagger);
    const enterStagger = Number(p.enterStagger);
    const speed = Number(p.speed);
    const isWord = unit === 'word';
    const split = (s: string) => (isWord ? s.split(' ') : [s]);
    const fromSeg = split(String(p.fromText));
    const toSeg = split(String(p.toText));
    const enterStart = Math.max(0, exitDur + Math.max(0, fromSeg.length - 1) * exitStagger - Number(p.overlap) + Number(p.microDelay));
    const fadeStart = m.fadeStart ?? 0;
    const trail = Math.max(1, Math.round(m.trail ?? 1));
    const C = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const persp = (travel: number, max: number) => (max <= 1 ? 1 : 1 / (1 - (1 - 1 / max) * Math.min(Math.max(travel, 0), 0.9999)));

    const lineStyle = { fontSize: Number(p.fontSize), fontWeight: Number(p.fontWeight), color: S.pick(p.color, String(t.foreground)), letterSpacing: '-0.02em', fontFamily: S.pick(p.fontFamily, '-apple-system, BlinkMacSystemFont, sans-serif'), textRendering: 'geometricPrecision' };
    const layer = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const segEl = (text: string) => S.h('span', { style: { display: 'inline-block', marginRight: isWord ? '0.25em' : undefined, transformOrigin: '50% 50%' } }, text) as HTMLElement;

    const samples = Array.from({ length: trail }, () => fromSeg.map(segEl));
    const enters = toSeg.map(segEl);
    view.root.replaceChildren(
      S.h('div', { style: { position: 'absolute', inset: 0, background: 'transparent' } },
        S.h('div', { style: { ...layer, isolation: 'isolate' } }, samples.map((els) => S.h('div', { style: { ...layer, opacity: 1 / trail, mixBlendMode: 'plus-lighter' } }, S.h('span', { style: lineStyle }, els)))),
        S.h('div', { style: layer }, S.h('span', { style: lineStyle }, enters)))
    );

    return (at) => {
      const frame = at * speed;
      samples.forEach((els, sample) => {
        const sf = frame - sample / trail;
        els.forEach((el, i) => {
          const local = sf - i * exitStagger;
          const travel = S.interpolate(local, [0, exitDur], [0, 1], { ...C, easing: exitEase });
          el.style.opacity = String(S.interpolate(local, [fadeStart * exitDur, exitDur], [1, 0], { ...C, easing: exitEase }));
          el.style.translate = `0 ${m.exitY * travel}px`;
          el.style.scale = String(m.perspective ? persp(travel, m.exitScale) : 1 + (m.exitScale - 1) * travel);
          el.style.filter = `blur(${m.exitBlur * travel}px)`;
        });
      });
      enters.forEach((el, j) => {
        const local = frame - enterStart - j * enterStagger;
        const k = (a: number, b: number) => S.interpolate(local, [0, enterDur], [a, b], { ...C, easing: enterEase });
        el.style.opacity = String(k(0, 1));
        el.style.translate = `0 ${k(m.enterY, 0)}px`;
        el.style.scale = String(k(m.enterScale, 1));
        el.style.filter = `blur(${k(m.enterBlur, 0)}px)`;
      });
    };
  }
};

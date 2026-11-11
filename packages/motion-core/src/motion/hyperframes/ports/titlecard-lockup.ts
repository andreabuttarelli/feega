import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'titlecard-lockup',
  title: 'Title card lockup',
  about: 'A centred title card: a small kicker fades up, the big wordmark settles in, a thin rule draws across and a caption fades in below.',
  category: HfCategory.Title,
  origin: HfOrigin.Component,
  source: 'titlecard-lockup',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0b0c0e',
  fonts: ['Inter', 'JetBrains Mono'],
  props: {
    wordmark: { type: 'string', title: 'Wordmark', default: 'NORTHLIGHT', group: 'Content', maxLength: 40 },
    label: { type: 'string', title: 'Label', default: 'MAKE SOMETHING WORTH WATCHING.', group: 'Content', maxLength: 80 },
    kicker: { type: 'string', title: 'Kicker', default: 'INTRODUCING', group: 'Content', maxLength: 40 },
    rule: { type: 'string', title: 'Rule', enum: ['show', 'hide'], default: 'show', group: 'Style' },
    accent: { type: 'string', title: 'Accent', enum: ['green', 'blue', 'violet'], default: 'green', group: 'Style' },
    exit: { type: 'string', title: 'Exit', enum: ['none', 'fade', 'up'], default: 'none', group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = view.width;
    const H = view.height;
    const MIN = Math.min(W, H);
    const RULES: Record<string, string> = { green: '#a7f7c9', blue: '#9dc9fe', violet: '#d9c6fe' };
    const clean = (value: unknown, fallback: string) => (value == null ? fallback : String(value).trim().replace(/\s+/g, ' '));
    const wordmark = clean(p.wordmark, 'NORTHLIGHT');
    const label = clean(p.label, 'MAKE SOMETHING WORTH WATCHING.');
    const kicker = clean(p.kicker, 'INTRODUCING');
    const ruleShown = p.rule !== 'hide';
    const exit = p.exit === 'fade' || p.exit === 'up' ? String(p.exit) : 'none';
    const ruleColor = RULES[String(p.accent)] ?? RULES.green;
    const dim = '#9fa1a3';
    const mono = 'JetBrains Mono, ui-monospace, Menlo, Consolas, monospace';
    const wordSize = Math.min((Math.min(12, 84 / (Math.max(1, Array.from(wordmark).length) * 0.78)) * W) / 100, H * 0.22);

    const kickerEl = S.h('span', { style: { display: kicker ? 'block' : 'none', marginBottom: H * 0.034, color: dim, fontFamily: mono, fontSize: MIN * 0.026, fontWeight: 600, lineHeight: 1, letterSpacing: '0.3em', textIndent: '0.3em', textTransform: 'uppercase' } }, kicker) as HTMLElement;
    const wordEl = S.h('span', { style: { display: 'block', maxWidth: W * 0.92, color: '#f8fafc', fontSize: wordSize, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.03em', whiteSpace: 'nowrap', transformOrigin: '50% 50%' } }, wordmark) as HTMLElement;
    const ruleLine = S.h('line', { x1: 0, y1: 1, x2: 560, y2: 1, pathLength: 1, stroke: ruleColor, strokeWidth: 2, strokeOpacity: 0.62, style: { strokeDasharray: '1 1', strokeDashoffset: '1' } }) as SVGElement;
    const ruleSvg = S.h('svg', { viewBox: '0 0 560 2', preserveAspectRatio: 'none', style: { display: ruleShown ? 'block' : 'none', width: W * 0.34, height: Math.max(1, MIN * 0.002), marginTop: H * 0.04 } }, ruleLine);
    const labelEl = S.h('span', { style: { display: label ? 'block' : 'none', marginTop: H * 0.032, color: dim, fontFamily: mono, fontSize: MIN * 0.022, fontWeight: 600, lineHeight: 1.4, letterSpacing: '0.34em', textIndent: '0.34em', textTransform: 'uppercase' } }, label) as HTMLElement;
    const lockup = S.h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: W * 0.92, textAlign: 'center' } }, kickerEl, wordEl, ruleSvg, labelEl) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' } }, lockup);
    view.root.replaceChildren(clip);

    const duration = view.frames / view.fps;
    const IN = 1.8;
    const OUT = exit === 'none' ? 0 : 0.5;
    const fit = Math.min(1, duration / (IN + OUT));
    const outAt = IN * fit + Math.max(0, duration - (IN + OUT) * fit);

    const tl = S.timeline();
    tl.fromTo(kickerEl, { autoAlpha: 0, y: H * 0.022 }, { autoAlpha: 1, y: 0, duration: 0.45 * fit, ease: 'power2.out' }, 0);
    tl.fromTo(wordEl, { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1, duration: 0.85 * fit, ease: 'power3.out' }, 0.25 * fit);
    tl.fromTo(ruleLine, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.55 * fit, ease: 'power2.out' }, 0.9 * fit);
    tl.fromTo(labelEl, { autoAlpha: 0, y: H * 0.018 }, { autoAlpha: 1, y: 0, duration: 0.5 * fit, ease: 'power2.out' }, 1.3 * fit);

    if (exit === 'fade') {
      tl.to(lockup, { autoAlpha: 0, duration: OUT * fit, ease: 'power2.in' }, outAt);
    }
    if (exit === 'up') {
      tl.to(lockup, { autoAlpha: 0, y: -H * 0.024, duration: OUT * fit, ease: 'power2.in' }, outAt);
    }

    return (frame) => tl.render(frame / view.fps);
  }
};

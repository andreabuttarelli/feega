import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'headline-slam',
  title: 'Headline slam',
  about: 'A heavy headline slams in from large and transparent, shakes on impact, then floats and flies off the top.',
  category: HfCategory.Text,
  origin: HfOrigin.Component,
  source: 'headline-slam',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 105,
  background: '#0b0c0e',
  fonts: ['Inter'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Ship it today', group: 'Content', maxLength: 80 },
    accent_word_index: { type: 'number', title: 'Accent word (0 = first)', default: 1, minimum: -1, maximum: 20, step: 1, group: 'Style' },
    accent: { type: 'string', title: 'Accent', default: 'green', enum: ['green', 'blue', 'violet'], group: 'Style' },
    shadow: { type: 'boolean', title: 'Shadow', default: true, group: 'Style' },
    color: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#f8fafc', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = 1920;
    const H = 1080;
    const CQW = W / 100;
    const CQH = H / 100;
    const accents = { green: '#71f5a7', blue: '#61a8ff', violet: '#b895ff' };
    const accent = accents[String(p.accent)] || accents.green;
    const text = String(p.text);
    const words = text.trim() === '' ? [] : text.trim().split(/\s+/);
    const accentAt = Number.isFinite(Number(p.accent_word_index)) ? Math.trunc(Number(p.accent_word_index)) : 1;
    const wide = text.length * 10.5 * 0.62 > 56;
    const size = (wide ? Math.max(3.5, 56 / (text.length * 0.62)) : 10.5) * CQW;
    const spans = words.map((word, i) => S.h('span', { style: { display: 'inline-block', color: i === accentAt ? accent : undefined } }, word));
    const shadow = p.shadow === false || p.shadow === 'false' ? 'none' : '0 ' + 1.2 * CQH + 'px ' + 4.5 * CQH + 'px rgba(0, 0, 0, 0.52)';
    const head = S.h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 * CQW, width: 90 * CQW, minHeight: 22 * CQH, color: String(p.color), fontFamily: 'Inter, sans-serif', fontSize: size, fontWeight: 900, lineHeight: 0.88, letterSpacing: -0.5 * CQW, textAlign: 'center', whiteSpace: 'nowrap', textShadow: shadow, transformOrigin: '50% 50%' } }, ...spans) as HTMLElement;
    const stage = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, head) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden' } }, stage);
    view.root.replaceChildren(clip);

    const duration = view.frames / view.fps;
    const IN_BASE = 0.72;
    const OUT_BASE = 0.46;
    const scale = duration < IN_BASE + OUT_BASE ? duration / (IN_BASE + OUT_BASE) : 1;
    const IN = IN_BASE * scale;
    const OUT = OUT_BASE * scale;
    const LAND = 0.58 * scale;
    const SHAKE = (1 / 30) * scale;
    const hold = Math.max(0, duration - IN - OUT);
    const outStart = IN + hold;

    const tl = S.timeline();
    tl.set(head, { scale: 1.6, opacity: 0, y: 0 }, 0);
    tl.set(stage, { x: 0, y: 0 }, 0);
    tl.to(head, { scale: 1, opacity: 1, y: 0, duration: LAND, ease: 'expo.out' }, 0);
    tl.to(stage, { x: 0.55 * CQW, y: -0.3 * CQH, duration: SHAKE, ease: 'power2.out' }, LAND);
    tl.to(stage, { x: -0.38 * CQW, y: 0.2 * CQH, duration: SHAKE, ease: 'power2.out' }, LAND + SHAKE);
    tl.to(stage, { x: 0, y: 0, duration: SHAKE, ease: 'power2.out' }, LAND + SHAKE * 2);
    if (hold > 0) {
      tl.to(head, { y: -0.55 * CQH, duration: hold / 2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, IN);
    }
    tl.to(head, { y: -120 * CQH, duration: OUT, ease: 'power4.in' }, outStart);

    return (frame) => tl.render(frame / view.fps);
  }
};

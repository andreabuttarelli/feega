import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'scramble-reveal',
  title: 'Scramble reveal',
  about: 'A terminal-style word slides in as random glyphs that lock into the real letters from left to right.',
  category: HfCategory.Text,
  origin: HfOrigin.Component,
  source: 'scramble-reveal',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#0b0c0e',
  fonts: ['JetBrains Mono'],
  props: {
    text: { type: 'string', title: 'Text', default: 'SIGNAL LOCKED', group: 'Content', maxLength: 60 },
    accent: { type: 'string', title: 'Accent', default: 'green', enum: ['green', 'blue', 'violet'], group: 'Style' },
    style: { type: 'string', title: 'Style', default: 'terminal', enum: ['terminal', 'clean'], group: 'Style' },
    exit: { type: 'string', title: 'Exit', default: 'none', enum: ['none', 'fade', 'up'], group: 'Motion' },
    foreground: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#f8fafc', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = 1920;
    const H = 1080;
    const CQW = W / 100;
    const CQH = H / 100;
    const accents = { green: '#71f5a7', blue: '#61a8ff', violet: '#c5a3ff' };
    const accent = accents[String(p.accent)] || accents.green;
    const fg = String(p.foreground);
    const clean = p.style === 'clean';
    const exit = p.exit === 'fade' || p.exit === 'up' ? p.exit : 'none';
    const text = String(p.text);
    const characters = Array.from(text);
    const size = Math.min(Math.min(11, 118 / Math.max(1, characters.length)) * CQW, 24 * CQH);
    const font = 'JetBrains Mono, monospace';

    const prefix = S.h('span', { style: { display: clean ? 'none' : 'block', flex: '0 0 auto', marginRight: 1.8 * CQW, color: S.mixOklch(fg, accent, 0.78), fontFamily: font, fontSize: size * 0.74, fontWeight: 700, lineHeight: 1, opacity: 0.78 } }, '>_');
    const label = S.h('span', { style: { display: 'block', minWidth: 0, overflow: 'hidden', color: accent, fontFamily: font, fontSize: size, fontWeight: 780, lineHeight: 1, letterSpacing: '0.055em', textAlign: 'center', textShadow: '0 0 ' + 2.8 * CQH + 'px ' + S.withAlpha(accent, 0.34), whiteSpace: 'pre' } }) as HTMLElement;
    const shell = S.h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: (clean ? 26 : 34) * CQH, padding: clean ? 3 * CQH + 'px ' + 2 * CQW + 'px' : 5 * CQH + 'px ' + 5 * CQW + 'px', overflow: 'hidden', border: clean ? '1.7px solid transparent' : '1.7px solid ' + S.withAlpha(accent, 0.6), borderRadius: 26, background: clean ? 'transparent' : S.mixOklch('#0b1016', accent, 0.08), boxShadow: clean ? 'none' : '0 ' + 3.5 * CQH + 'px ' + 10 * CQH + 'px rgba(0, 0, 0, 0.42), inset 0 0 ' + 4 * CQH + 'px ' + S.withAlpha(accent, 0.07) } }, prefix, label);
    const stage = S.h('div', { style: { width: 88 * CQW } }, shell) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } }, stage);
    view.root.replaceChildren(clip);

    const FPS = 30;
    const duration = view.frames / view.fps;
    const IN_BASE = 1.65;
    const OUT_BASE = exit === 'none' ? 0 : 0.45;
    const scale = duration < IN_BASE + OUT_BASE ? duration / (IN_BASE + OUT_BASE) : 1;
    const IN = IN_BASE * scale;
    const OUT = OUT_BASE * scale;
    const ARRIVAL = 0.42 * scale;
    const LOCK_TAIL = 0.15 * scale;
    const STILLNESS = 0.3;
    const hold = Math.max(0, duration - (IN + OUT));
    const outStart = IN + hold;
    const lastFrame = Math.max(1, Math.round(Math.max(0, IN - LOCK_TAIL) * FPS));

    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+?<>';
    const first = Math.min(lastFrame, Math.max(1, Math.round(0.2 * FPS * scale)));
    const locks = characters.map((character, index) => {
      if (/\s/.test(character)) {
        return 0;
      }
      const at = characters.length <= 1 ? 1 : index / (characters.length - 1);
      return Math.round(first + at * (lastFrame - first));
    });
    let state = 0x27c0ffee;
    const rows = [];
    for (let frame = 0; frame <= lastFrame; frame += 1) {
      rows.push(characters.map((character, index) => {
        if (/\s/.test(character) || frame >= locks[index]) {
          return character;
        }
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        const at = state % glyphs.length;
        const glyph = glyphs.charAt(at);
        return glyph === character ? glyphs.charAt((at + 1) % glyphs.length) : glyph;
      }).join(''));
    }

    const tl = S.timeline();
    tl.set(stage, { opacity: 0, x: -4 * CQW, y: 2.4 * CQH }, 0);
    tl.to(stage, { opacity: 1, duration: ARRIVAL, ease: 'power2.out' }, 0);
    tl.to(stage, { x: 0, duration: ARRIVAL, ease: 'power3.out' }, 0);
    tl.to(stage, { y: 0, duration: ARRIVAL, ease: 'sine.inOut' }, 0);
    tl.call((_, t) => {
      label.textContent = rows[Math.min(lastFrame, Math.max(0, Math.floor(t * FPS + 1e-6)))];
    }, 0);
    const drift = Math.max(0, hold - STILLNESS) / 2;
    if (drift > 0) {
      tl.to(stage, { y: -0.55 * CQH, duration: drift, ease: 'sine.inOut', yoyo: true, repeat: 1 }, IN);
    }
    if (exit === 'up') {
      tl.to(stage, { x: 5 * CQW, duration: OUT, ease: 'power2.in' }, outStart);
      tl.to(stage, { y: -3.5 * CQH, duration: OUT, ease: 'sine.inOut' }, outStart);
      tl.to(stage, { opacity: 0, duration: OUT, ease: 'power2.in' }, outStart);
    }
    if (exit === 'fade') {
      tl.to(stage, { opacity: 0, duration: OUT, ease: 'power2.in' }, outStart);
    }

    return (frame) => tl.render(frame / view.fps);
  }
};

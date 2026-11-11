import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'ticker-takeover',
  title: 'Ticker takeover',
  about: 'A slot-machine ticker spins through candidate words, locks on the final one with a flash, then it grows into a big headline.',
  category: HfCategory.Text,
  origin: HfOrigin.Component,
  source: 'ticker-takeover',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 135,
  background: '#0b0c0e',
  fonts: ['Inter', 'JetBrains Mono'],
  props: {
    options: { type: 'string', title: 'Words (comma separated)', default: 'faster,smarter,together,everywhere', group: 'Content', maxLength: 200 },
    final_word: { type: 'string', title: 'Final word', default: 'together', group: 'Content', maxLength: 40 },
    label: { type: 'string', title: 'Ticker label', default: 'signal', group: 'Content', maxLength: 20 },
    accent: { type: 'string', title: 'Accent', default: 'green', enum: ['green', 'blue', 'violet'], group: 'Style' },
    foreground: { type: 'string', title: 'Text colour', format: PropFormat.Color, default: '#f8fafc', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const W = 1920;
    const H = 1080;
    const CQW = W / 100;
    const CQH = H / 100;
    const accents = { green: '#22c55e', blue: '#38bdf8', violet: '#a78bfa' };
    const accent = accents[String(p.accent)] || accents.green;
    const fg = String(p.foreground);
    const MUTED = '#94a3b8';
    const mono = 'JetBrains Mono, monospace';
    const defaults = ['faster', 'smarter', 'together', 'everywhere'];
    const finalWord = String(p.final_word).trim() || 'together';
    const finalKey = finalWord.toLowerCase();
    const options = [];
    const add = (word) => {
      const key = word.toLowerCase();
      if (key !== finalKey && !options.some((o) => o.toLowerCase() === key) && options.length < 5) {
        options.push(word);
      }
    };
    String(p.options).split(',').map((w) => w.trim()).filter(Boolean).forEach(add);
    defaults.forEach((w) => {
      if (options.length < 3) {
        add(w);
      }
    });
    options.push(finalWord);

    const ROW = 12 * CQH;
    const items = options.map((word) => S.h('span', { style: { display: 'flex', alignItems: 'center', height: ROW, padding: '0 ' + 4 * CQW + 'px', color: fg, fontFamily: mono, fontSize: 4.2 * CQH, fontWeight: 650, letterSpacing: '-0.025em', whiteSpace: 'nowrap' } }, word) as HTMLElement);
    const finalItem = items[items.length - 1];
    const reel = S.h('div', { style: { width: '100%' } }, ...items) as HTMLElement;
    const flash = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: accent } }) as HTMLElement;
    const label = S.h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: ROW, borderRight: '2px solid ' + S.withAlpha(MUTED, 0.3), color: MUTED, fontFamily: mono, fontSize: 2.4 * CQH, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' } }, String(p.label));
    const slot = S.h('div', { style: { position: 'relative', height: ROW, overflow: 'hidden' } }, reel);
    const ticker = S.h('div', { style: { position: 'absolute', top: 55 * CQH, left: 12 * CQW, width: 76 * CQW, height: 18 * CQH, display: 'grid', gridTemplateColumns: 18 * CQW + 'px 1fr', alignItems: 'center', overflow: 'hidden', border: '2px solid ' + S.withAlpha(MUTED, 0.38), borderRadius: 3 * CQH, background: 'rgba(23, 32, 51, 0.92)', boxShadow: '0 ' + 3 * CQH + 'px ' + 9 * CQH + 'px rgba(11, 12, 14, 0.52)' } }, label, slot, flash) as HTMLElement;
    const head = S.h('div', { style: { position: 'absolute', top: 30 * CQH, left: 7 * CQW, width: 86 * CQW, height: 30 * CQH, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: accent, fontFamily: 'Inter, sans-serif', fontSize: 15 * CQH, fontWeight: 820, lineHeight: 0.9, letterSpacing: '-0.065em', textAlign: 'center', whiteSpace: 'nowrap', transformOrigin: '50% 50%' } }, finalWord) as HTMLElement;
    const clip = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden' } }, ticker, head);
    view.root.replaceChildren(clip);

    const duration = view.frames / view.fps;
    const IN_BASE = 3.15;
    const OUT_BASE = 0.45;
    const scale = duration < IN_BASE + OUT_BASE ? duration / (IN_BASE + OUT_BASE) : 1;
    const IN = IN_BASE * scale;
    const OUT = OUT_BASE * scale;
    const hold = Math.max(0, duration - IN - OUT);
    const outStart = IN + hold;
    const TICKER_IN = 0.35 * scale;
    const ROLL = 0.32 * scale;
    const ACCEL = 0.82 * scale;
    const DECEL = 0.93 * scale;
    const LOCK = ROLL + ACCEL + DECEL;
    const PROMOTE = LOCK + 0.18 * scale;
    const PROMOTE_FOR = Math.max(0.001, IN - PROMOTE);
    const finalOffset = -(options.length - 1) * ROW;

    const tl = S.timeline();
    tl.set(flash, { opacity: 0.82 }, 0);
    tl.set(reel, { y: 0 }, 0);
    tl.fromTo(ticker, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: TICKER_IN, ease: 'power2.out' }, 0);
    tl.fromTo(reel, { y: 0 }, { y: finalOffset * 0.72, duration: ACCEL, ease: 'power4.in' }, ROLL);
    tl.to(reel, { y: finalOffset, duration: DECEL, ease: 'power4.out' }, ROLL + ACCEL);
    tl.fromTo(finalItem, { scale: 1.14, color: accent }, { scale: 1, color: accent, duration: 0.3 * scale, ease: 'expo.out' }, LOCK);
    tl.fromTo(flash, { opacity: 0.82 }, { opacity: 0, duration: 0.34 * scale, ease: 'power2.out' }, LOCK);
    tl.fromTo(head, { opacity: 0, scale: 0.22, y: 20 * CQH }, { opacity: 1, scale: 1, y: 0, duration: PROMOTE_FOR, ease: 'power3.out' }, PROMOTE);
    tl.to(ticker, { opacity: 0, scale: 0.96, duration: PROMOTE_FOR * 0.68, ease: 'power2.in' }, PROMOTE);
    if (hold > 0) {
      tl.to(head, { y: -0.7 * CQH, duration: hold / 2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, IN);
    }
    tl.to(head, { opacity: 0, y: -3 * CQH, duration: OUT, ease: 'power2.in' }, outStart);

    return (frame) => tl.render(frame / view.fps);
  }
};

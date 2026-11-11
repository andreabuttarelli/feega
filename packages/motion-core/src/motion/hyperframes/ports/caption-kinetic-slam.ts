import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'caption-kinetic-slam',
  title: 'Caption, kinetic slam',
  about: 'One huge word at a time slams onto the centre of the screen from above, the sides or by scaling up.',
  category: HfCategory.Caption,
  origin: HfOrigin.Component,
  source: 'caption-kinetic-slam',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 240,
  background: '#0b0d12',
  fonts: ['Anton'],
  props: {
    text: { type: 'string', title: 'Caption', default: 'Every great video starts with a single frame. Feega lets you write HTML and render professional video. No timeline. No drag and drop. Just code that becomes cinema.', group: 'Content', maxLength: 600 },
    emphasis: { type: 'string', title: 'Emphasised words', default: 'Feega,HTML,professional,code,cinema', group: 'Content', maxLength: 200 },
    color: { type: 'string', title: 'Text', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    key: { type: 'string', title: 'Keyword colour', format: PropFormat.Color, default: '#FFD700', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const TIMES = [[0, 0.3], [0.3, 0.55], [0.55, 0.85], [0.85, 1.1], [1.1, 1.25], [1.25, 1.35], [1.35, 1.65], [1.65, 2], [2.1, 2.65], [2.65, 2.85], [2.85, 2.95], [2.95, 3.15], [3.15, 3.55], [3.55, 3.65], [3.65, 3.95], [3.95, 4.45], [4.45, 4.8], [4.9, 5.05], [5.05, 5.45], [5.5, 5.65], [5.65, 5.85], [5.85, 5.95], [5.95, 6.25], [6.35, 6.55], [6.55, 6.8], [6.8, 6.95], [6.95, 7.3], [7.3, 7.7]];
    let last = 0;
    const words = String(p.text).split(/\s+/).filter(Boolean).map((text, i) => {
      const t = TIMES[i] || [last + 0.1, last + 0.4];
      last = t[1];
      return { text, start: t[0], end: t[1] };
    });
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const marks = new Set(String(p.emphasis).split(',').map(norm).filter(Boolean));
    const isKey = (i) => marks.has(norm(words[i].text));
    const ctx = document.createElement('canvas').getContext('2d');
    const fit = (text, base, weight, family, maxW) => {
      const min = Math.floor(base * 0.45);
      for (let size = base; size > min; size -= 2) {
        ctx.font = weight + ' ' + size + 'px ' + family;
        if (ctx.measureText(text).width <= maxW) {
          return size;
        }
      }
      return min;
    };
    const chunks = (n) => {
      const out = [];
      for (let i = 0; i < words.length; i += n) {
        out.push([i, Math.min(i + n, words.length) - 1]);
      }
      return out;
    };
    const DEFAULT_WORDS = 28;
    const box = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } }) as HTMLElement;
    view.root.replaceChildren(box);
    const tl = S.timeline();
    const modes = [
      [{ y: -120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.22, ease: 'back.out(1.7)' }],
      [{ x: -300, opacity: 0 }, { x: 0, opacity: 1, duration: 0.2, ease: 'expo.out' }],
      [{ x: 300, opacity: 0 }, { x: 0, opacity: 1, duration: 0.2, ease: 'expo.out' }],
      [{ scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.24, ease: 'back.out(2.2)' }]
    ];

    words.forEach((w, wi) => {
      const label = w.text.toUpperCase();
      const el = S.h('div', { style: { fontFamily: 'Anton, sans-serif', fontWeight: 400, fontSize: fit(label, 220, '400', "'Anton', sans-serif", 1720), color: isKey(wi) ? String(p.key) : String(p.color), position: 'absolute', left: 0, width: '100%', textAlign: 'center', top: '50%', letterSpacing: '0.04em', lineHeight: 1 } }, label) as HTMLElement;
      box.appendChild(el);

      const mode = modes[wi % 4];
      tl.set(el, { yPercent: -50, x: 0, y: 0, scale: 1, opacity: 0, visibility: 'hidden' }, 0);
      tl.set(el, { visibility: 'visible' }, w.start);
      tl.fromTo(el, mode[0], mode[1], w.start);
      tl.to(el, { opacity: 0, duration: 0.1, ease: 'power2.in' }, w.end);
      tl.set(el, { opacity: 0, visibility: 'hidden' }, w.end + 0.1);
    });

    return (frame) => tl.render(frame / view.fps);
  }
};

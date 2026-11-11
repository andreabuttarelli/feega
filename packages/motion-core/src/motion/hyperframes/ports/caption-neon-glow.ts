import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'caption-neon-glow',
  title: 'Caption, neon glow',
  about: 'Dim uppercase words light up in cyan, or pink for keywords, with a soft neon glow as each is spoken.',
  category: HfCategory.Caption,
  origin: HfOrigin.Component,
  source: 'caption-neon-glow',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 240,
  background: '#0b0d12',
  fonts: ['Outfit'],
  props: {
    text: { type: 'string', title: 'Caption', default: 'Every great video starts with a single frame. Feega lets you write HTML and render professional video. No timeline. No drag and drop. Just code that becomes cinema.', group: 'Content', maxLength: 600 },
    emphasis: { type: 'string', title: 'Emphasised words', default: 'Feega,HTML,professional,code,cinema', group: 'Content', maxLength: 200 },
    color: { type: 'string', title: 'Glow', format: PropFormat.Color, default: '#00FFF0', group: 'Style' },
    key: { type: 'string', title: 'Keyword glow', format: PropFormat.Color, default: '#FF0099', group: 'Style' },
    dim: { type: 'string', title: 'Unlit colour', format: PropFormat.Color, default: 'rgba(0,255,240,0.14)', group: 'Style' }
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
    const table = words.length === DEFAULT_WORDS ? [[0, 3, 0, 1.05], [4, 7, 1.1, 2.05], [8, 8, 2.1, 2.6], [9, 12, 2.65, 3.5], [13, 15, 3.55, 4.4], [16, 16, 3.95, 4.75], [17, 19, 4.9, 5.4], [20, 22, 5.65, 6.2], [23, 24, 6.35, 6.75], [25, 27, 6.8, 7.8]] : chunks(3).map(([ws, we]) => [ws, we, words[ws].start, words[we].end + 0.25]);

    table.forEach(([ws, we, start, end]) => {
      const list = words.slice(ws, we + 1);
      const size = fit(list.map((w) => w.text.toUpperCase()).join(' '), 96, '900', "'Outfit', sans-serif", 1760);
      const els = list.map((w) => S.h('span', { style: { fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: size, textTransform: 'uppercase', display: 'inline-block', letterSpacing: '0.04em', lineHeight: 1 } }, w.text) as HTMLElement);
      const grp = S.h('div', { style: { position: 'absolute', bottom: 120, left: 0, width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', gap: 24, padding: '0 80px' } }, ...els) as HTMLElement;
      box.appendChild(grp);

      tl.set(grp, { visibility: 'hidden', opacity: 0, x: 0 }, 0);
      tl.set(els, { color: String(p.dim), textShadow: '0 0 10px transparent, 0 0 35px transparent, 0 0 90px transparent' }, 0);
      tl.set(grp, { visibility: 'visible', opacity: 0 }, start);
      tl.fromTo(grp, { opacity: 0 }, { opacity: 1, duration: 0.05, ease: 'steps(1)' }, start);
      tl.fromTo(grp, { x: -8 }, { x: 0, duration: 0.14, ease: 'power3.out' }, start + 0.05);
      list.forEach((w, i) => {
        const glow = isKey(ws + i) ? String(p.key) : String(p.color);
        tl.to(els[i], { color: glow, textShadow: '0 0 10px ' + glow + ', 0 0 35px ' + glow + ', 0 0 90px ' + glow, duration: 0.06 }, w.start);
        tl.to(els[i], { color: String(p.dim), textShadow: '0 0 10px transparent, 0 0 35px transparent, 0 0 90px transparent', duration: 0.06 }, w.end);
      });
      tl.to(grp, { opacity: 0, x: 6, duration: 0.1, ease: 'steps(1)' }, end - 0.1);
      tl.set(grp, { opacity: 0, visibility: 'hidden' }, end);
    });

    return (frame) => tl.render(frame / view.fps);
  }
};

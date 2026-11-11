import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'caption-gradient-fill',
  title: 'Caption, gradient fill',
  about: 'Each word fills with a warm sunset gradient sweeping right to left as it is spoken, with a small pop.',
  category: HfCategory.Caption,
  origin: HfOrigin.Component,
  source: 'caption-gradient-fill',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 240,
  background: '#0b0d12',
  fonts: ['Montserrat'],
  props: {
    text: { type: 'string', title: 'Caption', default: 'Every great video starts with a single frame. Feega lets you write HTML and render professional video. No timeline. No drag and drop. Just code that becomes cinema.', group: 'Content', maxLength: 600 },
    emphasis: { type: 'string', title: 'Emphasised words', default: 'Feega,HTML,professional,code,cinema', group: 'Content', maxLength: 200 },
    c1: { type: 'string', title: 'Gradient 1', format: PropFormat.Color, default: '#fe9f1b', group: 'Style' },
    c2: { type: 'string', title: 'Gradient 2', format: PropFormat.Color, default: '#f76e49', group: 'Style' },
    c3: { type: 'string', title: 'Gradient 3', format: PropFormat.Color, default: '#ff2063', group: 'Style' },
    c4: { type: 'string', title: 'Gradient 4', format: PropFormat.Color, default: '#fd56cb', group: 'Style' },
    c5: { type: 'string', title: 'Gradient 5', format: PropFormat.Color, default: '#ef7aff', group: 'Style' },
    rest: { type: 'string', title: 'Unspoken colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' }
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
    const RAW = [[0, 3], [4, 7], [8, 8], [9, 12], [13, 14], [15, 16], [17, 18], [19, 22], [23, 24], [25, 27]];
    const raw = words.length === DEFAULT_WORDS ? RAW : chunks(4);
    const FILL = 'linear-gradient(90deg, ' + String(p.c1) + ' 0%, ' + String(p.c2) + ' 10%, ' + String(p.c3) + ' 20%, ' + String(p.c4) + ' 30%, ' + String(p.c5) + ' 40%, ' + String(p.c1) + ' 50%, ' + String(p.rest) + ' 50.5%, ' + String(p.rest) + ' 100%)';

    raw.forEach(([ws, we], gi) => {
      const list = words.slice(ws, we + 1);
      const start = words[ws].start;
      const lastEnd = words[we].end;
      const next = gi < raw.length - 1 ? words[raw[gi + 1][0]].start : lastEnd + 0.5;
      const fade = Math.min(0.25, (next - lastEnd) * 0.8);
      const size = fit(list.map((w) => w.text).join(' '), 100, '900', "'Montserrat', sans-serif", 1760);
      const els = list.map((w) => S.h('span', { style: { fontFamily: 'Montserrat, sans-serif', fontWeight: 900, fontSize: size, display: 'inline-block', letterSpacing: '0.04em', lineHeight: 1.15, paddingBottom: '0.05em', background: FILL, backgroundSize: '350% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } }, w.text) as HTMLElement);
      const grp = S.h('div', { style: { position: 'absolute', bottom: 120, left: 0, width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', gap: 24, padding: '0 80px' } }, ...els) as HTMLElement;
      box.appendChild(grp);

      tl.set(grp, { visibility: 'hidden', opacity: 0 }, 0);
      tl.set(els, { backgroundPosition: '100% 0', scale: 1 }, 0);
      tl.set(grp, { visibility: 'visible', opacity: 1 }, start);
      list.forEach((w, i) => {
        const el = els[i];
        tl.set(el, { backgroundPosition: '100% 0', scale: 1 }, start);
        tl.set(el, { scale: 1.04 }, w.start);
        tl.fromTo(el, { backgroundPosition: '45% 0' }, { backgroundPosition: '0% 0', duration: w.end - w.start, ease: 'none' }, w.start);
        tl.set(el, { backgroundPosition: '100% 0' }, w.end);
        tl.to(el, { scale: 1, duration: 0.15, ease: 'power2.out' }, w.end);
      });
      tl.to(grp, { opacity: 0, duration: fade }, next - fade);
      tl.set(grp, { visibility: 'hidden' }, next);
    });

    return (frame) => tl.render(frame / view.fps);
  }
};

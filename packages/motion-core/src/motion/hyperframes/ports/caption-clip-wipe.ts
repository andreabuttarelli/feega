import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'caption-clip-wipe',
  title: 'Caption, clip wipe',
  about: 'Words wipe in one by one from the left, keywords flash gold, then each line wipes out to the right.',
  category: HfCategory.Caption,
  origin: HfOrigin.Component,
  source: 'caption-clip-wipe',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 240,
  background: '#0b0d12',
  fonts: ['Poppins'],
  props: {
    text: { type: 'string', title: 'Caption', default: 'Every great video starts with a single frame. Feega lets you write HTML and render professional video. No timeline. No drag and drop. Just code that becomes cinema.', group: 'Content', maxLength: 600 },
    emphasis: { type: 'string', title: 'Emphasised words', default: 'Feega,HTML,professional,code,cinema', group: 'Content', maxLength: 200 },
    color: { type: 'string', title: 'Text', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    key: { type: 'string', title: 'Keyword colour', format: PropFormat.Color, default: '#FFD700', group: 'Style' },
    dim: { type: 'string', title: 'Spoken colour', format: PropFormat.Color, default: 'rgba(255,255,255,0.4)', group: 'Style' }
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
    const RAW = [[0, 3], [4, 7], [8, 8], [9, 12], [13, 15], [16, 16], [17, 19], [20, 22], [23, 24], [25, 27]];
    const raw = words.length === DEFAULT_WORDS ? RAW : chunks(4);
    const groups = raw.map(([ws, we], gi) => {
      const next = gi + 1 < raw.length ? words[raw[gi + 1][0]].start : Infinity;
      return { ws, we, start: words[ws].start, end: Math.min(words[we].end + 0.5, next - 0.05) };
    });

    groups.forEach((g, gi) => {
      const list = words.slice(g.ws, g.we + 1);
      const size = fit(list.map((w) => w.text.toUpperCase()).join(' '), 88, '800', 'Poppins', 1720);
      const els = list.map((w) => S.h('span', { style: { fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: size, display: 'inline-block', letterSpacing: '0.04em', lineHeight: 1 } }, w.text.toUpperCase()) as HTMLElement);
      const grp = S.h('div', { style: { position: 'absolute', bottom: 120, left: 0, width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', gap: 24, padding: '0 100px' } }, ...els) as HTMLElement;
      box.appendChild(grp);

      tl.set(grp, { visibility: 'hidden' }, 0);
      tl.set(els, { clipPath: 'inset(0 100% 0 0)', color: String(p.color) }, 0);
      tl.set(grp, { visibility: 'visible' }, g.start);
      list.forEach((w, i) => {
        const el = els[i];
        tl.to(el, { clipPath: 'inset(0 0% 0 0)', duration: 0.3, ease: 'power2.out' }, w.start);
        if (isKey(g.ws + i)) {
          tl.to(el, { color: String(p.key), duration: 0.05 }, w.start + 0.1);
        }
        tl.to(el, { color: String(p.dim), duration: 0.2 }, w.end);
      });
      tl.to(els, { clipPath: 'inset(0 0% 0 100%)', duration: 0.25, stagger: 0.04, ease: 'power2.in' }, g.end - 0.2);
      tl.set(grp, { visibility: 'hidden', opacity: 0 }, g.end);
    });

    return (frame) => tl.render(frame / view.fps);
  }
};

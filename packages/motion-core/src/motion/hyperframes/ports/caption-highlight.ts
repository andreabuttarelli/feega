import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'caption-highlight',
  title: 'Caption, highlight box',
  about: 'A red highlight box wipes in behind each word as it is spoken, then fades out while the line stays.',
  category: HfCategory.Caption,
  origin: HfOrigin.Component,
  source: 'caption-highlight',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 240,
  background: '#0b0d12',
  fonts: ['Montserrat'],
  props: {
    text: { type: 'string', title: 'Caption', default: 'Every great video starts with a single frame. Feega lets you write HTML and render professional video. No timeline. No drag and drop. Just code that becomes cinema.', group: 'Content', maxLength: 600 },
    emphasis: { type: 'string', title: 'Emphasised words', default: 'Feega,HTML,professional,code,cinema', group: 'Content', maxLength: 200 },
    color: { type: 'string', title: 'Text', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    accent: { type: 'string', title: 'Highlight', format: PropFormat.Color, default: '#ff1745', group: 'Style' }
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
    const raw = words.length === DEFAULT_WORDS ? [[0, 3], [4, 7], [8, 8], [9, 12], [13, 15], [16, 16], [17, 19], [20, 22], [23, 24], [25, 27]] : chunks(4);
    const groups = raw.map(([ws, we], gi) => {
      const next = gi + 1 < raw.length ? words[raw[gi + 1][0]].start : Infinity;
      return { ws, we, start: words[ws].start, end: Math.min(words[we].end + 0.5, next - 0.05) };
    });

    groups.forEach((g) => {
      const list = words.slice(g.ws, g.we + 1);
      const size = fit(list.map((w) => w.text.toUpperCase()).join(' '), 80, '800', 'Montserrat', 1620);
      const bgs = list.map(() => S.h('span', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, ' + String(p.accent) + ' 0%, #df1238 100%)', borderRadius: 10, boxShadow: '0 12px 30px rgba(229, 20, 58, 0.32)', zIndex: -1 } }) as HTMLElement);
      const els = list.map((w, i) => S.h('span', { style: { fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: size, color: String(p.color), display: 'inline-block', letterSpacing: '0.02em', lineHeight: 1, position: 'relative', isolation: 'isolate', padding: '6px 12px 8px', textShadow: '0 6px 18px rgba(0, 0, 0, 0.45)', transformOrigin: '50% 58%' } }, bgs[i], S.h('span', { style: { position: 'relative', zIndex: 1 } }, w.text.toUpperCase())) as HTMLElement);
      const grp = S.h('div', { style: { position: 'absolute', bottom: 140, left: 0, width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', gap: 8, padding: '0 100px' } }, ...els) as HTMLElement;
      box.appendChild(grp);

      tl.set(grp, { visibility: 'hidden', opacity: 0 }, 0);
      tl.set(els, { filter: 'brightness(1)' }, 0);
      tl.set(grp, { visibility: 'visible' }, g.start);
      tl.fromTo(grp, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'power2.out' }, g.start);
      tl.set(bgs, { scaleX: 0, opacity: 0, transformOrigin: '0% 50%' }, 0);
      list.forEach((w, i) => {
        tl.to(bgs[i], { opacity: 1, scaleX: 1, duration: 0.15, ease: 'power2.out' }, w.start);
        tl.to(els[i], { filter: 'brightness(1.05)', duration: 0.08, ease: 'power2.out' }, w.start);
        tl.to(els[i], { filter: 'brightness(1)', duration: 0.16, ease: 'power2.out' }, w.start + 0.08);
        tl.to(bgs[i], { opacity: 0, scaleX: 1.02, duration: 0.1, ease: 'power2.in' }, w.end);
        tl.set(bgs[i], { scaleX: 0 }, w.end + 0.1);
      });
      tl.to(grp, { opacity: 0, duration: 0.1, ease: 'power2.in' }, g.end - 0.1);
      tl.set(grp, { opacity: 0, visibility: 'hidden' }, g.end);
    });

    return (frame) => tl.render(frame / view.fps);
  }
};

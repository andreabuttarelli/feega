import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'caption-glitch-rgb',
  title: 'Caption, RGB glitch',
  about: 'Uppercase words jolt sideways with red and cyan colour splits and scanlines, long words shake again.',
  category: HfCategory.Caption,
  origin: HfOrigin.Component,
  source: 'caption-glitch-rgb',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 240,
  background: '#0b0d12',
  fonts: ['Space Grotesk'],
  props: {
    text: { type: 'string', title: 'Caption', default: 'Every great video starts with a single frame. Feega lets you write HTML and render professional video. No timeline. No drag and drop. Just code that becomes cinema.', group: 'Content', maxLength: 600 },
    emphasis: { type: 'string', title: 'Emphasised words', default: 'Feega,HTML,professional,code,cinema', group: 'Content', maxLength: 200 },
    color: { type: 'string', title: 'Text', format: PropFormat.Color, default: '#ffffff', group: 'Style' }
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
    const shades = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.16) 54%, rgba(0, 0, 0, 0.5) 100%)' } });
    const scan = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 3px, rgba(0, 0, 0, 0.16) 3px, rgba(0, 0, 0, 0.16) 4px)', opacity: 0.55 } });
    const lines = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } }) as HTMLElement;
    box.append(shades, lines, scan);

    const REST = '0px 0 #ff003c, 0px 0 #00e5ff, 0 5px 18px rgba(0, 0, 0, 0.52)';
    const split = (v) => v + 'px 0 #ff003c, -' + v + 'px 0 #00e5ff, 0 5px 18px rgba(0, 0, 0, 0.52)';
    const raw = [];
    let from = 0;
    let chars = 0;
    words.forEach((w, i) => {
      chars += w.text.length + 1;
      const gap = i + 1 < words.length ? words[i + 1].start - w.end : 0;
      if (/[.!?]$/.test(w.text) || gap > 0.28 || i - from >= 3 || chars >= 21 || i === words.length - 1) {
        raw.push([from, i]);
        from = i + 1;
        chars = 0;
      }
    });
    const groups = raw.map(([ws, we], gi) => {
      const next = gi + 1 < raw.length ? words[raw[gi + 1][0]].start : Infinity;
      return { ws, we, start: words[ws].start, end: Math.min(words[we].end + 0.24, next - 0.04) };
    });

    groups.forEach((g, gi) => {
      const list = words.slice(g.ws, g.we + 1);
      const size = fit(list.map((w) => w.text.toUpperCase()).join(' '), 88, '700', 'Space Grotesk', 1720);
      const els = list.map((w) => S.h('span', { style: { fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: size, display: 'inline-block', letterSpacing: '0.03em', lineHeight: 0.96 } }, w.text.toUpperCase()) as HTMLElement);
      const grp = S.h('div', { style: { position: 'absolute', bottom: 120, left: 0, width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', gap: 14, padding: '0 100px' } }, ...els) as HTMLElement;
      lines.appendChild(grp);

      tl.set(grp, { visibility: 'hidden', opacity: 0 }, 0);
      tl.set(els, { x: 0, textShadow: REST, color: String(p.color) }, 0);
      tl.set(grp, { visibility: 'visible' }, g.start);
      tl.fromTo(grp, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'power2.out' }, g.start);
      list.forEach((w, i) => {
        const wi = g.ws + i;
        const el = els[i];
        const next = words[wi + 1];
        const room = Math.min(w.end, next ? next.start : w.end + 0.3) - w.start - 0.02;
        const total = Math.min(0.24, Math.max(0.08, room));
        const d1 = total * 0.35;
        const d2 = total * 0.65;
        let draw = 0;
        const rng = () => S.random((wi * 777 + 13) * 100 + draw++);
        const travel = -(8 + rng() * 8);
        const mag = (5 + rng() * 7).toFixed(1);
        const stop = Math.min(g.end - 0.08, (next ? next.start : g.end) - 0.04);
        tl.to(el, { x: travel, textShadow: split(mag), duration: d1, ease: 'none' }, w.start);
        tl.to(el, { x: 0, textShadow: REST, duration: d2, ease: 'power3.out' }, w.start + d1);

        const loud = /\d|\$|%/.test(w.text) || w.text.replace(/[^\w]/g, '').length >= 7;
        if (!loud || stop - w.end <= 0.22) {
          return;
        }
        let at = w.end + 0.08;
        let n = 0;
        while (at + 0.1 < stop) {
          const shift = -(3 + rng() * 5);
          const amount = (3 + rng() * 5).toFixed(1);
          tl.to(el, { x: shift, textShadow: split(amount), duration: 0.045, ease: 'none' }, at);
          tl.to(el, { x: 0, textShadow: REST, duration: 0.075, ease: 'power3.out' }, at + 0.045);
          n += 1;
          at += n % 2 === 0 ? 0.18 : 0.24;
        }
      });
      tl.to(grp, { opacity: 0, duration: 0.1, ease: 'power2.in' }, g.end - 0.1);
      tl.set(grp, { opacity: 0, visibility: 'hidden' }, g.end);
    });

    return (frame) => tl.render(frame / view.fps);
  }
};

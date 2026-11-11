import { PropFormat } from '../../custom/component';
import { HfCategory, HfOrigin, type HfPort } from '../model';

export const PORT: HfPort = {
  id: 'caption-editorial-emphasis',
  title: 'Caption, editorial emphasis',
  about: 'Plain words pop in on the lower left, and key words land as huge italic serif on their own line.',
  category: HfCategory.Caption,
  origin: HfOrigin.Component,
  source: 'caption-editorial-emphasis',
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 240,
  background: '#0b0d12',
  fonts: ['Inter', 'Playfair Display'],
  props: {
    text: { type: 'string', title: 'Caption', default: 'Every great video starts with a single frame. Feega lets you write HTML and render professional video. No timeline. No drag and drop. Just code that becomes cinema.', group: 'Content', maxLength: 600 },
    emphasis: { type: 'string', title: 'Emphasised words', default: 'Feega,HTML,professional,code,cinema', group: 'Content', maxLength: 200 },
    color: { type: 'string', title: 'Text', format: PropFormat.Color, default: '#f5f0d0', group: 'Style' }
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
    const SAFE = 1800;
    const layout = [
      [[0, 'n'], [1, 'n'], [2, 'n']], [[3, 'n'], [4, 'n']],
      [[5, 'n'], [6, 'n']], [[7, 'n']],
      [[8, 'n']], [],
      [[9, 'n'], [10, 'n'], [11, 'n']], [[12, 'n']],
      [[13, 'n'], [14, 'n']], [[15, 'n']],
      [[16, 'n'], [17, 'n']], [],
      [[18, 'n']], [[19, 'n'], [20, 'n']],
      [[21, 'n'], [22, 'n']], [],
      [[23, 'i'], [24, 'n']], [],
      [[25, 'n'], [26, 'n']], [[27, 'n']]
    ];
    const pairs = words.length === DEFAULT_WORDS ? layout : chunks(4).flatMap(([a, b]) => [Array.from({ length: Math.min(2, b - a + 1) }, (_, k) => [a + k, 'n']), Array.from({ length: Math.max(0, b - a - 1) }, (_, k) => [a + 2 + k, 'n'])]);
    const blocks = [];
    for (let i = 0; i < pairs.length; i += 2) {
      blocks.push({ line1: pairs[i], line2: pairs[i + 1].length ? pairs[i + 1] : null });
    }

    const kind = (pair) => (isKey(pair[0]) ? 'e' : pair[1]);
    const STYLE = {
      n: { fontFamily: 'Inter, sans-serif', fontSize: 86, fontWeight: 400, fontStyle: 'normal' },
      i: { fontFamily: 'Inter, sans-serif', fontSize: 86, fontWeight: 400, fontStyle: 'italic' },
      e: { fontFamily: 'Playfair Display, serif', fontSize: 180, fontWeight: 800, fontStyle: 'italic', lineHeight: 0.9 }
    };
    const FAMILY = { n: 'Inter', i: 'Inter', e: 'Playfair Display' };
    const mkLine = (pairsOfLine) => {
      const hasKey = pairsOfLine.some((q) => kind(q) === 'e');
      const k = hasKey ? 'e' : 'n';
      const size = fit(pairsOfLine.map((q) => words[q[0]].text).join(' '), hasKey ? 180 : 86, hasKey ? '800' : '400', FAMILY[k], SAFE);
      const spans = pairsOfLine.map((q) => S.h('span', { style: { ...STYLE[kind(q)], fontSize: size, display: 'inline-block', color: String(p.color), textShadow: '0 2px 12px rgba(0, 0, 0, 0.6), 0 4px 24px rgba(0, 0, 0, 0.35)' } }, words[q[0]].text) as HTMLElement);
      const el = S.h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 14, lineHeight: 1.1, whiteSpace: 'nowrap' } }, ...spans) as HTMLElement;
      return { el, spans };
    };

    const stage = S.h('div', { style: { position: 'absolute', top: 580, left: 60, width: SAFE, height: 430 } }) as HTMLElement;
    box.appendChild(stage);

    const built = blocks.map((b) => {
      const l1 = mkLine(b.line1);
      const l2 = b.line2 ? mkLine(b.line2) : null;
      const el = S.h('div', { style: { position: 'absolute', left: 0, top: 0, transformOrigin: '0% 0%' } }, l1.el, ...(l2 ? [l2.el] : [])) as HTMLElement;
      if (l2) {
        l2.el.style.marginTop = '8px';
      }
      stage.appendChild(el);
      return { b, el, l1, l2 };
    });

    built.forEach(({ el }) => {
      const widest = Math.max(...[...el.children].map((line) => (line as HTMLElement).scrollWidth));
      if (widest > SAFE) {
        el.style.transform = 'scale(' + SAFE / widest + ')';
      }
    });

    const popIn = (spans, pairsOfLine, start) => {
      spans.forEach((span, i) => {
        tl.set(span, { opacity: 0, scale: 1.12, transformOrigin: '0% 100%' }, 0);
        tl.set(span, { opacity: 0, scale: 1.12, transformOrigin: '0% 100%' }, start);
        tl.to(span, { opacity: 1, scale: 1, duration: 0.1, ease: 'power2.out' }, words[pairsOfLine[i][0]].start);
      });
    };

    built.forEach(({ el, l2 }) => {
      tl.set(el, { opacity: 0 }, 0);
      if (l2) {
        tl.set(l2.el, { opacity: 1, x: 0 }, 0);
      }
    });

    built.forEach(({ b, el, l1, l2 }, bi) => {
      const start = words[b.line1[0][0]].start;
      const next = bi < built.length - 1 ? words[built[bi + 1].b.line1[0][0]].start : 8;
      built.forEach((other, oi) => {
        if (oi !== bi) {
          tl.set(other.el, { opacity: 0 }, start);
        }
      });
      tl.set(el, { opacity: 1 }, start);
      popIn(l1.spans, b.line1, start);
      if (l2 && b.line2.some((q) => kind(q) === 'e')) {
        tl.set(l2.el, { opacity: 0, x: -1920 }, start);
        tl.to(l2.el, { opacity: 1, x: 0, duration: 0.2, ease: 'power2.out' }, words[b.line2[0][0]].start);
      } else if (l2) {
        tl.set(l2.el, { opacity: 1 }, start);
        popIn(l2.spans, b.line2, start);
      }
      tl.set(el, { opacity: 0 }, next);
    });

    return (frame) => tl.render(frame / view.fps);
  }
};

import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'drop-line',
  title: 'Drop line',
  about: 'Words cut in place; on the last card the word sinks out from under its own dot, which stays hanging.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#141414',
  fonts: ['Inter'],
  props: {
    words: { type: 'string', title: 'Words (space separated)', default: 'then ships the film', group: 'Content', maxLength: 200 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 700, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontSize: { type: 'number', title: 'Font size (1920 stage px)', default: 130, minimum: 20, maximum: 400, step: 1, group: 'Style' },
    ink: { type: 'string', title: 'Card colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    paper: { type: 'string', title: 'Type colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const STAGE_W = 1920;
    const STAGE_H = 1080;
    const FONT_SIZE = 130;
    const BASELINE = 574.5;
    const HOLDS = { first: 9, word: 7, last: 15 };
    const RISE = [70, 43, 22.8, 13, 7.2, 3.7, 1.55, 0.45, 0];
    const DROP = [0, 0, 0, 0, 0.38, 1.25, 2.54, 4.4, 6.91, 10.27, 14.57, 20.23, 27.57, 37.53, 51.55];
    const DOT_LINE = 0.585;
    const MAX_WIDTH = STAGE_W * 0.9;
    const DOTTED = /[ij]/;
    const TRACKING = -0.015;

    const words = String(p.words).split(/\s+/).filter(Boolean);
    const fontFamily = S.pick(p.fontFamily, 'Inter');
    const fontWeight = Number(p.fontWeight);
    const fontSize = Number(p.fontSize);
    const speed = Number(p.speed);
    const card = S.pick(p.ink, String(t.foreground));
    const type = S.pick(p.paper, String(t.background));
    const px = Math.max(view.width / STAGE_W, view.height / STAGE_H);

    const sample = (table: number[], at: number) => {
      const x = Math.max(0, Math.min(at, table.length - 1));
      const i = Math.floor(x);
      const a = table[i] ?? 0;
      return a + ((table[i + 1] ?? a) - a) * (x - i);
    };
    const starts = words.map((_, i) => (i === 0 ? 0 : HOLDS.first + (i - 1) * HOLDS.word));
    const end = HOLDS.first + Math.max(0, words.length - 2) * HOLDS.word + HOLDS.last;
    const dropAt = end - DROP.length;
    const cardAt = (f: number) => starts.reduce((at, s, i) => (f >= s ? i : at), 0);
    const ctx = document.createElement('canvas').getContext('2d');

    const svg = S.h('svg', { viewBox: `0 0 ${STAGE_W} ${STAGE_H}`, width: '100%', height: '100%', preserveAspectRatio: 'xMidYMid slice', style: { position: 'absolute', top: 0, left: 0 } });
    view.root.replaceChildren(S.fill({ background: card, overflow: 'hidden', fontOpticalSizing: 'none' }, svg));

    const line = (y: number, base: number, content: () => Element[]) => {
      const row = Math.floor(y * px);
      const f = y * px - row;
      return S.h('g', { style: { isolation: 'isolate' } }, [{ r: row, w: 1 - f }, { r: row + 1, w: f }].map(({ r, w }) => S.h('g', { transform: `translate(0 ${(r + 1e-3) / px - base})`, style: { opacity: w, mixBlendMode: 'plus-lighter' } }, content())));
    };

    return (at) => {
      const f = at * speed;
      const index = cardAt(f);
      const word = words[index] ?? '';
      const isLast = index === words.length - 1;
      const chars = Array.from(word);
      if (ctx) {
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      }
      const measured = (ctx ? ctx.measureText(word).width : chars.length * fontSize * 0.6) + (chars.length - 1) * TRACKING * fontSize;
      const fit = Math.min(1, MAX_WIDTH / Math.max(1, measured));
      const size = fontSize * fit;
      const rest = STAGE_H / 2 + (BASELINE - STAGE_H / 2) * (fontSize / FONT_SIZE);
      const fall = isLast ? sample(DROP, f - dropAt) : 0;
      const y = rest + (index === 0 ? sample(RISE, f) : 0);
      const dots = isLast && DOTTED.test(word);
      const xHeight = ctx?.measureText('x').actualBoundingBoxAscent;
      const dotTop = ctx?.measureText('i').actualBoundingBoxAscent;
      const dotLine = xHeight && dotTop ? rest - (xHeight + (dotTop - xHeight) * 0.15) * fit : rest - DOT_LINE * size;
      const uid = 'dl';

      const letters = (show: (ch: string) => boolean) => S.h('text', { x: STAGE_W / 2, y: rest, textAnchor: 'middle', fill: type, style: { fontFamily, fontWeight, fontSize: size, letterSpacing: `${TRACKING}em`, textRendering: 'geometricPrecision' } }, chars.map((ch) => S.h('tspan', { dx: '0em', fillOpacity: show(ch) ? 1 : 0 }, ch)));
      const defs = S.h('defs', null, S.h('clipPath', { id: `${uid}a` }, S.h('rect', { width: STAGE_W, height: dotLine })), S.h('clipPath', { id: `${uid}b` }, S.h('rect', { y: dotLine, width: STAGE_W, height: STAGE_H * 2 })));
      const moving = line(y + fall, rest, () => (dots ? [letters((ch) => !DOTTED.test(ch)), S.h('g', { clipPath: `url(#${uid}b)` }, letters((ch) => DOTTED.test(ch)))] : [letters(() => true)]));
      const hanging = dots ? line(y, rest, () => [S.h('g', { clipPath: `url(#${uid}a)` }, letters((ch) => DOTTED.test(ch)))]) : null;
      svg.replaceChildren(defs, moving, ...(hanging ? [hanging] : []));
    };
  }
};

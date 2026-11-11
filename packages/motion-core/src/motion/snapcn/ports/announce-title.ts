import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

const MARK_PATH = 'M50.2 74.6 52.5 74.4 54.9 74.1 56.8 73.7 58.3 73.2 59.8 72.5 61.6 71.6 63.1 70.6 64.2 69.7 64.3 69.7 64.5 69.5 64.6 69.5 66.4 67.7 66.4 67.6 66.9 67.2 66.9 67.1 67.7 66.3 68.9 64.4 69.7 63.0 69.8 63.0 70.6 61.3 71.5 59.0 72.0 56.9 72.1 55.5 71.9 55.3 65.4 55.4 65.3 55.6 65.1 56.7 64.7 58.2 63.6 60.6 62.1 62.8 60.1 64.7 60.0 64.7 59.2 65.4 57.6 66.4 55.1 67.4 52.6 68.0 49.8 68.1 46.7 67.8 44.2 67.2 41.9 66.1 39.9 64.8 37.9 62.8 37.9 62.7 37.2 61.8 36.2 60.2 35.5 58.6 35.0 57.3 34.6 55.4 28.1 55.3 27.9 55.5 27.9 56.1 28.2 57.7 28.9 60.1 29.6 61.8 30.6 63.6 31.8 65.6 32.8 66.7 32.8 66.8 33.1 67.1 33.1 67.2 34.9 69.0 35.0 69.0 35.7 69.7 35.8 69.7 36.9 70.6 38.9 71.9 40.7 72.8 42.8 73.5 44.6 74.0 46.5 74.3Z M99.8 52.3 100.0 52.1 100.0 50.1 99.8 50.0 92.2 50.0 87.3 49.7 84.6 49.4 83.2 49.0 81.6 48.5 79.6 47.6 77.8 46.4 76.2 44.8 74.3 42.1 74.2 41.9 73.9 41.5 73.9 41.3 72.1 38.6 71.9 38.5 71.7 38.0 70.7 36.7 70.0 35.9 70.0 35.8 68.5 34.2 68.5 34.1 66.6 32.3 66.5 32.3 66.1 31.8 66.0 31.8 64.8 30.7 63.6 29.9 63.5 29.7 61.5 28.5 60.1 27.7 58.2 27.0 55.0 26.0 51.8 25.6 48.2 25.6 45.6 25.9 43.5 26.4 41.8 27.0 39.9 27.7 38.2 28.7 36.1 30.0 34.7 31.1 34.6 31.1 34.4 31.4 34.3 31.4 33.5 32.3 33.4 32.3 30.6 35.2 30.6 35.3 29.3 36.7 28.3 38.0 28.1 38.5 27.9 38.6 26.1 41.3 26.1 41.5 25.8 41.9 25.7 42.1 25.3 42.7 25.2 42.9 24.2 44.3 22.7 46.0 22.6 46.0 22.2 46.4 21.6 46.9 20.5 47.6 18.4 48.5 15.9 49.2 14.1 49.6 11.6 49.9 7.8 50.0 0.2 50.0 0.0 50.1 0.0 52.1 0.2 52.3Z M62.2 49.5 37.8 49.5 36.9 49.3 35.8 48.8 34.8 47.9 34.4 47.2 34.2 46.6 34.2 44.8 34.7 42.8 35.6 40.9 36.4 39.8 36.7 39.6 36.7 39.5 38.5 37.7 40.1 36.7 40.6 36.4 41.0 36.1 42.8 35.2 45.3 34.4 47.2 33.9 48.5 33.8 50.8 33.7 52.8 33.9 55.3 34.6 57.7 35.4 59.9 36.7 62.1 38.3 63.8 40.1 64.4 40.9 65.1 42.2 65.7 44.2 65.8 44.8 65.8 46.3 65.6 47.2 65.3 47.7 65.0 48.1 64.2 48.8 63.1 49.3Z';

export const PORT: SnapcnPort = {
  id: 'announce-title',
  title: 'Announce title',
  about: 'A launch title in four shots: a receding eyebrow, a whip exit, the product name, and a macro tagline with a glowing mark.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 170,
  background: '#100022',
  fonts: ['Google Sans'],
  props: {
    eyebrow: { type: 'string', title: 'Eyebrow', default: 'Introducing', group: 'Content', maxLength: 60 },
    title: { type: 'string', title: 'Title', default: 'feega 1.0', group: 'Content', maxLength: 80 },
    tagline: { type: 'string', title: 'Tagline', default: 'Motion videos from one prompt, on one canvas.', group: 'Content', maxLength: 160 },
    voidColor: { type: 'string', title: 'Opening backdrop', format: PropFormat.Color, default: '#100022', group: 'Style' },
    fieldColor: { type: 'string', title: 'Eyebrow backdrop', format: PropFormat.Color, default: '#5600f5', group: 'Style' },
    paperColor: { type: 'string', title: 'Title backdrop', format: PropFormat.Color, default: '#fcfcfa', group: 'Style' },
    titleColor: { type: 'string', title: 'Title colour', format: PropFormat.Color, default: '#4800c9', group: 'Style' },
    nightColor: { type: 'string', title: 'Tagline backdrop', format: PropFormat.Color, default: '#000028', group: 'Style' },
    glowColor: { type: 'string', title: 'Glow colour', format: PropFormat.Color, default: '#08ff4b', group: 'Style' },
    glowStrength: { type: 'number', title: 'Glow strength', default: 0.139, minimum: 0, maximum: 1, step: 0.001, group: 'Style' },
    taglineColor: { type: 'string', title: 'Tagline colour', format: PropFormat.Color, default: '#f2f8ff', group: 'Style' },
    inkColor: { type: 'string', title: 'Ink colour', format: PropFormat.Color, default: '#ffffff', group: 'Style' },
    symbolPath: { type: 'string', title: 'Symbol SVG path (100x100)', default: MARK_PATH, group: 'Content', maxLength: 2000 },
    symbolColors: { type: 'string', title: 'Symbol colours (comma separated)', default: '', group: 'Style', maxLength: 400 },
    symbolScale: { type: 'number', title: 'Symbol scale', default: 1, minimum: 0.1, maximum: 4, step: 0.05, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Google Sans', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const width = view.width;
    const height = view.height;
    const face = S.pick(p.fontFamily, 'Google Sans');
    const PLANE_OUT = 18;
    const FIELD_OUT = 41;
    const PAPER_OUT = 80;
    const MACRO_OUT = 110;
    const REF_W = 802;
    const REF_H = 450;
    const EYEBROW_SIZE = 41.6 / REF_W;
    const EYEBROW_TRACK = -0.0666;
    const TITLE_SIZE = 41.3 / REF_W;
    const TITLE_TRACK = -0.0563;
    const TAGLINE_SIZE = 35 / REF_W;
    const TAGLINE_TRACK = -0.015;
    const BASELINE_DROP = 0.335;
    const EYEBROW_BASELINE = 236.87 / REF_H;
    const TITLE_BASELINE = 240.4 / REF_H;
    const TAGLINE_BASELINE = 233.5 / REF_H;
    const SPARK_RAMP: [number, string][] = [[0, '#0365f3'], [0.17, '#1c5cf1'], [0.31, '#3a54ec'], [0.41, '#554ce5'], [0.52, '#7041cb'], [0.62, '#9b3894'], [0.72, '#ca3068'], [0.83, '#e2284c'], [0.93, '#e71d32'], [1, '#e91927']];
    const BLOOM_PASSES = [0.0825, 0.0315, 0.009, 0.009];
    const PLANE_MAG: [number, number][] = [[2, 52.6], [3, 43.7], [4, 36.3], [5, 30.2], [6, 25.1], [7, 19.8], [8, 16.1], [9, 13.6], [10, 11.75], [11, 10.4], [12, 9.3], [13, 8.45], [14, 7.5], [15, 6.35], [16, 5.2], [17, 4.0]];
    const PLANE_BASE = 6;
    const PLANE_PERSPECTIVE = 0.36;
    const PLANE_RAKE: [number, number][] = [[5, 81], [7, 68], [9, 55], [11, 41], [13, 31], [15, 20], [17, 14]];
    const EYEBROW_ENTER = 0.53;
    const EYEBROW_DECAY = 0.7605;
    const EYEBROW_SPAN = 18;
    const PIVOT_LIFT = 23.87 / 41.6;
    const EXIT_FROM = 35;
    const EXIT_BASE = 3.2;
    const EXIT_STEP = 2.1 / REF_W;
    const EXIT_LETTER_DELAY = 0.215;
    const TITLE_DECAY = 0.82;
    const TITLE_SPAN = 30;
    const TITLE_ALPHA_DECAY = 0.79;
    const TITLE_ENTRY = [[41, 143, 0.39], [48, 87, 0.46], [54, 88, 0.29]];
    const MACRO_SIZE = 487 / REF_W;
    const MACRO_BASELINE = 347 / REF_H;
    const MACRO_HOLD = 90;
    const MACRO_ANCHOR = 0.505;
    const MACRO_STAR_AT_HOLD = 565 / REF_W;
    const MACRO_STAR_SIZE = 1.255;
    const MACRO_STAR_SPIN = 2.9;
    const MACRO_STAR_Y = 60 / REF_H;
    const MACRO_STAR_SPREAD = 0.55;
    const TAGLINE_TRAVEL = 417 / REF_W;
    const TAGLINE_DECAY = 0.792;
    const TAGLINE_SPAN = 30;
    const TAGLINE_FIRST = 111.5;
    const TAGLINE_STAGGER = 2.833;
    const TAGLINE_INK = 693;
    const WIPE_START = 124.6;
    const WIPE_SPEED = 31.7 / TAGLINE_INK;
    const WIPE_EDGE = 165 / TAGLINE_INK;
    const TINT_RAMP: [number, string][] = [[0, '#8a2447'], [0.24, '#842647'], [0.33, '#722e57'], [0.5, '#58406d'], [0.66, '#434e90'], [0.76, '#3654ab'], [0.85, '#2f5ed1'], [1, '#3266e5']];
    const STAR_REST_X = 781.4 / REF_W;
    const STAR_REST_Y = 227 / REF_H;
    const STAR_SIZE = 60 / REF_W;
    const STAR_TURN = 30;
    const STAR_EXIT = 134;
    const STAR_GONE = 139;

    type St = Record<string, string | number>;
    const settle = (t: number, span: number, decay: number) => (t <= 0 ? 0 : t >= span ? 1 : (1 - decay ** t) / (1 - decay ** span));
    const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const sample = (table: [number, number][], x: number) => {
      if (x <= table[0][0]) {
        return table[0][1];
      }
      const last = table[table.length - 1];
      if (x >= last[0]) {
        return last[1];
      }
      for (let i = 1; i < table.length; i++) {
        const [x1, y1] = table[i];
        if (x <= x1) {
          const [x0, y0] = table[i - 1];
          return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
        }
      }
      return last[1];
    };
    const hexToRgb = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const fill = (style: St, ...kids: (Element | null)[]) => S.fill(style, ...kids);
    const lineStyle = (fontSize: number, tracking: number): St => ({ fontFamily: face, fontSize, fontWeight: 400, lineHeight: 1, letterSpacing: `${tracking}em`, marginRight: `${-tracking}em`, whiteSpace: 'pre', textRendering: 'geometricPrecision' });
    const stage = (offset: number, child: Element, align = 'center') => fill({ alignItems: align, justifyContent: 'center' }, S.h('div', { style: { transform: `translateY(${offset}px)` } }, child));
    const line = (kids: Element[] | string, fontSize: number, tracking: number, baseline: number, style: St) => stage((baseline - 0.5) * height - BASELINE_DROP * fontSize, S.h('div', { style: { ...lineStyle(fontSize, tracking), ...style } }, kids));

    const eyebrow = String(p.eyebrow);
    const title = String(p.title);
    const tagline = String(p.tagline);
    const titleWords = title.split(/\s+/).filter(Boolean);
    const taglineWords = tagline.split(/\s+/).filter(Boolean);
    const colorList = String(p.symbolColors).split(',').map((c) => c.trim()).filter(Boolean);
    const stops: [number, string][] = colorList.length === 0 ? SPARK_RAMP : colorList.length === 1 ? [[0, colorList[0]], [1, colorList[0]]] : colorList.map((c, i) => [i / (colorList.length - 1), c]);
    const symbolPath = String(p.symbolPath);
    const symbolScale = Number(p.symbolScale);
    const ink = String(p.inkColor);
    const speed = Number(p.speed);

    const fits = [
      { text: eyebrow, fontSize: EYEBROW_SIZE * width, tracking: EYEBROW_TRACK, maxWidth: 0.55 * width },
      { text: title, fontSize: TITLE_SIZE * width, tracking: TITLE_TRACK, maxWidth: 0.8 * width },
      { text: tagline, fontSize: TAGLINE_SIZE * width, tracking: TAGLINE_TRACK, maxWidth: 0.88 * width }
    ];
    const probeEls = fits.map((l) => S.h('span', { style: lineStyle(l.fontSize, l.tracking) }, l.text) as HTMLElement);
    const probes = S.h('div', { style: { position: 'absolute', top: 0, left: 0, visibility: 'hidden', pointerEvents: 'none' } }, probeEls);
    const shotHost = S.h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } });
    view.root.replaceChildren(fill({}, probes, shotHost));

    const mark = (size: number, rotation: number, id: string, spread = 1) => {
      if (!symbolPath) {
        return null;
      }
      const edge = 0.5 + spread / 2;
      const blur = (f: number) => (f * width * 100) / size;
      const grad = S.h('linearGradient', { id, x1: '0.5', y1: edge, x2: '0.5', y2: 1 - edge }, stops.map(([at, color]) => S.h('stop', { offset: `${at * 100}%`, stopColor: color })));
      const filters = [...new Set(BLOOM_PASSES)].map((r) => S.h('filter', { id: `${id}-${r}`, x: '-300%', y: '-300%', width: '700%', height: '700%' }, S.h('feGaussianBlur', { stdDeviation: blur(r) })));
      const blooms = BLOOM_PASSES.map((r) => S.h('path', { d: symbolPath, fill: `url(#${id})`, filter: `url(#${id}-${r})`, style: { mixBlendMode: 'screen' } }));
      return S.h('svg', { viewBox: '0 0 100 100', width: size, height: size, style: { display: 'block', overflow: 'visible', transform: `rotate(${rotation}deg)` } }, S.h('defs', null, grad, filters), blooms, S.h('path', { d: symbolPath, fill: `url(#${id})` }));
    };

    const shutter = (frame: number, samples: number, open: number, layer: (f: number) => Element) => {
      const n = Math.max(2, Math.round(samples));
      return Array.from({ length: n }, (_, i) => fill({ opacity: 1 / (i + 1) }, layer(frame - open + (open * i) / (n - 1))));
    };

    const receding = (f: number, fontSize: number) => {
      const mag = sample(PLANE_MAG, f);
      const rake = sample(PLANE_RAKE, f);
      const text = S.h('div', { style: { ...lineStyle(fontSize * PLANE_BASE, EYEBROW_TRACK), color: ink, transform: `rotateX(${rake}deg)` } }, eyebrow);
      return stage((EYEBROW_BASELINE - 0.5) * height - BASELINE_DROP * fontSize, S.h('div', { style: { transform: `scale(${mag / PLANE_BASE})` } }, S.h('div', { style: { perspective: PLANE_PERSPECTIVE * width, transformStyle: 'preserve-3d' } }, text)));
    };

    const eyebrowExit = (frame: number, letter: number) => {
      const t = frame - EXIT_FROM - letter * EXIT_LETTER_DELAY;
      return t < 0 ? 0 : -EXIT_STEP * width * EXIT_BASE ** t;
    };

    const eyebrowLine = (f: number, fontSize: number) => {
      const scale = 1 + EYEBROW_ENTER * (1 - settle(f - PLANE_OUT, EYEBROW_SPAN, EYEBROW_DECAY));
      const letters = [...eyebrow].map((ch, i) => S.h('span', { style: { transform: `translateX(${eyebrowExit(f, i)}px)` } }, ch));
      return line(letters, fontSize, EYEBROW_TRACK, EYEBROW_BASELINE, { color: ink, display: 'flex', transformOrigin: '50% 100%', transform: `translateY(${PIVOT_LIFT * fontSize * (scale - 1)}px) scale(${scale})` });
    };

    const titleLine = (frame: number, fontSize: number) => {
      const spans = titleWords.map((word, i) => {
        const extra = Math.max(0, i - (TITLE_ENTRY.length - 1));
        const [at, travel, pop] = TITLE_ENTRY[i - extra];
        const t = frame - at - extra * 6;
        if (t < 0) {
          return null;
        }
        const x = ((travel * width) / REF_W) * (1 - settle(t, TITLE_SPAN, TITLE_DECAY));
        return S.h('span', { style: { opacity: 1 - (1 - pop) * TITLE_ALPHA_DECAY ** t, transform: `translateX(${x}px)` } }, i === 0 ? word : ` ${word}`);
      }).filter((e): e is Element => e !== null);
      return line(spans, fontSize, TITLE_TRACK, TITLE_BASELINE, { display: 'flex', color: String(p.titleColor) });
    };

    const macro = (frame: number) => {
      const t = frame - MACRO_HOLD;
      const pan = (-(78.8 * (1 - 0.81 ** t) + 6.03 * (1.255 ** t - 1)) * width) / REF_W;
      const fontSize = MACRO_SIZE * width;
      const text = stage((MACRO_BASELINE - 0.5) * height - BASELINE_DROP * fontSize, S.h('div', { style: { ...lineStyle(fontSize, TAGLINE_TRACK), color: ink, transform: `translateX(${width / 2 + pan}px) translateX(${-MACRO_ANCHOR * 100}%)` } }, tagline), 'flex-start');
      const star = fill({ alignItems: 'center', justifyContent: 'center' }, S.h('div', { style: { transform: `translate(${(MACRO_STAR_AT_HOLD - 0.5) * width - pan}px, ${MACRO_STAR_Y * height}px)` } }, mark(MACRO_STAR_SIZE * symbolScale * width, MACRO_STAR_SPIN * (frame - MACRO_HOLD) - 50, 'announce-title-macro-symbol', MACRO_STAR_SPREAD)));
      return [text, star];
    };

    const taglineFill = (front: number, rest: string) => {
      const [rr, rg, rb] = hexToRgb(rest);
      const parts: string[] = [];
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const x = i / n;
        let below = TINT_RAMP[0];
        let above = TINT_RAMP[TINT_RAMP.length - 1];
        for (let j = 1; j < TINT_RAMP.length; j++) {
          if (x <= TINT_RAMP[j][0]) {
            below = TINT_RAMP[j - 1];
            above = TINT_RAMP[j];
            break;
          }
        }
        const span = above[0] - below[0];
        const local = span > 0 ? (x - below[0]) / span : 0;
        const [r0, g0, b0] = hexToRgb(below[1]);
        const [r1, g1, b1] = hexToRgb(above[1]);
        const drained = clamp01((front - x) / WIPE_EDGE + 0.5);
        const mix = (a: number, b: number, target: number) => Math.round((a + (b - a) * local) * (1 - drained) + target * drained);
        parts.push(`rgb(${mix(r0, r1, rr)},${mix(g0, g1, rg)},${mix(b0, b1, rb)}) ${(x * 100).toFixed(1)}%`);
      }
      return `linear-gradient(90deg, ${parts.join(', ')})`;
    };

    const closing = (frame: number, fontSize: number) => {
      const settled = 1 - settle(frame - MACRO_OUT, TAGLINE_SPAN, TAGLINE_DECAY);
      const slide = -TAGLINE_TRAVEL * width * settled;
      const front = WIPE_SPEED * (frame - WIPE_START);
      const starLife = 1 - clamp01((frame - STAR_EXIT) / (STAR_GONE - STAR_EXIT));
      const spans = taglineWords.map((word, i) => S.h('span', { style: { visibility: frame >= TAGLINE_FIRST + (taglineWords.length - 1 - i) * TAGLINE_STAGGER ? 'visible' : 'hidden' } }, i === 0 ? word : ` ${word}`));
      const text = line(spans, fontSize, TAGLINE_TRACK, TAGLINE_BASELINE, { display: 'flex', transform: `translateX(${slide}px)`, backgroundImage: taglineFill(front, String(p.taglineColor)), backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' });
      if (starLife <= 0) {
        return [text];
      }
      const m = mark(STAR_SIZE * symbolScale * width, -STAR_TURN * settled, 'announce-title-symbol');
      return [text, stage((STAR_REST_Y - 0.5) * height, S.h('div', { style: { transform: `translateX(${(STAR_REST_X - 0.5) * width + slide}px) scale(${starLife})`, opacity: starLife } }, m))];
    };

    const shot = (frame: number, sizes: number[]) => {
      if (frame < PLANE_OUT) {
        return fill({ backgroundColor: String(p.voidColor) }, ...shutter(frame, 20, 1, (f) => receding(f, sizes[0])));
      }
      if (frame < FIELD_OUT) {
        const travel = Math.abs(eyebrowExit(frame, 0));
        return fill({ backgroundColor: String(p.fieldColor) }, ...shutter(frame, Math.min(44, Math.max(6, travel / 4)), travel > 0 ? 1 : 0.5, (f) => eyebrowLine(f, sizes[0])));
      }
      if (frame < PAPER_OUT) {
        return fill({ backgroundColor: String(p.paperColor) }, titleLine(frame, sizes[1]));
      }
      const [r, g, b] = hexToRgb(String(p.glowColor));
      const night = fill({ backgroundColor: String(p.nightColor), backgroundImage: `radial-gradient(circle ${((500 / REF_W) * 100).toFixed(1)}% at 50% 68%, rgba(${r},${g},${b},${Number(p.glowStrength)}), transparent)` });
      night.append(...(frame < MACRO_OUT ? macro(frame) : closing(frame, sizes[2])));
      return night;
    };

    return (at) => {
      const frame = at * speed;
      const sizes = fits.map((l, i) => {
        const w = probeEls[i].offsetWidth;
        return l.fontSize * (w && w > l.maxWidth ? l.maxWidth / w : 1);
      });
      shotHost.replaceChildren(shot(frame, sizes));
    };
  }
};

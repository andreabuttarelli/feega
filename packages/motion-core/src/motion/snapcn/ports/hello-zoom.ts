import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'hello-zoom',
  title: 'Hello zoom',
  about: 'Words flicker past, a huge lead word lands, the line types itself out, then the camera dives through a letter into the next word.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    words: { type: 'string', title: 'Flicker words (comma separated)', default: 'React, Remotion, shadcn, Next.js, Vite, Tailwind, TypeScript', group: 'Content', maxLength: 300 },
    lead: { type: 'string', title: 'Lead word', default: 'Hello', group: 'Content', maxLength: 40 },
    rest: { type: 'string', title: 'Rest of line', default: 'feega.', group: 'Content', maxLength: 60 },
    nextWord: { type: 'string', title: 'Next word', default: 'npx', group: 'Content', maxLength: 40 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 700, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    inkColor: { type: 'string', title: 'Ink colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    paperColor: { type: 'string', title: 'Paper colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const FACE = 'Hello Zoom Inter';
    const FACE_URL = 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2';
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE || f.family === `"${FACE}"`)) {
      const loaded = new FontFace(FACE, `url(${FACE_URL}) format("woff2")`, { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().catch(() => undefined);
    }
    const face = S.pick(p.fontFamily, `"${FACE}"`);
    const fontWeight = Number(p.fontWeight);
    const speed = Number(p.speed);
    const ink = S.pick(p.inkColor, String(t.foreground));
    const paper = S.pick(p.paperColor, String(t.background));
    const lead = String(p.lead);
    const rest = String(p.rest);
    const nextWord = String(p.nextWord);
    const list = String(p.words).split(',').map((w) => w.trim()).filter(Boolean);
    const line = `${lead} ${rest}`;

    const STAGE_W = 1920;
    const FLICKER_BEATS = 21;
    const LEAD_AT = 20;
    const LINE_AT = 25;
    const TYPE_FRAMES = 5;
    const NEXT_AT = 49;
    const WORD_SIZE = [75.4, 93.7, 115.9, 124.9, 150.2, 186.3, 225.1];
    const WORD_DROP = [20.4, 25.3, 30.2, 31.9, 40.5, 49.9, 60.1];
    const WORD_NUDGE = [-0.3, -1.8, -2, -0.8, -0.3, -2.1, -2.9];
    const WORD_TRACKING = -0.02;
    const LEAD_SIZE = 433.14;
    const LEAD_DROP = 156.57;
    const LEAD_TRACKING = -0.047;
    const LEAD_NUDGE = -17.7;
    const LEAD_DRIFT = [[20, 0], [21, 1.54], [22, 4.37], [23, 9.37], [24, 18]];
    const LINE_SIZE = 210.38;
    const LINE_TRACKING = -0.025;
    const LINE_START = 0.6893;
    const LINE_SLIDE = [[25, 1], [26, 0.6139], [27, 0.3242], [28, 0.183], [29, 0.1012], [30, 0.0503], [31, 0.0203], [32, 0.0047], [33, 0]];
    const ZOOM = [[36, 1], [37, 1.0036], [38, 1.0155], [39, 1.0371], [40, 1.071], [41, 1.1213], [42, 1.1947], [43, 1.3018], [44, 1.4694], [45, 1.7476], [46, 2.2753], [47, 3.5662], [48, 11.7]];
    const ZOOM_X = [[37, 0], [38, -0.3], [44, -0.64], [45, -0.98], [46, -2.27], [47, -1.25], [48, -30.9]];
    const ZOOM_Y = [[42, 0], [43, 0.15], [45, 0.18], [46, 0.74], [47, 2.13], [48, 4.35]];
    const NEXT_SIZE = 74;
    const NEXT_DROP = 19.7;
    const NEXT_SCALE = [[41, 0], [42, 0.01], [43, 0.0576], [44, 0.1023], [45, 0.1647], [46, 0.262], [47, 0.4035], [48, 0.615], [49, 0.868], [50, 0.993], [51, 1], [75, 1.05]];
    const MAX_WIDTH = 1728;

    const track = (pts: number[][], at: number) => {
      if (at <= pts[0][0]) {
        return pts[0][1];
      }
      for (let i = 1; i < pts.length; i++) {
        const [t1, v1] = pts[i];
        const [t0, v0] = pts[i - 1];
        if (at <= t1) {
          return v0 + ((v1 - v0) * (at - t0)) / (t1 - t0);
        }
      }
      return pts[pts.length - 1][1];
    };
    const wordAt = (f: number) => Math.min(list.length - 1, Math.floor((f * list.length) / FLICKER_BEATS));
    const typedAt = (f: number) => Math.round(Math.min(1, Math.max(0, Math.floor(f - LINE_AT) / TYPE_FRAMES)) * rest.length);

    const deepestInk = (alpha: Uint8ClampedArray, w: number, h: number, from: number, to: number, midY: number) => {
      const d = new Float32Array(w * h);
      const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (alpha[y * w + x] > 127) {
            d[y * w + x] = 1 + Math.min(at(x - 1, y), at(x, y - 1), at(x - 1, y - 1), at(x + 1, y - 1));
          }
        }
      }
      for (let y = h - 1; y >= 0; y--) {
        for (let x = w - 1; x >= 0; x--) {
          if (d[y * w + x] > 0) {
            d[y * w + x] = Math.min(d[y * w + x], 1 + Math.min(at(x + 1, y), at(x, y + 1), at(x + 1, y + 1), at(x - 1, y + 1)));
          }
        }
      }
      const midX = (from + to) / 2;
      let best = { x: midX, y: midY, r: 0 };
      let top = -Infinity;
      for (let y = 0; y < h; y++) {
        for (let x = from; x < to; x++) {
          const r = at(x, y);
          const score = r - 0.01 * (Math.abs(x - midX) + Math.abs(y - midY));
          if (r > 0 && score > top) {
            top = score;
            best = { x, y, r };
          }
        }
      }
      return best;
    };

    const measure = () => {
      const P = 100;
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
      const setFont = (tracking: number) => {
        ctx.font = `${fontWeight} ${P}px ${face}`;
        ctx.letterSpacing = `${tracking * P}px`;
      };
      const em = (text: string, tracking: number) => {
        setFont(tracking);
        return ctx.measureText(text).width / P;
      };
      const out = { words: list.map((w) => em(w, WORD_TRACKING)), lead: em(lead, LEAD_TRACKING), leadInLine: em(lead, LINE_TRACKING), line: em(line, LINE_TRACKING), next: em(nextWord, WORD_TRACKING) };
      const w = Math.ceil(out.line * P);
      const h = 2 * P;
      const base = 1.3 * P;
      ctx.canvas.width = w;
      ctx.canvas.height = h;
      setFont(LINE_TRACKING);
      ctx.fillText(line, 0, base);
      const { data } = ctx.getImageData(0, 0, w, h);
      const alpha = new Uint8ClampedArray(w * h);
      for (let i = 0; i < alpha.length; i++) {
        alpha[i] = data[i * 4 + 3];
      }
      const pt = deepestInk(alpha, w, h, Math.round(w * 0.35), Math.round(w * 0.65), base - 0.26 * P);
      return { ...out, through: [pt.x / P, (base - pt.y) / P] };
    };
    let cached: ReturnType<typeof measure> | null = null;
    const metrics = () => {
      if (cached) {
        return cached;
      }
      const m = measure();
      if (document.fonts.check(`${fontWeight} 100px ${face}`)) {
        cached = m;
      }
      return m;
    };

    const W = STAGE_W;
    const H = (STAGE_W * view.height) / view.width;
    const cx = W / 2;
    const cy = H / 2;
    const px = view.width / W;
    const fit = (size: number, em: number) => Math.min(size, MAX_WIDTH / em);
    const maskId = 'hello-zoom-mask';

    const text = (o: { x: number; y: number; scale?: number; size: number; tracking: number; fill: string; anchor?: string; content: string }) => {
      const row = Math.floor(o.y * px);
      const fr = o.y * px - row;
      const copy = (base: number, opacity: number) => S.h('text', { transform: `translate(${o.x} ${base / px}) scale(${o.scale ?? 1})`, fontSize: o.size, fill: o.fill, opacity, textAnchor: o.anchor, style: { mixBlendMode: 'plus-lighter', letterSpacing: `${o.tracking}em` } }, o.content);
      return S.h('g', { style: { isolation: 'isolate' } }, copy(row, 1 - fr), copy(row + 1, fr));
    };

    const svg = S.h('svg', { viewBox: `0 0 ${W} ${H}`, width: view.width, height: view.height, style: { position: 'absolute', inset: 0, fontFamily: face, fontWeight, textRendering: 'geometricPrecision', whiteSpace: 'pre' } });
    const stage = S.fill({}, svg) as HTMLElement;
    view.root.replaceChildren(stage);

    const scene = (f: number, m: ReturnType<typeof measure>) => {
      const nextScale = track(NEXT_SCALE, f);
      const next = text({ x: cx, y: cy + NEXT_DROP * nextScale, scale: nextScale, size: fit(NEXT_SIZE, m.next), tracking: WORD_TRACKING, fill: paper, anchor: 'middle', content: nextWord });
      if (f < LEAD_AT) {
        const i = wordAt(f);
        const at = list.length > 1 ? (i / (list.length - 1)) * 6 : 0;
        const idx = (arr: number[]) => arr.map((v, j) => [j, v]);
        return [text({ x: cx + track(idx(WORD_NUDGE), at), y: cy + track(idx(WORD_DROP), at), size: fit(track(idx(WORD_SIZE), at), m.words[i]), tracking: WORD_TRACKING, fill: paper, anchor: 'middle', content: list[i] })];
      }
      if (f >= NEXT_AT) {
        return [next];
      }
      const lineType = f < LINE_AT ? leadType(f, m) : lineTypeAt(f, m);
      return [S.h('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H }, lineType), S.h('g', { mask: `url(#${maskId})` }, S.h('rect', { width: W, height: H, fill: ink }), next)];
    };

    const leadType = (f: number, m: ReturnType<typeof measure>) => {
      const size = fit(LEAD_SIZE, m.lead);
      return text({ x: cx - (m.lead * size) / 2 + LEAD_NUDGE - track(LEAD_DRIFT, f), y: cy + LEAD_DROP, size, tracking: LEAD_TRACKING, fill: '#fff', content: lead });
    };

    const lineTypeAt = (f: number, m: ReturnType<typeof measure>) => {
      const [tx, ty] = m.through;
      const reach = Math.max(tx, m.line - tx);
      const size = Math.min(LINE_SIZE, MAX_WIDTH / 2 / reach);
      const rest0 = cx - tx * size;
      const start = cx - (m.leadInLine * size) / 2;
      const x = rest0 + track(LINE_SLIDE, f) * LINE_START * (start - rest0);
      const y = cy + ty * size;
      const s = track(ZOOM, f);
      const n = typedAt(f);
      return text({ x: cx + s * (x - cx) + track(ZOOM_X, f), y: cy + s * (y - cy) + track(ZOOM_Y, f), scale: s, size, tracking: LINE_TRACKING, fill: '#fff', content: n > 0 ? `${lead} ${rest.slice(0, n)}` : lead });
    };

    return (frame) => {
      const f = frame * speed;
      stage.style.background = f >= LEAD_AT && f < NEXT_AT ? paper : ink;
      svg.replaceChildren(...scene(f, metrics()));
    };
  }
};

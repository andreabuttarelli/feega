import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'word-gather',
  title: 'Word gather',
  about: 'The lead word holds the frame, then the rest of the sentence drops in out of order around it and gathers.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 49,
  background: '#faf9f6',
  fonts: ['Figtree'],
  props: {
    text: { type: 'string', title: 'Text', default: 'Every scene is yours to own.', group: 'Content', maxLength: 120 },
    maxWidth: { type: 'number', title: 'Line width (card px)', default: 330, minimum: 50, maximum: 700, step: 1, group: 'Layout' },
    accent: { type: 'string', title: 'Accent (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    color: { type: 'string', title: 'Ink (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontWeight: { type: 'number', title: 'Font weight', default: 500, minimum: 100, maximum: 900, step: 100, group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const FACE = 'Word Gather Figtree';
    let redraw = () => {};
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE)) {
      const loaded = new FontFace(FACE, 'url(https://fonts.gstatic.com/s/figtree/v9/_Xms-HUzqDCFdgfMm4S9DQ.woff2) format("woff2")', { weight: '300 900' });
      document.fonts.add(loaded);
      loaded.load().then(() => redraw()).catch(() => undefined);
    }
    const face = S.pick(p.fontFamily, `"${FACE}", Figtree`);
    type Pt = readonly [number, number];
    const REF_W = 710;
    const REF_H = 388;
    const CENTRE_X = REF_W / 2;
    const LINE_CX = REF_W / 2 - 3.53;
    const CENTRE_Y = REF_H / 2;
    const RADIUS = 5.5;
    const BEATS = 39;
    const BEAT: Pt[] = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [6, 5], [7, 6], [8, 7], [9, 8], [10, 9], [12, 10], [13, 11], [14, 12], [15, 13], [17, 14], [18, 15], [19, 16], [20, 17], [22, 18], [23, 19], [24, 20], [26, 21], [27, 22], [28, 23], [29, 24], [31, 25], [32, 26], [33, 27], [34, 28], [35, 29], [37, 30], [38, 31], [39, 32], [41, 33], [42, 34], [43, 35], [44, 36], [45, 37], [47, 38], [48, 39]];
    const CAP = 35.82;
    const LINE_H = 48.18;
    const DROP = 5.77;
    const CAP_RATIO = 0.74909;
    const ASC = 0.9527;
    const LEADING = 1.2103;
    const TRACKING = -0.055;
    const SPACE_TRIM = -0.0549;
    const FIRST_AT = 20;
    const STAGGER = 1;
    const SETTLE = 4;
    const LEAD_RISE = 20.6;
    const TRAVEL: Pt[] = [[0, 0], [1, 0.391], [2, 0.563], [3, 0.686], [4, 0.77], [5, 0.836], [6, 0.887], [7, 0.928], [8, 0.96], [9, 0.982], [10, 0.991], [12, 0.996], [14, 1]];
    const LEAD_X: Pt[] = [[10, 0], [11, 0.004], [12, 0.007], [13, 0.02], [14, 0.036], [15, 0.063], [16, 0.107], [17, 0.18], [18, 0.317], [19, 0.547], [20, 0.701], [21, 0.793], [22, 0.852], [23, 0.892], [24, 0.921], [25, 0.946], [26, 0.959], [27, 0.97], [28, 0.98], [29, 0.99], [30, 0.992], [31, 1]];
    const LEAD_Y: Pt[] = [[0, 0], [1, 0.131], [2, 0.211], [3, 0.27], [4, 0.329], [5, 0.35], [6, 0.391], [7, 0.411], [8, 0.4341], [9, 0.47], [10, 0.514], [11, 0.612], [12, 0.817], [13, 0.905], [14, 0.949], [15, 0.985], [16, 1]];
    const SCALE: Pt[] = [[0, 1.289], [18, 1.289], [19, 1.2798], [20, 1.2782], [21, 1.2727], [22, 1.264], [23, 1.2546], [24, 1.2414], [25, 1.2184], [26, 1.159], [27, 1.0689], [28, 1.0417], [29, 1.0275], [30, 1.0193], [31, 1.0132], [32, 1.0081], [33, 1.0064], [34, 1], [BEATS, 1]];
    const SCATTER: Pt[] = [[44.4, -59.2], [73.8, -1], [-31.7, -1.7], [12.4, 41], [96.2, -1.7]];
    const ORDER = [5, 3, 1, 4, 2];

    const track = (table: Pt[], at: number) => {
      if (at <= table[0][0]) {
        return table[0][1];
      }
      for (let i = 0; i < table.length - 1; i++) {
        const [a, b] = [table[i], table[i + 1]];
        if (at <= b[0]) {
          return a[1] + (b[1] - a[1]) * ((at - a[0]) / (b[0] - a[0]));
        }
      }
      return table[table.length - 1][1];
    };

    const dropOrder = (n: number) => {
      const out: number[] = [];
      const take = (i: number) => {
        if (i >= 1 && i <= n && !out.includes(i)) {
          out.push(i);
        }
      };
      ORDER.forEach((seed) => take(seed <= n ? seed : ((seed - 1) % n) + 1));
      for (let i = 1; i <= n; i++) {
        take(i);
      }
      return out;
    };

    const words = String(p.text).split(/\s+/).filter(Boolean);
    const order = dropOrder(words.length - 1);
    const size = CAP / CAP_RATIO;
    const weight = Number(p.fontWeight);
    const maxWidth = Number(p.maxWidth);
    const ink = S.pick(p.color, String(t.foreground));
    const lit = S.pick(p.accent, String(t.primary));
    const speed = Number(p.speed);
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

    const measure = () => {
      ctx.font = `${weight} ${size}px ${face}`;
      return { widths: words.map((w) => ctx.measureText(w).width + w.length * TRACKING * size), space: ctx.measureText(' ').width + (TRACKING + SPACE_TRIM) * size };
    };

    const solve = (widths: number[], space: number) => {
      const lines: number[][] = [[]];
      let run = 0;
      widths.forEach((w, i) => {
        const line = lines[lines.length - 1];
        const add = (line.length ? space : 0) + w;
        if (line.length > 0 && run + add > maxWidth) {
          lines.push([i]);
          run = w;
          return;
        }
        line.push(i);
        run += add;
      });
      const top = CENTRE_Y + CAP / 2 + DROP - ((lines.length - 1) * LINE_H) / 2;
      const out: { x: number; baseline: number }[] = [];
      lines.forEach((line, k) => {
        const total = line.reduce((sum, i) => sum + widths[i], 0) + space * (line.length - 1);
        let x = LINE_CX - total / 2;
        line.forEach((i) => {
          out[i] = { x, baseline: top + k * LINE_H };
          x += widths[i] + space;
        });
      });
      return out;
    };

    const rise = ASC * size;
    const els = words.map((word) => {
      const inner = S.h('div', { style: { transformOrigin: `0 ${rise}px`, fontSize: size, lineHeight: LEADING, fontWeight: weight, letterSpacing: `${TRACKING}em`, whiteSpace: 'pre' } }, word) as HTMLElement;
      const outer = S.h('div', { style: { position: 'absolute', width: 'max-content' } }, inner) as HTMLElement;
      return { outer, inner };
    });
    const k = Math.max(view.width / REF_W, view.height / REF_H);
    const card = S.h('div', { style: { position: 'absolute', width: REF_W, height: REF_H, left: (view.width - REF_W * k) / 2, top: (view.height - REF_H * k) / 2, transform: `scale(${k})`, transformOrigin: 'top left', background: t.background, borderRadius: RADIUS, overflow: 'hidden', fontFamily: face, textRendering: 'geometricPrecision' } }, els.map((e) => e.outer));
    view.root.replaceChildren(S.fill({ background: 'transparent', overflow: 'hidden' }, card));

    const place = (i: number, x: number, base: number, s: number, colour: string | null) => {
      const { outer, inner } = els[i];
      outer.style.display = colour === null ? 'none' : 'block';
      outer.style.left = `${CENTRE_X + (x - CENTRE_X) * s}px`;
      outer.style.top = `${CENTRE_Y + (base - CENTRE_Y) * s - rise}px`;
      inner.style.transform = `scale(${s})`;
      inner.style.color = colour ?? ink;
    };

    const render = (at: number) => {
      redraw = () => render(at);
      const { widths, space } = measure();
      const slots = solve(widths, space);
      const b = track(BEAT, at * speed);
      const s = track(SCALE, b);
      const lx = track(LEAD_X, b);
      const ly = track(LEAD_Y, b);
      const aloneX = LINE_CX - (widths[0] ?? 0) / 2;
      const aloneBase = CENTRE_Y + CAP / 2;
      words.forEach((_, i) => {
        const slot = slots[i];
        if (i === 0) {
          place(0, slot.x + (aloneX - slot.x) * (1 - lx), slot.baseline + (aloneBase - slot.baseline + LEAD_RISE) * (1 - ly), s, ink);
          return;
        }
        const k2 = order.indexOf(i);
        const start = FIRST_AT + STAGGER * (k2 < 0 ? i - 1 : k2);
        if (b < start) {
          place(i, 0, 0, s, null);
          return;
        }
        const pr = track(TRAVEL, b - start);
        const d = SCATTER[(i - 1) % SCATTER.length];
        place(i, slot.x + d[0] * (1 - pr), slot.baseline + d[1] * (1 - pr), s, b < start + SETTLE ? lit : ink);
      });
    };
    return render;
  }
};

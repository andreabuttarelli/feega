import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'check-cycle',
  title: 'Check cycle',
  about: 'A sentence finishes itself over and over: each word rolls up beside a ticked checkbox, then the line steps back and rests.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 136,
  background: '#faf9f6',
  fonts: ['Inter'],
  props: {
    headline: { type: 'string', title: 'Headline', default: 'Create your own', group: 'Content', maxLength: 80 },
    words: { type: 'string', title: 'Words (comma separated)', default: 'Intros, Demos, Launches, Changelogs, Tutorials, And more', group: 'Content', maxLength: 300 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    color: { type: 'string', title: 'Text colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    boxColor: { type: 'string', title: 'Checkbox colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    tickColor: { type: 'string', title: 'Tick colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const FACE = 'Check Cycle Inter';
    const FACE_URL = 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2';
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE)) {
      const loaded = new FontFace(FACE, `url(${FACE_URL}) format("woff2")`, { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().catch(() => undefined);
    }
    const face = S.pick(p.fontFamily, `"${FACE}", Inter`);
    const REF_W = 718;
    const REF_H = 394;
    const SIZE = 21.78;
    const LEAD_END = 340.04;
    const LEAD_BASE = 203.01;
    const WORD_X = 379.1;
    const WORD_BASE = 204.97;
    const BOX = { x: 345.11, y: 183.71, w: 27.03, h: 27.59, r: 6.53 };
    const TICK = [[5.468, 13.785], [11.827, 18.695], [20.72, 8.888]];
    const TICK_W = 2.72;
    const SLOT = [171.37, 223.62];
    const TRAVEL = [44.19, 42.27];
    const ROLL_AT = 0.0324;
    const ROLL_EVERY = 0.667;
    const ROLL_FOR = 0.5;
    const EASE = S.Easing.bezier(0.65, 0, 0.35, 1);
    const HOLD = 1.004;
    const PIVOT = [359.14, 197.52];
    const ZOOM_TO = 0.8;
    const ZOOM_FOR = 0.6;
    const unit = (v: number) => Math.min(1, Math.max(0, v));

    const list = String(p.words).split(',').map((w) => w.trim()).filter(Boolean);
    const n = Math.max(1, list.length);
    const stripAt = (now: number) => {
      let s = 0;
      for (let k = 0; k < n - 1; k++) {
        s += TRAVEL[k % 2] * EASE(unit((now - (ROLL_AT + k * ROLL_EVERY)) / ROLL_FOR));
      }
      return s;
    };
    const restOf = (k: number) => {
      let c = 0;
      for (let j = 0; j < k; j++) {
        c += TRAVEL[j % 2];
      }
      return c;
    };
    const zoomStart = ROLL_AT + Math.max(0, n - 2) * ROLL_EVERY + HOLD;
    const zoomAt = (now: number) => 1 - (1 - ZOOM_TO) * EASE(unit((now - zoomStart) / ZOOM_FOR));

    const u = Math.min(view.width / REF_W, view.height / REF_H);
    const top = (view.height - REF_H * u) / 2;
    const dpr = 1;
    const fg = S.pick(p.color, String(t.foreground));
    const type = { fontFamily: face, fontWeight: 500, fontSize: SIZE, fill: fg, textRendering: 'geometricPrecision' };

    const line = (x: number, y: number, dev: { a: number; b: number }, text: string, anchor?: string) => {
      const d = dev.a * y + dev.b;
      const lo = Math.floor(d);
      const f = d - lo;
      const at = (row: number) => (row + 1e-3 - dev.b) / dev.a;
      return S.h('g', { style: { isolation: 'isolate' } }, [[lo, 1 - f], [lo + 1, f]].map(([row, w]) => S.h('text', { x, y: at(row), textAnchor: anchor, style: { ...type, opacity: w, mixBlendMode: 'plus-lighter' } }, text)));
    };

    const svg = S.h('svg', { width: REF_W * u, height: REF_H * u, viewBox: `0 0 ${REF_W} ${REF_H}`, style: { position: 'absolute', left: (view.width - REF_W * u) / 2, top, overflow: 'visible' } });
    view.root.replaceChildren(S.fill({ backgroundColor: String(t.background) }, svg));
    const clipId = 'check-cycle-slot';

    return (frame) => {
      const now = frame / view.fps;
      const s = stripAt(now);
      const z = zoomAt(now);
      const [x0, y0] = PIVOT;
      const dev = { a: dpr * u * z, b: dpr * (top + u * y0 * (1 - z)) };
      const words = list.map((word, k) => {
        const y = WORD_BASE + restOf(k) - s;
        if (Math.abs(y - WORD_BASE) > SLOT[1] - SLOT[0] + SIZE) {
          return null;
        }
        return line(WORD_X, y, dev, word);
      });
      svg.replaceChildren(
        S.h('defs', null, S.h('clipPath', { id: clipId }, S.h('rect', { x: 0, y: SLOT[0], width: REF_W, height: SLOT[1] - SLOT[0] }))),
        S.h('g', { transform: `translate(${x0} ${y0}) scale(${z}) translate(${-x0} ${-y0})` },
          line(LEAD_END, LEAD_BASE, dev, String(p.headline), 'end'),
          S.h('rect', { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, rx: BOX.r, fill: S.pick(p.boxColor, String(t.primary)) }),
          S.h('polyline', { points: TICK.map(([a, b]) => `${BOX.x + a},${BOX.y + b}`).join(' '), fill: 'none', stroke: S.pick(p.tickColor, String(t.primaryForeground)), strokeWidth: TICK_W, strokeLinecap: 'round', strokeLinejoin: 'round' }),
          S.h('g', { clipPath: `url(#${clipId})` }, words)
        )
      );
    };
  }
};

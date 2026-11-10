import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'word-wheel',
  title: 'Word wheel',
  about: 'A column of words spins like a reel beside a fixed lead-in and stops on one.',
  category: SnapcnCategory.Text,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 66,
  background: '#faf9f6',
  fonts: ['Jost'],
  props: {
    headline: { type: 'string', title: 'Lead-in', default: 'snapcn for', group: 'Content', maxLength: 80 },
    words: { type: 'string', title: 'Words (comma separated)', default: 'Launches, Founders, Indie hackers, Agencies, Designers, Startups, Dev tools, Solo builders, Changelogs', group: 'Content', maxLength: 600 },
    spin: { type: 'number', title: 'Rows travelled (0 = word count)', default: 0, minimum: 0, maximum: 60, step: 1, group: 'Motion' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Jost', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const face = S.pick(p.fontFamily, 'Jost');
    const REF_W = 638;
    const REF_H = 354;
    const PITCH = 34;
    const BASE_Y = 183.8;
    const LINE_X = 201.98;
    const GAP = 8.01;
    const INDENT = 30.87;
    const SIZE = 30.63;
    const ASC = 25.43;
    const SMALL = 1 / 1.665;
    const SWAP = 0.07;
    const ROLL = [[0.1583, 0.00033], [0.175, 0.02175], [0.2083, 0.05298], [0.2417, 0.08995], [0.275, 0.13203], [0.3083, 0.18194], [0.3417, 0.23034], [0.3833, 0.28119], [0.4167, 0.32889], [0.45, 0.37627], [0.4833, 0.42203], [0.5167, 0.46322], [0.5583, 0.50415], [0.575, 0.54044], [0.6083, 0.57445], [0.6417, 0.6073], [0.675, 0.63751], [0.7083, 0.66516], [0.7417, 0.69074], [0.775, 0.71485], [0.8083, 0.73897], [0.8417, 0.75963], [0.875, 0.77896], [0.9083, 0.79751], [0.9417, 0.81422], [0.975, 0.83177], [1.0167, 0.84767], [1.05, 0.86162], [1.0833, 0.87394], [1.1167, 0.88608], [1.1417, 0.89735], [1.175, 0.9077], [1.2083, 0.91734], [1.2417, 0.92633], [1.275, 0.93528], [1.3083, 0.94438], [1.35, 0.95087], [1.3833, 0.95819], [1.4417, 0.96961], [1.475, 0.97442], [1.5083, 0.97863], [1.5417, 0.98239], [1.575, 0.98571], [1.6083, 0.98903], [1.6417, 0.99161], [1.6833, 0.99381], [1.7167, 0.99569], [1.75, 0.99732], [1.7833, 0.99858], [1.8083, 0.99926], [1.8417, 1]];
    const FADE = [[0, 1], [0.085, 0.97], [0.155, 0.89], [0.22, 0.744], [0.288, 0.518], [0.356, 0.357], [0.424, 0.25], [0.492, 0.185]];

    const read = (table: number[][], v: number, at: number) => {
      const to = at === 0 ? 1 : 0;
      const last = table[table.length - 1];
      if (v <= table[0][at]) {
        return table[0][to];
      }
      if (v >= last[at]) {
        return last[to];
      }
      for (let i = 1; i < table.length; i++) {
        const hi = table[i];
        const lo = table[i - 1];
        if (v <= hi[at]) {
          return lo[to] + ((hi[to] - lo[to]) * (v - lo[at])) / (hi[at] - lo[at]);
        }
      }
      return last[to];
    };
    const reaches = (q: number) => {
      if (q <= ROLL[0][1]) {
        return Number.NEGATIVE_INFINITY;
      }
      if (q > ROLL[ROLL.length - 1][1]) {
        return Number.POSITIVE_INFINITY;
      }
      return read(ROLL, q, 1);
    };
    const swell = (x: number) => {
      if (x <= 0) {
        return 0;
      }
      if (x >= SWAP) {
        return 1;
      }
      return 1 - (1 - x / SWAP) ** 3;
    };

    const reel = String(p.words).split(',').map((w) => w.trim()).filter(Boolean);
    const rows = reel.length || 1;
    const travel = (Number(p.spin) || rows) * PITCH;
    const u = view.height / REF_H;
    const ox = (view.width - REF_W * u) / 2;
    const ink = String(t.foreground);
    const dim = String(t.mutedForeground);

    const anchor = S.h('span', { style: { position: 'relative', display: 'inline-block', width: 0 } }) as HTMLElement;
    const line = S.h('div', { style: { position: 'absolute', left: LINE_X * u, top: (BASE_Y - ASC) * u, fontSize: SIZE * u, lineHeight: 1, color: ink } }, String(p.headline), anchor);
    const box = S.h('div', { style: { position: 'absolute', left: ox, top: 0, width: REF_W * u, height: REF_H * u, fontFamily: face, fontWeight: 500, textRendering: 'geometricPrecision', whiteSpace: 'nowrap' } }, line);
    view.root.replaceChildren(S.fill({ backgroundColor: String(t.background) }, box));

    const row = (i: number, s: number, now: number) => {
      const y = BASE_Y + PITCH * i - s;
      const k = swell(now - reaches((PITCH * (i - 0.5)) / travel)) - swell(now - reaches((PITCH * (i + 0.5)) / travel));
      const scale = SMALL + (1 - SMALL) * k;
      return S.h('div', { style: { position: 'absolute', left: (GAP + INDENT) * u, top: (y - ASC - BASE_Y) * u, color: k > 0 ? S.mixOklch(dim, ink, k) : dim, opacity: read(FADE, Math.abs(y - BASE_Y) / REF_H, 0), transform: `translateX(${-INDENT * k * u}px) scale(${scale})`, transformOrigin: `0px ${ASC * u}px` } }, reel[((i % rows) + rows) % rows]);
    };

    return (frame) => {
      const now = frame / view.fps;
      const s = read(ROLL, now, 0) * travel;
      const first = Math.ceil((s - BASE_Y - PITCH) / PITCH);
      const last = Math.floor((s - BASE_Y + REF_H + PITCH) / PITCH);
      anchor.replaceChildren(...Array.from({ length: last - first + 1 }, (_, n) => row(first + n, s, now)));
    };
  }
};

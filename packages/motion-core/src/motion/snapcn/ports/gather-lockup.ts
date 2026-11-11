import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'gather-lockup',
  title: 'Gather lockup',
  about: 'A wall of work under a line of type: the words fall apart, the wall cuts to a row of four, then hands over to your mark and wordmark.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 150,
  background: '#faf9f6',
  fonts: ['Inter Tight'],
  props: {
    lines: { type: 'string', title: 'Title words (lines by newline)', default: 'Ship\nyour demo\nin code', group: 'Content', maxLength: 200 },
    images: { type: 'string', title: 'Images', format: PropFormat.Media, default: '', group: 'Content', maxLength: 2000 },
    captions: { type: 'string', title: 'Seven captions, one per line', default: 'Launch film\nProduct demo\nFeature drop\nChangelog\nPricing reel\nFounder intro\nLogo outro', group: 'Content', maxLength: 600 },
    wordmark: { type: 'string', title: 'Wordmark', default: 'feega', group: 'Content', maxLength: 40 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'sans', group: 'Style' },
    wordmarkColor: { type: 'string', title: 'Wordmark colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    markColor: { type: 'string', title: 'Mark colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    wordmarkTracking: { type: 'number', title: 'Wordmark letter spacing (em)', default: -0.03, minimum: -0.2, maximum: 0.5, step: 0.005, group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const c = S.themeOf(String(p.mode));
    const RATE = 24;
    const FRAMES = 45;
    const STAGE_W = 1920;
    const STAGE_H = 1080;
    const UNIT = 2000;
    const TILES: { keys: number[][]; until: number; opacity: number }[] = [ { keys: [ [0, 0, 620.0, 50.0, 221.1, 228.7, 582.25, 12.25, 296.6, 304.21], [13, 0, 612.04, 50.11, 221.1, 228.7, 574.29, 12.36, 296.6, 304.21], [17, 0, 1132.37, 3.37, 221.1, 228.7, 1094.62, -34.38, 296.6, 304.21], ], until: 17, opacity: 0.4, }, { keys: [ [0, 1, 1180.0, 50.0, 211.5, 261.63, 1141.83, 11.68, 288.03, 338.3], [10, 1, 1169.91, 50.0, 211.2, 261.6, 1131.54, 11.68, 288.0, 338.26], [14, 1, 1098.4, 50.32, 211.58, 261.68, 1060.64, 12.57, 287.08, 337.19], [15, 1, 977.07, 254.0, 198.96, 245.93, 940.71, 216.94, 272.19, 319.69], [18, 9, 980.68, 378.42, 194.59, 195.24, 942.93, 340.67, 270.09, 270.74], [21, 9, 980.68, 441.2, 194.64, 194.83, 942.81, 403.94, 270.07, 270.71], [24, 9, 979.71, 447.99, 181.94, 181.46, 944.61, 413.16, 252.04, 252.65], [26, 13, 979.5, 447.78, 182.62, 181.32, 941.74, 410.02, 258.12, 256.83], [27, 13, 977.47, 470.4, 136.37, 135.91, 949.24, 442.55, 192.66, 191.69], ], until: 28, opacity: 1, }, { keys: [ [0, 2, 120.0, 110.0, 179.43, 237.28, 82.82, 73.05, 256.38, 333.63], [14, 2, 228.19, 110.02, 179.38, 237.22, 190.86, 73.07, 256.42, 333.68], [15, 2, 414.74, 243.29, 182.27, 259.93, 376.99, 205.54, 257.77, 335.43], [18, 7, 520.99, 425.53, 195.69, 193.59, 483.24, 387.78, 271.2, 269.1], [20, 7, 520.88, 439.79, 195.72, 193.4, 483.46, 402.39, 270.67, 268.57], [22, 11, 522.04, 438.98, 195.07, 194.27, 484.29, 401.23, 270.58, 269.77], [24, 11, 552.3, 445.51, 182.02, 181.75, 517.65, 410.94, 251.38, 250.63], ], until: 24, opacity: 1, }, { keys: [ [0, 3, 90.0, 560.0, 214.95, 234.82, 52.25, 522.25, 290.45, 310.33], [14, 3, 102.35, 560.02, 214.95, 234.82, 64.6, 522.27, 290.45, 310.33], [16, 3, 12.13, 479.16, 214.95, 234.82, -25.62, 441.41, 290.45, 310.33], ], until: 18, opacity: 0.42, }, { keys: [ [0, 4, 1600.0, 190.0, 259.74, 223.69, 1562.24, 152.25, 335.24, 299.19], [ 10, 4, 1571.61, 172.42000000000002, 259.74, 223.69, 1533.85, 134.67, 335.24, 299.19, ], [13, 4, 1563.54, 172.34, 259.74, 223.69, 1525.78, 134.59, 335.24, 299.19], [16, 4, 1639.07, 564.4, 259.74, 223.69, 1601.31, 526.65, 335.24, 299.19], ], until: 17, opacity: 0.42, }, { keys: [ [0, 5, 520.0, 800.0, 163.01, 182.72, 486.4, 766.22, 229.61, 249.59], [5, 5, 525.99, 800.0, 162.61, 182.72, 492.35, 766.22, 229.58, 249.56], [6, 5, 526.47, 800.05, 162.09, 182.7, 492.35, 766.2, 229.64, 249.62], [7, 5, 614.11, 799.97, 161.8, 182.75, 579.53, 766.16, 229.76, 249.75], [10, 5, 622.31, 799.97, 160.72, 182.72, 588.6, 766.27, 229.36, 249.31], [12, 5, 622.34, 779.56, 162.9, 182.8, 588.86, 746.31, 228.66, 248.55], [15, 5, 752.31, 543.86, 182.02, 204.43, 714.55, 506.1, 257.53, 279.94], [17, 8, 749.31, 496.69, 185.26, 185.26, 713.91, 460.99, 256.89, 257.12], [19, 8, 749.91, 447.83, 193.75, 193.94, 712.28, 409.87, 269.18, 269.42], [21, 8, 749.93, 441.63, 193.75, 194.0, 712.18, 403.87, 269.26, 269.5], [24, 12, 762.93, 448.77, 181.48, 180.62, 725.18, 411.02, 256.99, 256.13], ], until: 26, opacity: 1, }, { keys: [ [0, 6, 1330.0, 780.0, 192.35, 206.45, 1292.25, 742.24, 267.86, 281.96], [11, 6, 1309.75, 779.87, 192.35, 206.45, 1272.0, 742.11, 267.86, 281.96], [13, 6, 1187.38, 779.9, 192.35, 206.45, 1149.63, 742.14, 267.86, 281.96], [15, 6, 1239.45, 638.43, 192.35, 206.45, 1201.7, 600.67, 267.86, 281.96], [16, 6, 1239.42, 589.64, 191.97, 206.53, 1201.23, 551.57, 268.79, 282.95], [18, 10, 1208.58, 463.2, 195.56, 193.59, 1170.82, 425.45, 271.07, 269.1], [22, 10, 1208.63, 440.14, 195.51, 193.16, 1170.82, 402.2, 271.14, 269.17], [ 24, 10, 1192.69, 446.97, 183.67, 179.95, 1157.02, 411.29, 253.57, 251.73, ], [27, 14, 1136.2, 470.21, 135.32, 134.7, 1098.44, 432.46, 210.82, 210.2], ], until: 30, opacity: 1, }, ];
    const WORDS: { anchor: string; keys: number[][]; until: number }[] = [ { anchor: "middle", until: 14, keys: [ [0, 972.67, 471.26, 123.07], [10, 911.35, 471.32, 123.07], [13, 913.46, 474.42, 117.25], ], }, { anchor: "end", until: 13, keys: [ [0, 916.29, 581.72, 122.94], [12, 875.76, 581.12, 122.7], [13, 880.4, 579.8, 117.38], ], }, { anchor: "start", until: 14, keys: [ [0, 938.37, 581.02, 126.12], [13, 934.49, 578.99, 120.05], ], }, { anchor: "end", until: 14, keys: [ [0, 1250.86, 690.01, 123.48], [7, 1128.38, 690.12, 122.97], [9, 1125.03, 690.31, 124.15], [13, 1117.91, 682.68, 118.09], ], }, { anchor: "start", until: 13, keys: [ [0, 1276.93, 689.91, 124.31], [12, 1235.65, 689.8, 124.26], [13, 1223.68, 683.76, 118.87], ], }, ];
    const LOGO = { size: 78.2, wordSize: 91.69, gap: 10.79, mark: [ [25, 623.46, 502.79], [27, 747.51, 502.79], [31, 760.99, 502.79], [33, 765.03, 502.79], ], word: [ [27, 2, 0, 841.89, 571.55], [29, 4, 1, 841.89, 571.55], [31, 6, 0, 856.45, 571.55], [33, 6, 0, 859.96, 571.55], ], };
    const BRAND_MARK = { width: S.mark.width, height: S.mark.height, shapes: [S.mark.d] };
    const FACE = 'Gather Lockup Inter Tight';
    if (typeof FontFace !== 'undefined' && ![...document.fonts].some((f) => f.family === FACE)) {
      const loaded = new FontFace(FACE, 'url(https://fonts.gstatic.com/s/intertight/v9/NGSwv5HMAFg6IuGlBNMjxLsH8ag.woff2) format("woff2")', { weight: '100 900' });
      document.fonts.add(loaded);
      loaded.load().catch(() => undefined);
    }
    const family = S.pick(p.fontFamily, `"${FACE}", "Inter Tight"`);
    const lines = (s: unknown) => String(s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
    const words = lines(p.lines).flatMap((l) => l.split(/\s+/));
    const images = S.media(p.images);
    const captions = lines(p.captions);
    const wordmark = String(p.wordmark);
    const tracking = Number(p.wordmarkTracking);
    const speed = Number(p.speed);
    const fg = String(c.foreground);
    const wordFill = S.pick(p.wordmarkColor, fg);
    const markFill = S.pick(p.markColor, String(c.primary));
    const px = Math.max(view.width / STAGE_W, view.height / STAGE_H);
    const lockupShift = -0.28 * LOGO.wordSize * (wordmark.length - 6);
    const markScale = LOGO.size / Math.max(BRAND_MARK.width, BRAND_MARK.height);

    const pose = (keys: readonly (readonly number[])[], frame: number) => {
      let hit: readonly number[] | undefined;
      for (const k of keys) {
        if ((k[0] ?? 0) <= frame) {
          hit = k;
        }
      }
      return hit;
    };

    const reveal = (n: number, split: number) => {
      const shown = n >= 6 ? wordmark.length : n >= 4 ? wordmark.length - 1 : Math.ceil(wordmark.length / 3);
      return split ? [wordmark.slice(0, shown - 1), wordmark.slice(shown - 1, shown)] : [wordmark.slice(0, shown), ''];
    };

    const tileEl = (pic: number, x: number, y: number, w: number, h: number, b: number[]) => {
      const [bx = 0, by = 0, bw = 0, bh = 0] = b;
      const src = images[pic % Math.max(1, images.length)] ?? '';
      const box = { position: 'absolute', left: `${((bx - x) / w) * 100}%`, top: `${((by - y) / h) * 100}%`, width: `${(bw / w) * 100}%`, height: `${(bh / h) * 100}%`, maxWidth: 'none', objectFit: 'cover' };
      const inner = src ? S.h('img', { src, style: box }) : S.h('div', { style: { ...box, background: String(c.muted) } });
      return S.h('div', { style: { position: 'absolute', left: 0, top: 0, width: UNIT, height: (UNIT * h) / w, overflow: 'hidden', transformOrigin: '0 0', transform: `translate(${x}px, ${y}px) scale(${w / UNIT})` } }, inner);
    };

    const textEl = (attrs: Record<string, unknown>, style: Record<string, string | number>, ...kids: (Node | string)[]) => S.h('text', { ...attrs, style: { fontFamily: family, textRendering: 'geometricPrecision', ...style } }, ...kids);

    const svgKids = (frame: number) => {
      const out: Node[] = [];
      TILES.forEach((tile, i) => {
        const k = pose(tile.keys, frame);
        if (!k || frame > tile.until || (k[1] ?? 0) > 6) {
          return;
        }
        const x = k[2] ?? 0;
        const h = k[5] ?? 0;
        out.push(S.h('g', { opacity: tile.opacity }, S.h('circle', { cx: x + 6, cy: y(k) + h + 18, r: 4.5, fill: fg, opacity: 0.5 }), textEl({ x: x + 19, y: y(k) + h + 23, fill: fg, opacity: 0.45 }, { fontSize: '15px', fontWeight: 500 }, captions[i] ?? '')));
      });
      WORDS.forEach((w, i) => {
        const k = pose(w.keys, frame);
        const word = words[i];
        if (!k || !word || frame > w.until) {
          return;
        }
        out.push(textEl({ x: k[1], y: k[2], textAnchor: w.anchor, fill: fg }, { fontWeight: 600, fontSize: `${k[3]}px`, letterSpacing: '-0.02em' }, word));
      });
      const mark = pose(LOGO.mark, frame);
      if (mark) {
        out.push(S.h('g', { transform: `translate(${(mark[1] ?? 0) + lockupShift} ${mark[2] ?? 0}) scale(${markScale})` }, BRAND_MARK.shapes.map((d) => S.h('path', { d, fill: markFill, fillRule: 'evenodd' }))));
      }
      const wk = pose(LOGO.word, frame);
      if (wk) {
        const [head, tail] = reveal(wk[1] ?? 0, wk[2] ?? 0);
        out.push(textEl({ x: (wk[3] ?? 0) + lockupShift, y: wk[4], fill: wordFill }, { fontWeight: 600, fontSize: `${LOGO.wordSize}px`, letterSpacing: `${tracking}em` }, head, ...(tail ? [S.h('tspan', { dx: LOGO.gap }, tail)] : [])));
      }
      return out;
    };

    const y = (k: readonly number[]) => k[3] ?? 0;
    const tiles = S.h('div', { style: { position: 'absolute', inset: 0 } });
    const svg = S.h('svg', { viewBox: `0 0 ${STAGE_W} ${STAGE_H}`, width: STAGE_W, height: STAGE_H, style: { position: 'absolute', inset: 0 } });
    const stage = S.h('div', { style: { position: 'absolute', left: (view.width - STAGE_W * px) / 2, top: (view.height - STAGE_H * px) / 2, width: STAGE_W, height: STAGE_H, transform: `scale(${px})`, transformOrigin: '0 0' } }, tiles, svg);
    view.root.replaceChildren(S.fill({ background: 'transparent', overflow: 'hidden' }, stage));
    const tileEls = TILES.map((tile) => tile.keys.map((k) => tileEl(k[1] ?? 0, k[2] ?? 0, k[3] ?? 0, k[4] ?? 0, k[5] ?? 0, k.slice(6)) as HTMLElement));
    tileEls.forEach((els, i) => els.forEach((el) => {
      el.style.opacity = String(TILES[i].opacity);
      tiles.appendChild(el);
    }));

    return (at) => {
      const frame = Math.min(FRAMES - 1, Math.floor(((at * speed) / view.fps) * RATE + 1e-6));
      TILES.forEach((tile, i) => {
        const k = pose(tile.keys, frame);
        const live = k && frame <= tile.until ? tile.keys.indexOf(k as number[]) : -1;
        tileEls[i].forEach((el, j) => {
          el.style.display = j === live ? 'block' : 'none';
        });
      });
      svg.replaceChildren(...svgKids(frame));
    };
  }
};

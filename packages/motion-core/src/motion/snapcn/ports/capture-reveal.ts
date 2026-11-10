import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'capture-reveal',
  title: 'Capture reveal',
  about: 'A screenshot toast counts up over a window, the window drops away and a two-line headline rises from behind it.',
  category: SnapcnCategory.Screen,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 130,
  background: '#faf9f6',
  fonts: ['DM Sans'],
  props: {
    headline: { type: 'string', title: 'Headline (| breaks lines)', default: 'no more | keyframes', group: 'Content', maxLength: 120 },
    capturing: { type: 'string', title: 'Toast while counting', default: 'Capturing selection...', group: 'Content', maxLength: 60 },
    copied: { type: 'string', title: 'Toast once landed', default: 'Copied to clipboard.', group: 'Content', maxLength: 60 },
    src: { type: 'string', title: 'Window screenshot', format: PropFormat.Asset, assetKind: 'image', default: null, group: 'Content', maxLength: 2000 },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'DM Sans', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const REF_W = 714;
    const REF_H = 394;
    const BEATS = 24;
    const REF_AT = 32;
    const GRID = { x0: 12.85, dx: 45.379, y0: 16.44, dy: 45.245, across: 0.0275, down: 0.0149 };
    const WIN = { x: 152.34, y: 106.57, w: 400.76, r: 9 };
    const WIN_SHADOW = { dy: 5.9, blur: 10.07, spread: -1.21, alpha: 0.207 };
    const WIN_ORIGIN = [352.85, 361.33];
    const DROP = 107.905;
    const SHRINK = 0.1581;
    const DROP_AT = 0.154;
    const DROP_FOR = 19.16;
    const DROP_EASE = S.Easing.bezier(0.5492, 0.2279, 0.1361, 0.9381);
    const SETTLE = 0.0267;
    const SETTLE_AT = 18.62;
    const SETTLE_TAU = 28.94;
    const CURSOR_FROM = [573.334, 189.634];
    const CURSOR_BY = [-83.28, -111.49];
    const CURSOR_AT = -0.03;
    const CURSOR_FOR = 19.5;
    const CURSOR_EASE = S.Easing.bezier(0.54, 0.1, 0.41, 0.97);
    const DRIFT = [-0.16, -0.43];
    const DRIFT_AT = 19;
    const ARROW = [[0, 0], [14.779, 15.455], [5.855, 15.72], [0.051, 21.146]];
    const ARROW_OUTLINE = 1.194;
    const ARROW_SHADOW = { dx: -1.571, dy: 1.45, sigma: 0.716, alpha: 0.247 };
    const HEAD = { x: 353.64, mid: 188.619, pitch: 45.304, size: 45.93, weight: 367, track: 0.952, opsz: 40, ink: 0.29 };
    const RISE = 22.585;
    const RISE_AT = 7.342;
    const RISE_FOR = 23.972;
    const RISE_EASE = S.Easing.bezier(0.114, 1, 0.665, 1);
    const FADE_AT = 8;
    const FADE_FOR = 8.322;
    const FADE_EASE = S.Easing.bezier(0, 0.235, 0.166, 1);
    const TOAST = { h: 49.357, r: 8.879, shadow: { dy: 0.012, blur: 14.549, spread: -2.397, alpha: 0.2512 }, size: 12.46, weight: 347, track: -0.192, opsz: 9 };
    const COPIED = { at: [357.7, 62.904], check: { x: 21.371, dy: 0.005, r: 7.143, stroke: 1.124 }, tick: [[-3.232, 0.238], [-0.916, 2.835], [3.193, -2.28]], text: { x: 38.469, base: 3.445 }, right: 18.464 };
    const CAPTURING = { at: [353.221, 63.002], scale: 0.8855, icon: { x: 20.957, dy: -1.09 }, text: { x: 39.039, base: 3.665 }, gap: 10.067, right: 10.067, percent: { base: 4.731 } };
    const MARK = {
      path: 'M43.9 1.41C27.2 5.51 13.4 16.31 5.9 31.11C-0.1 43.11 0 39.51 0 155.01C0 255.41 0.1 260.92 1.9 266.22C6.7 280.92 16.7 288.81 35 292.42C45 294.42 47.7 295.72 53.6 301.12C58.9 306.02 61 312.02 61 322.31C61.1 334.42 65.2 341.92 74.3 346.72L79.5 349.42L177.5 349.72C265.8 350.02 276.1 349.81 281.7 348.42C289.2 346.31 295 341.72 298.8 334.52L301.5 329.42L301.8 297.92C302 280.62 302 263.72 301.8 260.52L301.5 254.52L298.4 259.52C294.8 265.42 288.3 271.02 281.4 274.12L276.5 276.42L195.5 276.72C136.4 276.92 113 276.72 109 275.92C96.2 273.12 83.2 263.81 76.5 252.52C70 241.52 69.9 239.71 70.2 169.91L70.5 107.41L72.9 101.61C77.3 90.51 87.6 80.61 99.9 75.72L105.5 73.41L188.5 73.11C269.4 72.91 271.6 72.91 278 74.91C286 77.41 292.9 82.31 297.8 89.11L301.5 94.31L301.8 60.91C302.1 24.21 301.5 19.11 296.2 11.51C293.2 7.11 286.4 2.41 281 0.91C278.8 0.31 235.3-0.09 163.5 0.01C71.2 0.11 48.4 0.31 43.9 1.41ZM365 83.61C332.3 103.22 305.2 119.72 304.8 120.31C304.4 120.91 304.1 145.71 304.3 175.31L304.5 229.31L319 238.41C327 243.41 339.8 251.41 347.5 256.12C355.2 260.81 375.8 273.52 393.2 284.31C410.6 295.12 425.8 303.92 426.9 303.92C428 303.92 429.6 303.22 430.4 302.31C431.8 300.92 432 288.22 432 176.91C432 98.81 431.6 52.11 431 50.51C430.3 48.51 429.4 47.91 427.3 47.91C425.5 48.01 404.1 60.21 365 83.61Z',
      width: 432,
      height: 349.84,
      size: 14,
      cx: 1.7,
      cy: 1.4
    };
    const INK = { copied: 0.615, capturing: 0.705, percent: 0.6975, mark: 0.6525 };
    const SWAP_AT = 7.5;
    const POP_FROM = 0.9053;
    const POP_FOR = 22.84;
    const POP_EASE = S.Easing.bezier(0.3012, 1.056, 0.8028, 1.0);
    const TOAST_IN = -26;
    const PRESS_AT = -24;
    const COUNT_RATE = 3;
    const OUTRO_AT = 40;
    const OUTRO_DROP = 240;
    const OUTRO_SCALE = 1.3;
    const OUTRO_MID = REF_H / 2;

    const unit = (v: number) => Math.min(1, Math.max(0, v));
    const ease = (f: (x: number) => number, at: number, dur: number, n: number) => f(unit((n - at) / dur));
    const windowAt = (n: number) => {
      const k = ease(DROP_EASE, DROP_AT, DROP_FOR, n);
      const settle = n > SETTLE_AT ? SETTLE * (1 - Math.exp(-(n - SETTLE_AT) / SETTLE_TAU)) : 0;
      return { drop: DROP * k, scale: 1 - SHRINK * k - settle };
    };
    const cursorAt = (n: number) => {
      const k = ease(CURSOR_EASE, CURSOR_AT, CURSOR_FOR, n);
      const d = Math.max(0, n - DRIFT_AT);
      return [CURSOR_FROM[0] + CURSOR_BY[0] * k + DRIFT[0] * d, CURSOR_FROM[1] + CURSOR_BY[1] * k + DRIFT[1] * d];
    };
    const outroAt = (n: number) => ({ p: ease(DROP_EASE, OUTRO_AT, DROP_FOR, n), fade: n < OUTRO_AT ? 1 : 1 - ease(FADE_EASE, OUTRO_AT, FADE_FOR, n) });
    const headlineAt = (n: number) => ({ rise: RISE * (1 - ease(RISE_EASE, RISE_AT, RISE_FOR, n)), opacity: n < FADE_AT ? 0 : ease(FADE_EASE, FADE_AT, FADE_FOR, n) });
    const percentAt = (n: number) => Math.min(100, Math.floor(1 + COUNT_RATE * (n - TOAST_IN) + 1e-6));
    const toastAt = (n: number) => {
      if (n >= SWAP_AT) {
        return { copied: true, scale: POP_FROM + (1 - POP_FROM) * ease(POP_EASE, SWAP_AT, POP_FOR, n), opacity: 1 };
      }
      return { copied: false, scale: 1 - (1 - CAPTURING.scale) * ease(POP_EASE, PRESS_AT, POP_FOR, n), opacity: n < TOAST_IN ? 0 : ease(FADE_EASE, TOAST_IN, FADE_FOR, n) };
    };

    const { width, height } = view;
    const face = S.pick(p.fontFamily, 'DM Sans');
    const image = String(p.src || '');
    const capturing = String(p.capturing);
    const copied = String(p.copied);
    const u = Math.min(width / REF_W, height / REF_H);
    const left = (width - REF_W * u) / 2;
    const top = (height - REF_H * u) / 2;
    const dpr = view.root.ownerDocument.defaultView?.devicePixelRatio || 1;
    const box = { x: -left / u, y: -top / u, w: width / u, h: height / u };
    const muted = String(t.mutedForeground);
    const fg = String(t.foreground);
    const card = String(t.card);
    const inkCopied = S.mixOklch(fg, muted, INK.copied);
    const inkCapturing = S.mixOklch(fg, muted, INK.capturing);
    const inkPercent = S.mixOklch(muted, card, INK.percent);
    const inkMark = S.mixOklch(muted, card, INK.mark);
    const headType = { fontFamily: face, fontSize: HEAD.size, fontWeight: HEAD.weight, fontVariationSettings: `"opsz" ${HEAD.opsz}`, letterSpacing: HEAD.track, fill: S.mixOklch(fg, muted, HEAD.ink), textAnchor: 'middle', textRendering: 'geometricPrecision' };
    const toastType = { fontFamily: face, fontSize: TOAST.size, fontWeight: TOAST.weight, fontVariationSettings: `"opsz" ${TOAST.opsz}`, letterSpacing: TOAST.track, textRendering: 'geometricPrecision' };
    const lines = String(p.headline).split('|').map((l) => l.trim()).filter(Boolean);

    const cols: number[] = [];
    for (let x = GRID.x0 + Math.floor((box.x - GRID.x0) / GRID.dx) * GRID.dx; x < box.x + box.w; x += GRID.dx) {
      cols.push(x);
    }
    const rows: number[] = [];
    for (let y = GRID.y0 + Math.floor((box.y - GRID.y0) / GRID.dy) * GRID.dy; y < box.y + box.h; y += GRID.dy) {
      rows.push(y);
    }
    const lineX = S.mixOklch(String(t.background), fg, GRID.down);
    const lineY = S.mixOklch(String(t.background), fg, GRID.across);
    const grid = S.h('g', null, cols.map((x) => S.h('rect', { x: x - 0.5, y: box.y, width: 1, height: box.h, fill: lineX })), rows.map((y) => S.h('rect', { x: box.x, y: y - 0.5, width: box.w, height: 1, fill: lineY })));

    const probes = [capturing, copied, '100%'].map((s) => S.h('text', { x: 0, y: -1000, style: toastType }, s) as SVGTextElement);
    const probe = S.h('g', { visibility: 'hidden' }, probes);
    let aspect: number | null = null;
    if (image) {
      const img = new Image();
      img.onload = () => {
        aspect = img.naturalHeight / Math.max(1, img.naturalWidth);
      };
      img.src = image;
    }

    const defs = S.h(
      'defs',
      null,
      S.h('filter', { id: 'cr-win', x: '-50%', y: '-50%', width: '200%', height: '200%' }, S.h('feGaussianBlur', { stdDeviation: WIN_SHADOW.blur / 2 })),
      S.h('filter', { id: 'cr-toast', x: '-50%', y: '-100%', width: '200%', height: '300%' }, S.h('feGaussianBlur', { stdDeviation: TOAST.shadow.blur / 2 })),
      S.h('filter', { id: 'cr-arrow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, S.h('feDropShadow', { dx: ARROW_SHADOW.dx, dy: ARROW_SHADOW.dy, stdDeviation: ARROW_SHADOW.sigma, 'flood-color': '#000', 'flood-opacity': ARROW_SHADOW.alpha })),
      S.h('clipPath', { id: 'cr-clip' })
    );
    const live = S.h('g') as SVGGElement;
    const svg = S.h('svg', { width, height, viewBox: `${box.x} ${box.y} ${box.w} ${box.h}`, style: { position: 'absolute', top: 0, left: 0 } }, defs, grid, live, probe);
    view.root.replaceChildren(S.fill({ display: 'block', backgroundColor: String(t.background) }, svg));
    const clip = defs.querySelector('clipPath') as SVGClipPathElement;

    const line = (x: number, y: number, dev: { a: number; b: number }, style: Record<string, string | number>, text: string) => {
      const d = dev.a * y + dev.b;
      const lo = Math.floor(d);
      const f = d - lo;
      const at = (row: number) => (row + 1e-3 - dev.b) / dev.a;
      const copies = [[lo, 1 - f], [lo + 1, f]].filter(([, w]) => w >= 1e-3).map(([row, w]) => S.h('text', { x, y: at(row), style: { ...style, opacity: w, mixBlendMode: 'plus-lighter' } }, text));
      return S.h('g', { style: { isolation: 'isolate' } }, copies);
    };

    return (frame) => {
      const n = (frame / view.fps) * BEATS - REF_AT;
      const winH = WIN.w * (aspect ?? 1.25);
      clip.replaceChildren(S.h('rect', { x: WIN.x, y: WIN.y, width: WIN.w, height: winH, rx: WIN.r }));
      const win = windowAt(n);
      const [ox, oy] = WIN_ORIGIN;
      const out = outroAt(n);
      const winT = `translate(${ox} ${oy + win.drop + OUTRO_DROP * out.p}) scale(${win.scale}) translate(${-ox} ${-oy})`;

      const head = headlineAt(n);
      const toast = toastAt(n);
      const [wCapturing, wCopied, wFull] = probes.map((el) => el.getComputedTextLength());
      const capText = CAPTURING.text.x + wCapturing + CAPTURING.gap;
      const boxW = toast.copied ? COPIED.text.x + wCopied + COPIED.right : capText + wFull + CAPTURING.right;
      const [cx, cy] = toast.copied ? COPIED.at : CAPTURING.at;
      const boxL = cx - boxW / 2;
      const s = toast.scale;
      const toastDev = { a: dpr * u * s, b: dpr * (top + u * cy * (1 - s)) };
      const k = 1 + (OUTRO_SCALE - 1) * out.p;
      const m = HEAD.mid + (OUTRO_MID - HEAD.mid) * out.p;
      const headT = `translate(${HEAD.x} ${m}) scale(${k}) translate(${-HEAD.x} ${-HEAD.mid})`;
      const headDev = { a: dpr * u * k, b: dpr * (top + u * (m - k * HEAD.mid)) };
      const ts = TOAST.shadow;
      const [tx, ty] = cursorAt(n);
      const check = { x: boxL + COPIED.check.x, y: cy + COPIED.check.dy };

      const headline = head.opacity > 0 ? S.h('g', { opacity: head.opacity, transform: headT }, lines.map((l, i) => line(HEAD.x, HEAD.mid + (i - (lines.length - 1) / 2) * HEAD.pitch + head.rise, headDev, headType, l))) : null;
      const windowEl = S.h(
        'g',
        { transform: winT },
        S.h('rect', { x: WIN.x - WIN_SHADOW.spread, y: WIN.y + WIN_SHADOW.dy - WIN_SHADOW.spread, width: WIN.w + 2 * WIN_SHADOW.spread, height: winH + 2 * WIN_SHADOW.spread, rx: Math.max(0, WIN.r + WIN_SHADOW.spread), fill: '#000', opacity: WIN_SHADOW.alpha, filter: 'url(#cr-win)' }),
        S.h('g', { clipPath: 'url(#cr-clip)' }, S.h('rect', { x: WIN.x, y: WIN.y, width: WIN.w, height: winH, fill: card }), image ? S.h('image', { href: image, x: WIN.x, y: WIN.y, width: WIN.w, height: winH, preserveAspectRatio: 'xMidYMin slice' }) : null)
      );
      const markK = MARK.size / MARK.width;
      const markX = boxL + CAPTURING.icon.x + MARK.cx - MARK.size / 2;
      const markY = cy + CAPTURING.icon.dy + MARK.cy - (MARK.height * markK) / 2;
      const content = toast.copied
        ? [
            S.h('circle', { cx: check.x, cy: check.y, r: COPIED.check.r, fill: String(t.primary) }),
            S.h('polyline', { points: COPIED.tick.map(([a, b]) => `${check.x + a},${check.y + b}`).join(' '), fill: 'none', stroke: String(t.primaryForeground), strokeWidth: COPIED.check.stroke, strokeLinecap: 'round', strokeLinejoin: 'round' }),
            line(boxL + COPIED.text.x, cy + COPIED.text.base, toastDev, { ...toastType, fill: inkCopied }, copied)
          ]
        : [
            S.h('path', { d: MARK.path, fill: inkMark, transform: `translate(${markX} ${markY}) scale(${markK})` }),
            line(boxL + CAPTURING.text.x, cy + CAPTURING.text.base, toastDev, { ...toastType, fill: inkCapturing }, capturing),
            line(boxL + capText, cy + CAPTURING.percent.base, toastDev, { ...toastType, fill: inkPercent }, `${percentAt(n)}%`)
          ];
      const toastEl =
        toast.opacity * out.fade > 0
          ? S.h(
              'g',
              { opacity: toast.opacity * out.fade, transform: `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})` },
              S.h('rect', { x: cx - boxW / 2 - ts.spread, y: cy - TOAST.h / 2 + ts.dy - ts.spread, width: boxW + 2 * ts.spread, height: TOAST.h + 2 * ts.spread, rx: Math.max(0, TOAST.r + ts.spread), fill: '#000', opacity: ts.alpha, filter: 'url(#cr-toast)' }),
              S.h('rect', { x: cx - boxW / 2, y: cy - TOAST.h / 2, width: boxW, height: TOAST.h, rx: TOAST.r, fill: card }),
              content
            )
          : null;
      const cursor = S.h('polygon', { opacity: out.fade, points: ARROW.map(([a, b]) => `${tx + a},${ty + b}`).join(' '), fill: '#000000', stroke: '#ffffff', strokeWidth: 2 * ARROW_OUTLINE, strokeLinejoin: 'round', paintOrder: 'stroke', filter: 'url(#cr-arrow)' });
      live.replaceChildren(...[headline, windowEl, toastEl, cursor].filter((x): x is Element => Boolean(x)));
    };
  }
};

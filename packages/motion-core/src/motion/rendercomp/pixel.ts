import type { SnapcnKit } from '../snapcn/kit';
import type { SnapcnExtend } from '../snapcn/model';

export const pixelKit = ((S: SnapcnKit) => {
  const GLYPH_W = 5;
  const GLYPH_H = 7;
  const FALLBACK_GLYPH = '-';
  const BLANK_ROW = '00000';
  const LAYER_STYLE = { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' } as const;
  const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  const GLYPHS: Record<string, string[]> = {
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
    H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
    J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
    b: ['10000', '10000', '10110', '11001', '10001', '10001', '11110'],
    c: ['00000', '00000', '01110', '10000', '10000', '10001', '01110'],
    d: ['00001', '00001', '01101', '10011', '10001', '10001', '01111'],
    e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
    f: ['00110', '01001', '01000', '11100', '01000', '01000', '01000'],
    g: ['00000', '01111', '10001', '10001', '01111', '00001', '01110'],
    h: ['10000', '10000', '10110', '11001', '10001', '10001', '10001'],
    i: ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
    j: ['00010', '00000', '00110', '00010', '00010', '10010', '01100'],
    k: ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
    l: ['01100', '00100', '00100', '00100', '00100', '00100', '01110'],
    m: ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
    n: ['00000', '00000', '10110', '11001', '10001', '10001', '10001'],
    o: ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
    p: ['00000', '11110', '10001', '10001', '11110', '10000', '10000'],
    q: ['00000', '01111', '10001', '10001', '01111', '00001', '00001'],
    r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
    s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
    t: ['01000', '01000', '11100', '01000', '01000', '01001', '00110'],
    u: ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
    v: ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
    w: ['00000', '00000', '10001', '10001', '10101', '10101', '01010'],
    x: ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
    y: ['00000', '10001', '10001', '01111', '00001', '00010', '01100'],
    z: ['00000', '00000', '11111', '00010', '00100', '01000', '11111'],
    '0': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'],
    '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
    '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
    '"': ['01010', '01010', '10100', '00000', '00000', '00000', '00000'],
    ',': ['00000', '00000', '00000', '00000', '00100', '00100', '01000'],
    '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
    '?': ['01110', '10001', '00010', '00100', '00100', '00000', '00100'],
    '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
    ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
    '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
    '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
    '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
    '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
    ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
    '#': ['01010', '11111', '01010', '01010', '11111', '01010', '00000'],
    '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
    ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  };

  const glyphFor = (ch: string) => GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS[FALLBACK_GLYPH];

  const layoutText = (text: string) => {
    const cells: { x: number; y: number }[] = [];
    let cursor = 0;

    for (const ch of text) {
      const glyph = glyphFor(ch);

      for (let r = 0; r < GLYPH_H; r++) {
        const row = glyph[r] ?? BLANK_ROW;

        for (let c = 0; c < GLYPH_W; c++) {
          if (row[c] === '1') {
            cells.push({ x: cursor + c, y: r });
          }
        }
      }

      cursor += GLYPH_W + 1;
    }

    return { cells, cols: Math.max(0, cursor - 1) };
  };

  const measureText = (text: string) => (text.length === 0 ? 0 : text.length * (GLYPH_W + 1) - 1);

  const snap = (n: number) => Math.round(n);
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const lerpRGB = (a: number[], b: number[], t: number) => [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
  const rgb = (c: number[], a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

  const hexToRgb = (hex: string) => {
    const m = String(hex).replace('#', '');
    return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
  };

  const rgbToHex = (c: number[]) => `#${c.map((n) => ((v: number) => '0123456789abcdef'[(v >> 4) & 15] + '0123456789abcdef'[v & 15])(Math.max(0, Math.min(255, Math.round(n))))).join('')}`;

  const WATER_RAMP = [
    [10, 40, 90],
    [20, 90, 150],
    [40, 150, 200],
    [120, 210, 230],
    [200, 245, 250],
    [40, 150, 200]
  ];

  const cyclePalette = (frame: number, phase: number, speed: number, ramp: number[][]) => {
    const n = ramp.length;
    const pos = (((frame * speed + phase) % n) + n) % n;
    const i = Math.floor(pos);

    return lerpRGB(ramp[i % n], ramp[(i + 1) % n], pos - i);
  };

  const quantizeToCell = (v: number, cell: number) => Math.floor(v / cell) * cell;

  const seed = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const seed2 = (n: number) => {
    const x = Math.sin(n * 91.3 + 47.1) * 31873.7;
    return x - Math.floor(x);
  };

  const particleField = (o: { count: number; w: number; h: number; frame: number; speed?: number; swayAmp?: number; swaySpeed?: number; sizeMin?: number; sizeMax?: number; dir?: number; layerSeed?: number }) => {
    const { count, w, h, frame, speed = 2, swayAmp = 6, swaySpeed = 0.08, sizeMin = 1, sizeMax = 2, dir = 1, layerSeed = 0 } = o;
    const span = h + 20;
    const out: { x: number; y: number; size: number }[] = [];

    for (let i = 0; i < count; i++) {
      const s1 = seed(i * 2.3 + layerSeed);
      const s2 = seed2(i * 1.7 + layerSeed + 11);
      const vy = speed * (0.6 + s2 * 0.8);
      let y = (s2 * span + frame * vy * dir) % span;

      if (y < 0) {
        y += span;
      }

      const sway = Math.sin(frame * swaySpeed + s1 * 9) * swayAmp;
      out.push({ x: Math.round(s1 * w + sway), y: Math.round(dir === 1 ? y - 10 : h + 10 - y), size: Math.max(1, Math.round(sizeMin + s1 * (sizeMax - sizeMin))) });
    }

    return out;
  };

  const idlePulse = (frame: number, fps: number, bpm: number) => {
    const beatLen = (60 / bpm) * fps;
    const phase = frame % beatLen;
    const env = phase < 2 ? Math.max(0, (phase + 1) / 3) : Math.exp(-(phase - 2) / (beatLen * 0.45));

    return Math.min(1, env * 0.85 + 0.08 * (0.5 + 0.5 * Math.sin(frame * 0.3)));
  };

  const ditherPattern = () => {
    const dots: Element[] = [];

    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (BAYER4[y][x] < 6) {
          dots.push(S.h('rect', { x, y, width: 1, height: 1, fill: '#000' }));
        }
      }
    }

    return dots;
  };

  const pixelStage = (view: { root: HTMLElement; width: number; height: number }, o: { iw: number; ih: number; background: string; scanlines: number; vignette: number; dither: number }) => {
    const scale = Math.min(view.width / o.iw, view.height / o.ih);
    const canvas = S.h('canvas', { width: o.iw, height: o.ih, style: { ...LAYER_STYLE, width: o.iw, height: o.ih, imageRendering: 'pixelated' } }) as HTMLCanvasElement;
    const ditherLayer = S.h('svg', { width: o.iw, height: o.ih, viewBox: `0 0 ${o.iw} ${o.ih}`, style: { ...LAYER_STYLE, mixBlendMode: 'multiply', opacity: o.dither, imageRendering: 'pixelated', shapeRendering: 'crispEdges' } }, S.h('defs', null, S.h('pattern', { id: 'px-bayer4', width: 4, height: 4, patternUnits: 'userSpaceOnUse' }, ...ditherPattern())), S.h('rect', { x: 0, y: 0, width: o.iw, height: o.ih, fill: 'url(#px-bayer4)' }));
    const scene = S.h('div', { style: { ...LAYER_STYLE, left: (view.width - o.iw * scale) / 2, top: (view.height - o.ih * scale) / 2, width: o.iw, height: o.ih, transform: `scale(${scale})`, transformOrigin: 'top left' } }, canvas, ditherLayer);
    const scan = S.h('div', { style: { ...LAYER_STYLE, width: '100%', height: '100%', background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.32) 0px, rgba(0,0,0,0.32) 2px, transparent 2px, transparent 5px)', mixBlendMode: 'multiply', opacity: o.scanlines } });
    const vignette = S.h('div', { style: { ...LAYER_STYLE, width: '100%', height: '100%', background: `radial-gradient(ellipse 78% 72% at 50% 48%, transparent 52%, rgba(0,0,0,${o.vignette}) 100%)` } });
    view.root.replaceChildren(S.fill({ background: o.background, overflow: 'hidden' }, scene, scan, vignette));

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    const rect = (x: number, y: number, w: number, h: number, color: string, alpha = 1) => {
      if (w <= 0 || h <= 0) {
        return;
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };

    const outline = (x: number, y: number, w: number, h: number, color: string, sw = 1) => {
      rect(x, y, w, sw, color);
      rect(x, y + h - sw, w, sw, color);
      rect(x, y, sw, h, color);
      rect(x + w - sw, y, sw, h, color);
    };

    const text = (str: string, x: number, y: number, cell: number, color: string, align = 'left', alpha = 1) => {
      const w = measureText(str) * cell;
      const ox = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;

      for (const c of layoutText(str).cells) {
        rect(snap(ox + c.x * cell), snap(y + c.y * cell), cell, cell, color, alpha);
      }
    };

    let drawn = 0;

    const begin = () => {
      canvas.dataset.drawn = String(++drawn);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, o.iw, o.ih);
    };

    const setDither = (opacity: number) => {
      (ditherLayer as unknown as HTMLElement).style.opacity = String(opacity);
    };

    return { rect, outline, text, begin, setDither };
  };

  const skyBands = (px: { rect: (x: number, y: number, w: number, h: number, color: string) => void }, iw: number, horizon: number, top: number[], mid: number[], hz: number[], bands: number) => {
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const c = t < 0.6 ? lerpRGB(top, mid, t / 0.6) : lerpRGB(mid, hz, (t - 0.6) / 0.4);
      px.rect(0, Math.round((horizon * i) / bands), iw, Math.ceil(horizon / bands) + 1, rgb(c));
    }
  };

  return { GLYPH_W, GLYPH_H, glyphFor, layoutText, measureText, snap, clamp01, lerp, lerpRGB, rgb, hexToRgb, rgbToHex, WATER_RAMP, cyclePalette, quantizeToCell, seed, seed2, particleField, idlePulse, pixelStage, skyBands };
}) satisfies SnapcnExtend;

export type PixelKit = SnapcnKit & ReturnType<typeof pixelKit>;

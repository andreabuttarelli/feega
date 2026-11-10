import { PropFormat } from '../../custom/component';
import { SnapcnCategory, type SnapcnPort } from '../model';

export const PORT: SnapcnPort = {
  id: 'reel-collage',
  title: 'Reel collage',
  about: 'A photo reel between two captions shuts like an eyelid, the copy swaps, and a collage blooms in on a peach flush.',
  category: SnapcnCategory.Scene,
  width: 1280,
  height: 720,
  fps: 30,
  frames: 96,
  background: '#f5f4f2',
  fonts: ['Inter'],
  props: {
    topLine: { type: 'string', title: 'Caption above the reel', default: 'The videos', group: 'Content', maxLength: 60 },
    bottomLine: { type: 'string', title: 'Caption below the reel', default: 'That you ship', group: 'Content', maxLength: 60 },
    swapTop: { type: 'string', title: 'First line after the swap', default: 'Especially on', group: 'Content', maxLength: 60 },
    swapBottom: { type: 'string', title: 'Second line after the swap', default: 'Launch day', group: 'Content', maxLength: 60 },
    slides: { type: 'string', title: 'Images', format: PropFormat.Media, default: '', group: 'Content', maxLength: 2000 },
    collage: { type: 'string', title: 'Collage images and clips', format: PropFormat.Media, default: '', group: 'Content', maxLength: 2000 },
    glowColor: { type: 'string', title: 'Glow', format: PropFormat.Color, default: '#dfe7e3', group: 'Style' },
    flushColor: { type: 'string', title: 'Flush', format: PropFormat.Color, default: '#fdc7bc', group: 'Style' },
    textColor: { type: 'string', title: 'Caption colour (transparent = theme)', format: PropFormat.Color, default: 'transparent', group: 'Style' },
    fontFamily: { type: 'string', title: 'Font', format: PropFormat.Font, default: 'Inter', group: 'Style' },
    mode: { type: 'string', title: 'Theme', enum: ['light', 'dark'], default: 'light', group: 'Style' },
    speed: { type: 'number', title: 'Speed', default: 1, minimum: 0.25, maximum: 4, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const p = view.props;
    const t = S.themeOf(String(p.mode));
    const REF_W = 712;
    const FONT_SIZE = 19.22;
    const BOX_W = 282.08;
    const CAPTION_OPEN = { top: -110.07, bottom: 125.53 };
    const CAPTION_SHUT = { top: -5.44, bottom: 13.75 };
    const SWAP_DX = -1.9;
    const SWAP_REST = { top: { x: -71.0, y: -94.6 }, bottom: { x: 41.0, y: 104.6 } };
    const COLLAGE = [
      { x: -195.5, y: -38.5, w: 105, h: 117, from: 0.616 },
      { x: -66.5, y: -1, w: 141, h: 96, from: 0.425 },
      { x: 106.5, y: -91.5, w: 161, h: 107, from: 0.554 },
      { x: -153, y: 108, w: 150, h: 102, from: 0.644 },
      { x: 200, y: 97.5, w: 142, h: 97, from: 0.61 },
      { x: 81.5, y: 27.5, w: 139, h: 97, from: 0.601 }
    ];
    const GLOW = { dx: 10.9, dy: 6.4, hw: 261.6, hh: 147, r: 128.4, blur: 36.2 };
    const FLUSH = { dx: 4.4, dy: -4.2, hw: 301.8, hh: 151.5, r: 2, blur: 58.6 };
    const CUTS = [0, 3, 6, 10, 14, 19, 25, 29];
    const SHOTS = [
      { aspect: 1.505, k: 1.0004, dx: 0.47, dy: 0.1 },
      { aspect: 1.4788, k: 0.9982, dx: 0.78, dy: 0.09 },
      { aspect: 1.4832, k: 1.0038, dx: 1.67, dy: 1.16 },
      { aspect: 1.4561, k: 1.0009, dx: 1.59, dy: 0.93 },
      { aspect: 1.4573, k: 0.9999, dx: 1.8, dy: 0.84 },
      { aspect: 1.4505, k: 0.9988, dx: 1.92, dy: 1.3 },
      { aspect: 1.4465, k: 0.9984, dx: 1.8, dy: 1.14 },
      { aspect: 1.4465, k: 1, dx: 1.3, dy: -0.1 }
    ];
    const SWAP_AT = 46;
    const TILES = ['#d9d4cc', '#c9d3cf', '#e4cfc4', '#cfd2dc', '#dcd6c4', '#d4c9d6', '#c7d6d0', '#e0d0c8'];
    const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
    const seg = (f: number, range: number[], out: number[], b: number[]) => S.interpolate(f, range, out, { ...CLAMP, easing: S.Easing.bezier(b[0], b[1], b[2], b[3]) });
    const textZoom = (f: number) => seg(f, [7.59, 37], [1, 1.1741], [0.9062, 0.1924, 0.4104, 1.0142]);
    const boxZoom = (f: number) => seg(f, [0.42, 54.55], [1, 1.1852], [0.8548, 0.3903, 0.0817, 1.1691]);
    const reelOpen = (f: number) => seg(f, [18.71, 37.47], [1, 0], [0.8703, 0, 0.078, 1]);
    const captionsOpen = (f: number) => seg(f, [18.4, 38], [1, 0], [0.8766, 0, 0.0413, 1]);
    const splitTop = (f: number) => seg(f, [43.69, 69.24], [0, 1], [0.9243, 0.1575, 0.1018, 0.781]);
    const splitBottom = (f: number) => seg(f, [40.33, 69.32], [0, 1], [0.9897, 0, 0.1683, 0.7764]);
    const collagePan = (f: number) => seg(f, [46.66, 75.15], [57, 0], [0.8112, 0.3372, 0.0414, 0.6655]);
    const collageBloom = (f: number) => seg(f, [48.92, 73.18], [0, 1], [0.5174, -0.3347, 0.0854, 1]);
    const collageOpacity = (f: number, slot: number) => (slot === 4 ? S.interpolate(f, [50.74, 65.08], [0, 1], CLAMP) : S.interpolate(f, [50.14, 62.3], [0, 1], CLAMP));
    const flushOpacity = (f: number) => S.interpolate(f, [48, 56, 57.5, 73.5], [0, 1, 1, 0], CLAMP);
    const slideAt = (f: number) => CUTS.reduce((k, cut, i) => (f >= cut ? i : k), 0);

    const slides = S.media(p.slides);
    const collage = S.media(p.collage);
    const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(src);
    const clipStart = (src: string) => {
      const m = /#t=([\d.]+)/.exec(src);
      return m ? Number(m[1]) : 0;
    };
    const cover = { width: '100%', height: '100%', maxWidth: 'none', objectFit: 'cover', display: 'block' };
    const media = (src: string, tile: string, style: Record<string, string | number>) => {
      if (!src) {
        return { el: S.h('div', { style: { ...cover, ...style, background: tile } }) as HTMLElement, seek: () => undefined };
      }
      if (!isVideo(src)) {
        return { el: S.h('img', { src, style: { ...cover, ...style } }) as HTMLElement, seek: () => undefined };
      }
      const video = S.h('video', { src: src.replace(/#.*$/, ''), muted: true, playsinline: true, preload: 'auto', style: { ...cover, ...style } }) as HTMLVideoElement;
      return { el: video as HTMLElement, seek: (seconds: number) => { video.currentTime = Math.max(0, seconds) + clipStart(src); } };
    };

    const { width, height } = view;
    const tick = (Number(p.speed) * 30) / view.fps;
    const face = S.pick(p.fontFamily, 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
    const ink = S.pick(p.textColor, String(t.foreground));
    const u = width / REF_W;
    const cx = width / 2;
    const cy = height / 2;

    const blob = (g: typeof GLOW, color: string) => S.h('div', { style: { position: 'absolute', left: cx + (g.dx - g.hw) * u, top: cy + (g.dy - g.hh) * u, width: 2 * g.hw * u, height: 2 * g.hh * u, borderRadius: g.r * u, background: color, filter: `blur(${g.blur * u}px)` } }) as HTMLElement;
    const flushEl = blob(FLUSH, String(p.flushColor));
    const glowEl = blob(GLOW, String(p.glowColor));

    const reelBox = S.h('div', { style: { position: 'absolute', overflow: 'hidden' } }) as HTMLElement;
    const reelShots = CUTS.map((_, i) => media(slides.length ? slides[i % slides.length] : '', TILES[i % TILES.length], { position: 'absolute', left: 0 }));

    const cells = COLLAGE.map((c, slot) => {
      const m = media(collage.length ? collage[slot % collage.length] : '', TILES[(slot + 3) % TILES.length], {});
      const el = S.h('div', { style: { position: 'absolute', left: cx + (c.x - c.w / 2) * u, top: cy + (c.y - c.h / 2) * u, width: c.w * u, height: c.h * u } }, m.el) as HTMLElement;
      return { el, m };
    });

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const textOf = () => {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', '0');
      text.setAttribute('y', '0');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', ink);
      text.setAttribute('style', S.css({ fontSize: FONT_SIZE * u, fontWeight: 500, letterSpacing: '-0.068em', fontOpticalSizing: 'none', textRendering: 'geometricPrecision' }));
      const g = document.createElementNS(SVG_NS, 'g');
      g.appendChild(text);
      return { g, text };
    };
    const lineEls = [textOf(), textOf()];
    const svg = S.h('svg', { width, height, style: { position: 'absolute', top: 0, left: 0, overflow: 'visible' } }, lineEls.map((l) => l.g));

    view.root.replaceChildren(S.fill({ display: 'block', overflow: 'hidden', backgroundColor: String(p.background), fontFamily: face }, flushEl, glowEl, reelBox, cells.map((c) => c.el), svg));

    return (at) => {
      const frame = at * tick;
      const slide = slideAt(frame);
      const shot = SHOTS[slide] ?? SHOTS[0];
      const open = reelOpen(frame);
      const boxW = BOX_W * shot.k * boxZoom(frame) * u;
      const fullH = boxW / shot.aspect;
      const boxH = fullH * open;
      const reel = reelShots[slide];
      reelBox.style.display = boxH > 0.01 ? '' : 'none';
      Object.assign(reelBox.style, { left: `${cx + shot.dx * u - boxW / 2}px`, top: `${cy + shot.dy * u - boxH / 2}px`, width: `${boxW}px`, height: `${boxH}px` });
      Object.assign(reel.el.style, { top: `${(boxH - fullH) / 2}px`, height: `${fullH}px` });
      if (reelBox.firstChild !== reel.el) {
        reelBox.replaceChildren(reel.el);
      }

      const zoom = textZoom(frame);
      const apart = captionsOpen(frame);
      const baseline = (openY: number, shutY: number) => zoom * (openY * apart + shutY * (1 - apart));
      const swapped = frame >= SWAP_AT;
      const pTop = splitTop(frame);
      const pBottom = splitBottom(frame);
      const lines = [
        { text: swapped ? p.swapTop : p.topLine, x: (swapped ? SWAP_DX * (1 - pTop) : 0) + SWAP_REST.top.x * pTop, y: baseline(CAPTION_OPEN.top, CAPTION_SHUT.top) + (SWAP_REST.top.y - zoom * CAPTION_SHUT.top) * pTop },
        { text: swapped ? p.swapBottom : p.bottomLine, x: (swapped ? SWAP_DX * (1 - pBottom) : 0) + SWAP_REST.bottom.x * pBottom, y: baseline(CAPTION_OPEN.bottom, CAPTION_SHUT.bottom) + (SWAP_REST.bottom.y - zoom * CAPTION_SHUT.bottom) * pBottom }
      ];
      lines.forEach((l, i) => {
        lineEls[i].g.setAttribute('transform', `translate(${cx + l.x * u} ${cy + l.y * u}) scale(${zoom})`);
        lineEls[i].text.textContent = String(l.text);
      });

      const pan = collagePan(frame);
      const bloom = collageBloom(frame);
      const flush = flushOpacity(frame);
      flushEl.style.display = flush > 0 ? '' : 'none';
      flushEl.style.opacity = String(flush);
      cells.forEach(({ el, m }, slot) => {
        const c = COLLAGE[slot];
        const opacity = collageOpacity(frame, slot);
        el.style.display = opacity <= 0 ? 'none' : '';
        el.style.opacity = String(opacity);
        el.style.left = `${cx + (c.x + pan - c.w / 2) * u}px`;
        el.style.transform = `scale(${c.from + (1 - c.from) * bloom})`;
        m.seek((at - (slot === 4 ? 50.74 : 50.14) / tick) / view.fps);
      });
    };
  }
};

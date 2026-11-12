import { pixelKit, type PixelKit } from '../pixel';
import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'pixel-mosaic-transition',
  title: 'Pixel mosaic transition',
  about: 'A sunny day scene coarsens into giant blocks, swaps to a night scene at peak coarseness, and refines back into a crisp picture.',
  category: RendercompCategory.Transition,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 90,
  background: '#05060f',
  fonts: [],
  extend: pixelKit,
  props: {
    screenAColor: { type: 'string', title: 'Screen A sky', format: PropFormat.Color, default: '#ff8a3d', group: 'Style' },
    screenAAccent: { type: 'string', title: 'Screen A sun', format: PropFormat.Color, default: '#fff0c2', group: 'Style' },
    screenBColor: { type: 'string', title: 'Screen B sky', format: PropFormat.Color, default: '#1b2b66', group: 'Style' },
    screenBAccent: { type: 'string', title: 'Screen B moon', format: PropFormat.Color, default: '#cfe0ff', group: 'Style' },
    ditherOpacity: { type: 'number', title: 'Dither strength', default: 0.08, minimum: 0, maximum: 0.5, step: 0.01, group: 'Style' },
    maxCell: { type: 'number', title: 'Coarsest block (px)', default: 48, minimum: 2, maximum: 120, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const K = S as PixelKit;
    const p = view.props;
    const IW = 480;
    const IH = 270;
    const DURATION = 90;
    const MID = DURATION / 2;
    const maxCell = Number(p.maxCell);
    const ditherOpacity = Number(p.ditherOpacity);
    const aP = K.hexToRgb(String(p.screenAColor));
    const aA = K.hexToRgb(String(p.screenAAccent));
    const bP = K.hexToRgb(String(p.screenBColor));
    const bA = K.hexToRgb(String(p.screenBAccent));
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const px = K.pixelStage(view, { iw: IW, ih: IH, background: String(p.background), scanlines: 0.32, vignette: 0.72, dither: ditherOpacity });

    const sceneField = (isDay: boolean, x: number, y: number, primary: number[], accent: number[]) => {
      const cx = IW * (isDay ? 0.5 : 0.62);
      const cy = isDay ? IH * 0.34 : IH * 0.3;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (isDay) {
        const groundY = IH * 0.72;

        if (y >= groundY) {
          const t = (y - groundY) / (IH - groundY);
          return K.lerpRGB(K.lerpRGB(primary, [120, 50, 20], 0.55), [30, 14, 8], t * 0.7);
        }

        const sky = K.lerpRGB(K.lerpRGB(primary, [60, 30, 80], 0.5), primary, y / groundY);
        const sunR = IW * 0.11;

        if (dist < sunR) {
          return accent;
        }

        return K.lerpRGB(sky, accent, Math.max(0, 1 - (dist - sunR) / (sunR * 1.6)) * 0.7);
      }

      const sky = K.lerpRGB(K.lerpRGB([6, 8, 26], primary, 0.85), K.lerpRGB(primary, [8, 12, 36], 0.4), y / IH);
      const moonR = IW * 0.095;
      const sdx = x - (cx + moonR * 0.55);
      const sdy = y - (cy - moonR * 0.12);

      if (dist < moonR) {
        return Math.sqrt(sdx * sdx + sdy * sdy) < moonR * 0.92 ? sky : accent;
      }

      let col = K.lerpRGB(sky, accent, Math.max(0, 1 - (dist - moonR) / (moonR * 1.3)) * 0.45);
      const gx = Math.floor(x / 7);
      const gy = Math.floor(y / 7);
      const h = Math.abs(Math.sin(gx * 91.7 + gy * 47.3) * 4391.13) % 1;

      if (h > 0.965 && y < IH * 0.78) {
        col = K.lerpRGB(col, [240, 245, 255], 0.85);
      }

      return col;
    };

    return (frame) => {
      px.begin();

      const coarseT = 1 - Math.abs(frame - MID) / MID;
      const cell = Math.max(1, K.snap(1 + easeInOut(K.clamp01(coarseT)) * (maxCell - 1)));
      const isDay = frame < MID;
      const primary = isDay ? aP : bP;
      const accent = isDay ? aA : bA;

      px.rect(0, 0, IW, IH, K.rgb(K.lerpRGB(primary, [0, 0, 0], 0.5)));

      for (let by = 0; by < IH; by += cell) {
        const sy = Math.min(IH - 1, K.quantizeToCell(by + cell / 2, cell) + Math.floor(cell / 2));
        const h = Math.min(cell, IH - by);

        for (let bx = 0; bx < IW; bx += cell) {
          const sx = Math.min(IW - 1, K.quantizeToCell(bx + cell / 2, cell) + Math.floor(cell / 2));
          px.rect(bx, by, Math.min(cell, IW - bx), h, K.rgb(sceneField(isDay, sx, sy, primary, accent)));
        }
      }

      const seamA = coarseT > 0.25 ? ((coarseT - 0.25) / 0.75) * 0.22 : 0;

      if (seamA > 0.01 && cell >= 6) {
        for (let gx = cell; gx < IW; gx += cell) {
          px.rect(gx, 0, 1, IH, K.rgb([0, 0, 0], seamA));
        }

        for (let gy = cell; gy < IH; gy += cell) {
          px.rect(0, gy, IW, 1, K.rgb([0, 0, 0], seamA));
        }
      }

      const swapDist = Math.abs(frame - MID);

      if (swapDist <= 4) {
        px.rect(0, 0, IW, IH, K.rgb([255, 255, 255], (1 - swapDist / 4) * 0.35));
      }

      px.setDither(K.lerp(ditherOpacity, ditherOpacity * 0.4, coarseT));
    };
  }
};

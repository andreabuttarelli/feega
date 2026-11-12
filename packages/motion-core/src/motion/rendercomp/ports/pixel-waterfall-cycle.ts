import { pixelKit, type PixelKit } from '../pixel';
import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'pixel-waterfall-cycle',
  title: 'Pixel waterfall cycle',
  about: 'A pixel-art waterfall between two cliffs flows endlessly through colour cycling, with foam spraying at the pool and mist drifting up.',
  category: RendercompCategory.Loop,
  width: 1080,
  height: 1920,
  fps: 30,
  frames: 180,
  background: '#0a1430',
  fonts: [],
  extend: pixelKit,
  props: {
    accentColor: { type: 'string', title: 'Foam colour', format: PropFormat.Color, default: '#e6fbff', group: 'Style' },
    cliffColor: { type: 'string', title: 'Cliff colour', format: PropFormat.Color, default: '#1a2238', group: 'Style' },
    showMist: { type: 'boolean', title: 'Mist', default: true, group: 'Style' },
    cycleSpeed: { type: 'number', title: 'Flow speed', default: 0.2, minimum: 0, maximum: 1, step: 0.05, group: 'Motion' }
  },
  draw: (S, view) => {
    const K = S as PixelKit;
    const p = view.props;
    const IW = 360;
    const IH = 640;
    const HORIZON = Math.round(IH * 0.18);
    const WATER_X0 = 118;
    const WATER_W = 242 - WATER_X0;
    const POOL_Y = IH - 96;
    const cycleSpeed = Number(p.cycleSpeed);
    const showMist = Boolean(p.showMist);
    const skyTop = K.hexToRgb(String(p.background));
    const cliff = K.hexToRgb(String(p.cliffColor));
    const foam = K.hexToRgb(String(p.accentColor));
    const px = K.pixelStage(view, { iw: IW, ih: IH, background: String(p.background), scanlines: 0.4, vignette: 0.7, dither: 0.07 });

    const drawCliff = (isLeft: boolean) => {
      for (let y = HORIZON; y < IH; y += 6) {
        const t = (y - HORIZON) / (IH - HORIZON);
        const w = K.snap(90 + t * 40 + K.seed(y * 0.7 + (isLeft ? 0 : 99)) * 24);
        const x = isLeft ? 0 : IW - w;
        px.rect(x, y, w, 6, K.rgb(K.lerpRGB(cliff, [4, 6, 14], 0.2 + t * 0.4)));

        if (K.seed(y * 1.3 + (isLeft ? 5 : 7)) > 0.6) {
          px.rect(isLeft ? x + w - 2 : x, y, 2, 4, K.rgb([40, 90, 70], 0.7));
        }
      }
    };

    return (frame) => {
      px.begin();

      K.skyBands(px, IW, HORIZON + 6, skyTop, K.lerpRGB(skyTop, [60, 90, 130], 0.5), [120, 170, 200], 10);

      for (let y = HORIZON + 6; y < POOL_Y; y += 3) {
        px.rect(WATER_X0, y, WATER_W, 3, K.rgb(K.cyclePalette(frame, y * 0.16, cycleSpeed * 0.06, K.WATER_RAMP)));
      }

      for (let i = 0; i < 7; i++) {
        const sx = K.snap(WATER_X0 + 8 + (i * (WATER_W - 16)) / 6 + K.seed(i) * 4);

        for (let y = HORIZON + 6; y < POOL_Y; y += 4) {
          const tw = 0.4 + 0.6 * Math.sin(y * 0.4 + frame * 0.5 + i);
          px.rect(sx, y, 2, 3, K.rgb(foam, 0.18 + tw * 0.22));
        }
      }

      drawCliff(true);
      drawCliff(false);

      const pool = K.cyclePalette(frame, POOL_Y * 0.16, cycleSpeed * 0.06, K.WATER_RAMP);
      px.rect(0, POOL_Y, IW, IH - POOL_Y, K.rgb(K.lerpRGB(pool, [6, 16, 36], 0.4)));

      for (let i = 0; i < 8; i++) {
        const y = POOL_Y + i * 4;
        px.rect(0, y, IW, 4, K.rgb(K.cyclePalette(frame, y * 0.2, cycleSpeed * 0.05, K.WATER_RAMP), 0.5));
      }

      const spray = K.particleField({ count: 46, w: WATER_W, h: 70, frame, speed: 1.6, swayAmp: 5, swaySpeed: 0.12, dir: -1, layerSeed: 3 });

      for (const s of spray) {
        px.rect(WATER_X0 + s.x, POOL_Y - 10 + s.y, s.size, s.size, K.rgb(foam, 0.5));
      }

      if (!showMist) {
        return;
      }

      const mist = K.particleField({ count: 30, w: IW, h: 120, frame, speed: 0.5, swayAmp: 10, swaySpeed: 0.05, sizeMin: 2, sizeMax: 4, dir: -1, layerSeed: 9 });

      for (const m of mist) {
        px.rect(m.x, POOL_Y - 60 + m.y, m.size, m.size, K.rgb([210, 230, 240], 0.1));
      }
    };
  }
};

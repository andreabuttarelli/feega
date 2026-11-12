import { pixelKit, type PixelKit } from '../pixel';
import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'pourover-drip-fill-gauge',
  title: 'Pour-over fill gauge',
  about: 'Water drips through a pixel pour-over filter into a carafe whose liquid level and percentage readout rise together from 0 to 100.',
  category: RendercompCategory.Chart,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 180,
  background: '#1c1206',
  fonts: [],
  extend: pixelKit,
  props: {
    toneBg: { type: 'string', title: 'Tone darkest', format: PropFormat.Color, default: '#1c1206', group: 'Style' },
    toneDark: { type: 'string', title: 'Tone dark', format: PropFormat.Color, default: '#6b4410', group: 'Style' },
    toneMid: { type: 'string', title: 'Tone mid', format: PropFormat.Color, default: '#c88a1e', group: 'Style' },
    toneLight: { type: 'string', title: 'Tone light', format: PropFormat.Color, default: '#f6d27a', group: 'Style' },
    showDrips: { type: 'boolean', title: 'Drips', default: true, group: 'Style' },
    fillSpeed: { type: 'number', title: 'Time spent filling', default: 0.78, minimum: 0.1, maximum: 1, step: 0.01, group: 'Motion' }
  },
  draw: (S, view) => {
    const K = S as PixelKit;
    const p = view.props;
    const IW = 480;
    const IH = 270;
    const DURATION = 180;
    const FPS = 30;
    const BPM = 96;
    const WHITE = [255, 255, 255];
    const BLACK = [0, 0, 0];
    const cx = IW / 2;
    const dripTopY = 30;
    const coneTopY = 64;
    const coneBotY = 110;
    const coneHalfTop = 56;
    const carTop = 122;
    const carBot = 214;
    const carHalfTop = 38;
    const carHalfBot = 54;
    const carH = carBot - carTop;
    const gaugeBarX = 300;
    const gaugeBarY = 236;
    const gaugeBarW = 150;
    const gaugeBarH = 8;
    const showDrips = Boolean(p.showDrips);
    const riseFrames = Math.max(1, Math.round(DURATION * Number(p.fillSpeed)));
    const RAMP4 = [K.hexToRgb(String(p.toneBg)), K.hexToRgb(String(p.toneDark)), K.hexToRgb(String(p.toneMid)), K.hexToRgb(String(p.toneLight))];
    const [cBg, cDark, cMid, cLight] = RAMP4;
    const px = K.pixelStage(view, { iw: IW, ih: IH, background: String(p.background), scanlines: 0.42, vignette: 0.75, dither: 0.08 });
    const halfAt = (y: number) => carHalfTop + (carHalfBot - carHalfTop) * ((y - carTop) / carH);

    const quantize4 = (c: number[]) => {
      let best = RAMP4[0];
      let bestD = Infinity;

      for (const r of RAMP4) {
        const d = (c[0] - r[0]) ** 2 + (c[1] - r[1]) ** 2 + (c[2] - r[2]) ** 2;

        if (d < bestD) {
          bestD = d;
          best = r;
        }
      }

      return best;
    };

    return (frame) => {
      px.begin();

      const t = Math.min(1, frame / riseFrames);
      const progress = t * t * (3 - 2 * t);
      const pct = Math.round(progress * 100);
      const pulse = K.idlePulse(frame, FPS, BPM);
      const liqY = K.snap(carBot - carH * progress);
      const fillW = K.snap(gaugeBarW * progress);

      px.rect(0, 0, IW, IH, K.rgb(cBg));
      px.rect(0, IH - 30, IW, 30, K.rgb(K.lerpRGB(cBg, cDark, 0.35)));
      px.rect(K.snap(cx - 70), carBot + 2, 140, 5, K.rgb(K.lerpRGB(cBg, BLACK, 0.4), 0.6));

      px.rect(K.snap(cx - 16), dripTopY - 18, 32, 16, K.rgb(cDark));
      px.rect(K.snap(cx - 16), dripTopY - 18, 32, 3, K.rgb(cMid));
      px.rect(K.snap(cx + 16), dripTopY - 14, 8, 3, K.rgb(cDark));
      px.rect(K.snap(cx - 4), dripTopY - 2, 8, 4, K.rgb(cMid));

      if (showDrips) {
        const drips = K.particleField({ count: 7, w: 14, h: coneTopY - dripTopY + 6, frame, speed: 3.2, swayAmp: 1, swaySpeed: 0.1, sizeMin: 1, sizeMax: 2, dir: 1, layerSeed: 4 });

        for (const d of drips) {
          px.rect(K.snap(cx - 1 + (d.x - 7)), K.snap(dripTopY + d.y), 1, d.size + 1, K.rgb(cMid, 0.85));
        }
      }

      for (let i = 0; i < Math.ceil((coneBotY - coneTopY) / 2); i++) {
        const y = coneTopY + i * 2;
        const tt = (y - coneTopY) / (coneBotY - coneTopY);
        const hw = K.snap(coneHalfTop * (1 - tt) + 6 * tt);
        const wall = K.rgb(i % 3 === 0 ? cMid : cDark);
        px.rect(K.snap(cx - hw), y, 2, 2, wall);
        px.rect(K.snap(cx + hw - 2), y, 2, 2, wall);
        px.rect(K.snap(cx - hw + 2), y, hw * 2 - 4, 2, K.rgb(K.lerpRGB(cBg, cDark, 0.55), 0.5));
      }

      px.rect(K.snap(cx - coneHalfTop), coneTopY - 2, coneHalfTop * 2, 2, K.rgb(cLight));
      px.rect(K.snap(cx - 1), coneBotY, 2, carTop - coneBotY + 2, K.rgb(cMid, 0.7 + pulse * 0.3));
      px.outline(K.snap(cx - 14) - 1, carTop - 8 - 1, 30, 10, K.rgb(cDark), 2);

      for (let y = Math.max(carTop, liqY); y < carBot; y += 2) {
        const hw = K.snap(halfAt(y)) - 4;
        const band = ((y - liqY) >> 1) % 5 === 0 ? K.lerpRGB(cMid, cLight, 0.4) : cMid;
        px.rect(K.snap(cx - hw), y, hw * 2, 2, K.rgb(quantize4(band)));
      }

      if (progress > 0.01) {
        const slosh = K.snap(Math.sin(frame * 0.18) * (0.6 + pulse));
        const hw = K.snap(halfAt(liqY)) - 3;
        px.rect(K.snap(cx - hw), K.snap(liqY + slosh), hw * 2, 2, K.rgb(cLight, 0.9));
      }

      for (let y = carTop; y <= carBot; y += 2) {
        const hw = K.snap(halfAt(y));
        px.rect(K.snap(cx - hw), y, 2, 2, K.rgb(cDark));
        px.rect(K.snap(cx + hw - 2), y, 2, 2, K.rgb(cDark));

        if (((y - carTop) >> 1) % 3 === 0) {
          px.rect(K.snap(cx - hw + 3), y, 1, 2, K.rgb(cMid, 0.4));
        }
      }

      px.rect(K.snap(cx - carHalfBot), carBot, carHalfBot * 2, 3, K.rgb(cDark));

      px.text(`${pct}%`, 18, IH - 40, 4, K.rgb(K.lerpRGB(cLight, WHITE, Math.min(0.5, pulse * 0.5))), 'left');
      px.text('VOLUME', 18, IH - 52, 1, K.rgb(cMid), 'left');

      px.outline(gaugeBarX, gaugeBarY, gaugeBarW, gaugeBarH, K.rgb(cDark));
      px.rect(gaugeBarX + 1, gaugeBarY + 1, Math.max(0, fillW - 2), gaugeBarH - 2, K.rgb(cMid));

      for (const tick of [0.25, 0.5, 0.75]) {
        px.rect(K.snap(gaugeBarX + gaugeBarW * tick), gaugeBarY - 2, 1, 2, K.rgb(cLight, 0.7));
      }

      px.text('FULL', gaugeBarX + gaugeBarW, gaugeBarY - 11, 1, K.rgb(cMid), 'right');
    };
  }
};

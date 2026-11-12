import { pixelKit, type PixelKit } from '../pixel';
import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'four-tone-mono-titler',
  title: 'Four-tone mono titler',
  about: 'A handheld four-tone lower third wipes in left to right over a dithered shading band, then a bright shimmer sweeps across the pixel title. Pixel title look.',
  category: RendercompCategory.Text,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 120,
  background: '#0f380f',
  fonts: [],
  extend: pixelKit,
  props: {
    title: { type: 'string', title: 'Title', default: 'LANTERN HOLLOW', group: 'Content', maxLength: 30 },
    subtitle: { type: 'string', title: 'Subtitle', default: 'STAGE 01 - THE QUIET MARSH', group: 'Content', maxLength: 60 },
    tone0: { type: 'string', title: 'Tone 0 (darkest)', format: PropFormat.Color, default: '#0f380f', group: 'Style' },
    tone1: { type: 'string', title: 'Tone 1', format: PropFormat.Color, default: '#306230', group: 'Style' },
    tone2: { type: 'string', title: 'Tone 2', format: PropFormat.Color, default: '#8bac0f', group: 'Style' },
    tone3: { type: 'string', title: 'Tone 3 (brightest)', format: PropFormat.Color, default: '#9bbc0f', group: 'Style' },
    titleCell: { type: 'number', title: 'Title dot size', default: 4, minimum: 1, maximum: 8, step: 1, group: 'Style' },
    subtitleCell: { type: 'number', title: 'Subtitle dot size', default: 2, minimum: 1, maximum: 6, step: 1, group: 'Style' },
    ditherDensity: { type: 'number', title: 'Dither density', default: 0.6, minimum: 0, maximum: 1, step: 0.05, group: 'Style' },
    showAmbient: { type: 'boolean', title: 'Ambient glow and dust', default: true, group: 'Style' },
    wipeFrames: { type: 'number', title: 'Wipe (frames)', default: 72, minimum: 1, maximum: 120, step: 1, group: 'Motion' },
    shimmerSpeed: { type: 'number', title: 'Shimmer speed', default: 3.2, minimum: 0, maximum: 12, step: 0.1, group: 'Motion' }
  },
  draw: (S, view) => {
    const K = S as PixelKit;
    const p = view.props;
    const IW = 480;
    const IH = 270;
    const PANEL_TOP = 170;
    const PANEL_BOT = 248;
    const SHADE_Y0 = 171;
    const SHADE_H = 40;
    const KICKER_X = 40;
    const TITLE_X0 = 56;
    const TITLE_Y0 = 178;
    const DIVIDER_Y = 210;
    const SUB_X0 = 58;
    const SUB_Y0 = 218;
    const DUST_COUNT = 46;
    const SHIMMER_HALF = 9;
    const BAYER4 = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ];
    const ditherOn = (cx: number, ry: number, coverage: number) => coverage > (BAYER4[ry & 3][cx & 3] + 0.5) / 16;
    const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const title = String(p.title);
    const subtitle = String(p.subtitle);
    const titleCell = Number(p.titleCell);
    const subtitleCell = Number(p.subtitleCell);
    const wipeN = Math.max(1, Number(p.wipeFrames));
    const shimmerSpeed = Number(p.shimmerSpeed);
    const ditherDensity = Number(p.ditherDensity);
    const showAmbient = Boolean(p.showAmbient);
    const c0 = K.rgb(K.hexToRgb(String(p.tone0)));
    const c1 = K.rgb(K.hexToRgb(String(p.tone1)));
    const c2 = K.rgb(K.hexToRgb(String(p.tone2)));
    const c3 = K.rgb(K.hexToRgb(String(p.tone3)));
    const titleCells = K.layoutText(title).cells;
    const subtitleCells = K.layoutText(subtitle).cells;
    const sweepSpan = K.measureText(title) * titleCell + 64;
    const px = K.pixelStage(view, { iw: IW, ih: IH, background: String(p.background), scanlines: 0, vignette: 0, dither: 0 });

    return (frame) => {
      px.begin();

      const edge = easeInOutCubic(K.clamp01(frame / wipeN)) * IW;
      const shimmerX = TITLE_X0 - 24 + ((frame * shimmerSpeed) % sweepSpan);

      px.rect(0, 0, IW, IH, c0);

      if (showAmbient) {
        const gcell = 4;
        const gCols = Math.floor(IW / gcell);
        const gRows = Math.floor((PANEL_TOP - 6) / gcell);
        const breathe = 0.5 + 0.5 * Math.sin(frame * 0.03);

        for (let ry = 0; ry < gRows; ry++) {
          const py = ry * gcell;
          let run = -1;

          for (let cx = 0; cx <= gCols; cx++) {
            const dx = (cx * gcell - IW * 0.5) / (IW * 0.5);
            const dy = py / (PANEL_TOP - 6);
            const rad = 1 - Math.min(1, Math.sqrt(dx * dx * 0.55 + dy * dy));
            const on = cx < gCols && ditherOn(cx, ry, K.clamp01(0.32 * rad * (0.7 + 0.5 * breathe)));

            if (on && run < 0) {
              run = cx;
            }

            if ((!on || cx === gCols) && run >= 0) {
              px.rect(run * gcell, py, (cx - run) * gcell, gcell, c1);
              run = -1;
            }
          }
        }

        px.rect(0, 24, IW, 1, c1);

        for (let i = 0; i < DUST_COUNT; i++) {
          const x = K.snap(K.seed(i * 2.7 + 3) * IW);
          const y = K.snap(K.seed2(i * 1.9 + 5) * (PANEL_TOP - 30)) + 8;
          const tw = Math.sin(frame * 0.08 + K.seed(i * 5.1) * 6.283);
          const sz = K.seed(i * 3.3 + 1) > 0.86 ? 2 : 1;
          px.rect(x, y, sz, sz, tw > 0.55 ? c2 : c1);
        }
      }

      const clipW = Math.min(IW, Math.max(0, edge));
      px.rect(0, PANEL_TOP, clipW, PANEL_BOT - PANEL_TOP, c0);

      const dcell = 3;
      const cols = Math.floor(IW / dcell);
      const rows = Math.floor(SHADE_H / dcell);
      const base = 0.18 + ditherDensity * 0.55;

      for (let ry = 0; ry < rows; ry++) {
        const py = SHADE_Y0 + ry * dcell;
        const vfall = 1 - ry / rows;
        let run = -1;

        for (let cx = 0; cx <= cols; cx++) {
          const pxx = cx * dcell;
          const along = 0.5 + 0.5 * Math.sin(pxx * 0.045 + frame * 0.05);
          const cov = K.clamp01(base * (0.45 + 0.85 * vfall) * (0.65 + 0.5 * along));
          const beyond = cx === cols || pxx >= edge;
          const on = !beyond && ditherOn(cx, ry, cov);

          if (on && run < 0) {
            run = cx;
          }

          if (!on && run >= 0) {
            px.rect(run * dcell, py, (cx - run) * dcell, dcell, c1);
            run = -1;
          }

          if (beyond) {
            break;
          }
        }
      }

      if (KICKER_X < edge) {
        px.rect(KICKER_X, TITLE_Y0 - 2, 7, 30, c3);
      }

      px.rect(0, PANEL_TOP, clipW, 2, c2);
      px.rect(0, PANEL_TOP + 2, clipW, 1, c3);
      px.rect(0, PANEL_BOT - 2, clipW, 2, c2);

      const dvW = Math.min(clipW - SUB_X0, 210);

      if (dvW > 0) {
        px.rect(SUB_X0, DIVIDER_Y, dvW, 1, c1);
      }

      for (const cell of titleCells) {
        const cx = TITLE_X0 + cell.x * titleCell;

        if (cx >= edge) {
          continue;
        }

        const lit = Math.abs(cx + titleCell / 2 - shimmerX) < SHIMMER_HALF;
        px.rect(K.snap(cx), K.snap(TITLE_Y0 + cell.y * titleCell), titleCell, titleCell, lit ? c3 : c2);
      }

      for (const cell of subtitleCells) {
        const cx = SUB_X0 + cell.x * subtitleCell;

        if (cx >= edge) {
          continue;
        }

        px.rect(K.snap(cx), K.snap(SUB_Y0 + cell.y * subtitleCell), subtitleCell, subtitleCell, c2);
      }

      if (edge < IW - 0.5 && edge > 1) {
        const hx = K.snap(Math.min(IW - 2, edge));
        px.rect(hx, PANEL_TOP, 2, PANEL_BOT - PANEL_TOP, c3);
        px.rect(Math.max(0, hx - 3), PANEL_TOP, 2, PANEL_BOT - PANEL_TOP, c2);
      }
    };
  }
};

import { pixelKit, type PixelKit } from '../pixel';
import { PropFormat } from '../../custom/component';
import { RendercompCategory, type RendercompPort } from '../model';

export const PORT: RendercompPort = {
  id: 'pixel-candlestick-ohlc',
  title: 'Pixel candlestick chart',
  about: 'An 8-bit candlestick chart pops up one candle at a time while the headline price ticks along the newest close.',
  category: RendercompCategory.Chart,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: 180,
  background: '#0a0f1e',
  fonts: [],
  extend: pixelKit,
  props: {
    symbol: { type: 'string', title: 'Symbol', default: 'BTC/USD', group: 'Content', maxLength: 16 },
    gridColor: { type: 'string', title: 'Grid colour', format: PropFormat.Color, default: '#1b2942', group: 'Style' },
    bullColor: { type: 'string', title: 'Bull colour', format: PropFormat.Color, default: '#2ee06a', group: 'Style' },
    bearColor: { type: 'string', title: 'Bear colour', format: PropFormat.Color, default: '#ff4d5e', group: 'Style' },
    accentColor: { type: 'string', title: 'Accent colour', format: PropFormat.Color, default: '#7fe9ff', group: 'Style' },
    candleCount: { type: 'number', title: 'Candles', default: 24, minimum: 4, maximum: 40, step: 1, group: 'Content' },
    volatility: { type: 'number', title: 'Volatility', default: 0.5, minimum: 0, maximum: 1, step: 0.05, group: 'Content' },
    cycleSpeed: { type: 'number', title: 'Colour cycle speed', default: 6, minimum: 0, maximum: 24, step: 1, group: 'Motion' }
  },
  draw: (S, view) => {
    const K = S as PixelKit;
    const p = view.props;
    const IW = 480;
    const IH = 270;
    const DURATION = 180;
    const PLOT_X0 = 30;
    const PLOT_X1 = 462;
    const PLOT_Y0 = 52;
    const PLOT_Y1 = 232;
    const PLOT_W = PLOT_X1 - PLOT_X0;
    const PLOT_H = PLOT_Y1 - PLOT_Y0;
    const PRICE_BASE = 20000;
    const PRICE_SPAN = 60000;
    const ROWS = 5;
    const WHITE = [255, 255, 255];
    const BLACK = [0, 0, 0];
    const WARM_WHITE = [255, 220, 220];
    const volatility = Number(p.volatility);
    const cycleSpeed = Number(p.cycleSpeed);
    const grid = K.hexToRgb(String(p.gridColor));
    const bull = K.hexToRgb(String(p.bullColor));
    const bear = K.hexToRgb(String(p.bearColor));
    const accent = K.hexToRgb(String(p.accentColor));
    const bgRgb = K.hexToRgb(String(p.background));
    const ticker = String(p.symbol).toUpperCase();
    const n = Math.max(4, Math.min(40, Math.round(Number(p.candleCount))));
    const colW = PLOT_W / n;
    const bodyW = Math.max(3, K.snap(colW * 0.62));
    const perCandle = (DURATION * 0.74) / n;
    const priceToY = (price: number) => K.quantizeToCell(K.snap(PLOT_Y1 - price * PLOT_H), 3);
    const px = K.pixelStage(view, { iw: IW, ih: IH, background: String(p.background), scanlines: 0.35, vignette: 0.7, dither: 0.06 });

    const series: { o: number; h: number; l: number; c: number }[] = [];
    const amp = 0.05 + volatility * 0.09;
    let price = 0.5;

    for (let i = 0; i < n; i++) {
      const o = price;
      const step = ((K.seed(i * 2.3 + 1.7) * 2 - 1) * 0.7 + Math.sin(i * 0.55) * 0.35) * amp;
      let c = o + step;

      if (c < 0.06) {
        c = 0.06 + (0.06 - c) * 0.5;
      }

      if (c > 0.94) {
        c = 0.94 - (c - 0.94) * 0.5;
      }

      const span = Math.max(0.012, Math.abs(c - o));
      const hi = Math.max(o, c) + span * (0.25 + K.seed(i * 3.1 + 5.0) * 0.9) + amp * 0.15;
      const lo = Math.min(o, c) - span * (0.25 + K.seed(i * 1.9 + 9.0) * 0.9) - amp * 0.15;
      series.push({ o, c, h: Math.min(0.99, hi), l: Math.max(0.01, lo) });
      price = c;
    }

    const rampOf = (base: number[], light: number[]) => [base, K.lerpRGB(base, light, 0.22), base, K.lerpRGB(base, BLACK, 0.15), base, K.lerpRGB(base, light, 0.1)];
    const bullRamp = rampOf(bull, WHITE);
    const bearRamp = rampOf(bear, WARM_WHITE);
    const openPrice = Math.round((PRICE_BASE + series[0].o * PRICE_SPAN) / 10) * 10;

    return (frame) => {
      px.begin();

      const visibleN = Math.min(n, Math.floor(frame / perCandle) + 1);
      const lastIdx = Math.min(n - 1, visibleN - 1);
      const dispPrice = Math.round((PRICE_BASE + series[lastIdx].c * PRICE_SPAN) / 10) * 10;
      const isUp = dispPrice >= openPrice;
      const changePct = ((dispPrice - openPrice) / openPrice) * 100;
      const changeLabel = `${isUp ? 'UP' : 'DOWN'} ${isUp ? '+' : '-'}${Math.abs(changePct).toFixed(1)}%`;
      const dirCol = isUp ? bull : bear;

      px.rect(0, 0, IW, IH, K.rgb(bgRgb));
      px.rect(PLOT_X0, PLOT_Y0, PLOT_W, PLOT_H, K.rgb(K.lerpRGB(bgRgb, grid, 0.18), 0.5));

      px.text(ticker, PLOT_X0, 18, 2, K.rgb(accent), 'left');
      px.text('OHLC', PLOT_X0, 36, 1, K.rgb(K.lerpRGB(accent, grid, 0.5)), 'left');
      px.text(`$${dispPrice}`, PLOT_X1, 16, 2, K.rgb(dirCol), 'right');
      px.text(changeLabel, PLOT_X1, 36, 1, K.rgb(dirCol, 0.85), 'right');

      for (let r = 0; r <= ROWS; r++) {
        const y = K.snap(PLOT_Y0 + (PLOT_H * r) / ROWS);
        px.rect(PLOT_X0, y, PLOT_W, 1, K.rgb(grid, r === ROWS ? 0.9 : 0.4));
        px.text(`${Math.round((PRICE_BASE + (1 - r / ROWS) * PRICE_SPAN) / 1000)}k`, PLOT_X0 - 4, y - 3, 1, K.rgb(grid, 0.95), 'right');
      }

      for (let c = 0; c <= n; c += 4) {
        px.rect(K.snap(PLOT_X0 + c * colW), PLOT_Y0, 1, PLOT_H, K.rgb(grid, 0.22));
      }

      px.rect(PLOT_X0, PLOT_Y0, 1, PLOT_H, K.rgb(grid, 0.9));

      for (let i = 0; i < visibleN; i++) {
        const d = series[i];
        const isBull = d.c >= d.o;
        const cyc = K.cyclePalette(frame, i * 0.9, cycleSpeed / DURATION, isBull ? bullRamp : bearRamp);
        const ease = 1 - (1 - K.clamp01((frame - i * perCandle) / 6)) ** 2;
        const cx = K.snap(PLOT_X0 + (i + 0.5) * colW);
        const yO = priceToY(d.o);
        const yC = priceToY(d.c);
        const yH = priceToY(d.h);
        const yL = priceToY(d.l);
        const bodyTop = Math.min(yO, yC);
        const bodyBot = Math.max(yO, yC);
        const bodyH = Math.max(3, K.snap(Math.max(3, bodyBot - bodyTop) * ease));
        const bodyMid = (bodyTop + bodyBot) / 2;
        const bx = K.snap(cx - bodyW / 2);
        const by = K.snap(bodyMid - bodyH / 2);

        px.rect(cx, K.snap(bodyMid - (bodyMid - yH) * ease), 1, Math.max(1, K.snap((yL - yH) * ease)), K.rgb(K.lerpRGB(cyc, WHITE, 0.18), 0.85));
        px.rect(bx, by, bodyW, bodyH, K.rgb(cyc));
        px.outline(bx, by, bodyW, bodyH, K.rgb(K.lerpRGB(cyc, BLACK, 0.35)));
      }

      const yLast = priceToY(series[lastIdx].c);

      for (let x = PLOT_X0; x < PLOT_X1; x += 6) {
        px.rect(x, yLast, 3, 1, K.rgb(dirCol, 0.7));
      }

      const cxLast = K.snap(PLOT_X0 + (lastIdx + 0.5) * colW);
      const tw = 0.5 + 0.5 * Math.sin(frame * 0.5);
      px.rect(cxLast - 1, yLast - 1, 3, 3, K.rgb(K.lerpRGB(dirCol, WHITE, 0.4 * tw)));
    };
  }
};

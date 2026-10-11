import sharp from 'sharp';
import type { AppTab } from './browser';
import type { VectorUi } from '$lib/motion/vector-ui/model';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { vectorPiece, withFonts } from '$lib/motion/vector-ui/piece';

const PROBE_W = 320;
const PROBE_H = 200;
const WINDOW = 8;
const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;

async function grey(image: Buffer): Promise<Uint8Array> {
  return new Uint8Array(await sharp(image).resize(PROBE_W, PROBE_H, { fit: 'fill' }).greyscale().raw().toBuffer());
}

function windowSsim(a: Uint8Array, b: Uint8Array, x0: number, y0: number): number {
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  const n = WINDOW * WINDOW;
  for (let y = y0; y < y0 + WINDOW; y++) {
    for (let x = x0; x < x0 + WINDOW; x++) {
      const p = a[y * PROBE_W + x];
      const q = b[y * PROBE_W + x];
      sa += p;
      sb += q;
      saa += p * p;
      sbb += q * q;
      sab += p * q;
    }
  }
  const ma = sa / n;
  const mb = sb / n;
  const va = saa / n - ma * ma;
  const vb = sbb / n - mb * mb;
  const cov = sab / n - ma * mb;
  return ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
}

export async function similarity(page: Buffer, rebuilt: Buffer): Promise<number> {
  const [a, b] = await Promise.all([grey(page), grey(rebuilt)]);
  let sum = 0;
  let count = 0;
  for (let y = 0; y + WINDOW <= PROBE_H; y += WINDOW) {
    for (let x = 0; x + WINDOW <= PROBE_W; x += WINDOW) {
      sum += windowSsim(a, b, x, y);
      count++;
    }
  }
  return sum / count;
}

function harness(ui: VectorUi): string {
  const piece = vectorPiece('UiProbe', withFonts(ui, GOOGLE_FONTS.map((f) => f.f)));
  const families = ui.fonts.map((f) => `family=${encodeURIComponent(f)}:wght@100..900`).join('&');
  const fonts = families ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families}&display=block">` : '';
  const js = piece.js.replace(/const SAFE = [\d.]+;/, 'const SAFE = 1;');
  return `<!doctype html><html><head>${fonts}<style>html,body{margin:0}#root{position:relative;width:${ui.width}px;height:${ui.height}px;overflow:hidden}${piece.css.replace(/:scope/g, '#root')}</style></head><body><div id="root"></div><script>
const root = document.getElementById('root');
const props = { enter: 'none' };
const param = (k, d) => (k in props ? props[k] : d);
const updates = [];
const tl = { to: (_, o) => updates.push(o.onUpdate) };
(new Function('root', 'param', 'tl', 'duration', ${JSON.stringify(js)}))(root, param, tl, 3);
updates.forEach((u) => u.call({ time: () => 3 }));
</script></body></html>`;
}

export async function uiFidelity(tab: AppTab, ui: VectorUi, page: Buffer): Promise<number> {
  const rebuilt = await tab.paint(harness(ui), { width: ui.width, height: ui.height });
  return similarity(page, rebuilt);
}

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoverShape, densityAt, glyphAt } from '../src/lib/site/alternatives/cover.ts';
import { flagColour } from '../src/lib/site/ascii-field.ts';

const STATIC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'static');
const font = (name: string) => `data:font/woff2;base64,${readFileSync(resolve(STATIC, 'site/fonts', name)).toString('base64')}`;
const ORANGE = '#ff5100';
const CELL = 18;
const TITLE_SIZES: readonly [number, number][] = [[8, 120], [14, 96], [22, 76], [Infinity, 60]];

export type Size = { readonly width: number; readonly height: number };

export type CoverSpec = { readonly kicker: string; readonly title: string; readonly sub: string; readonly shape: CoverShape; readonly ramp: string; readonly flag: number };

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const baseCss = ({ width, height }: Size) => `
@font-face { font-family: 'DM Sans'; src: url('${font('dm-sans-latin.woff2')}'); }
@font-face { font-family: 'DM Mono'; src: url('${font('dm-mono-400-latin.woff2')}'); }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: ${width}px; height: ${height}px; background: #000; color: #fff; font-family: 'DM Sans', sans-serif; overflow: hidden; }
.mono { font-family: 'DM Mono', monospace; }
`;

function asciiField({ width, height }: Size, shape: CoverShape, ramp: string, flag: number): string {
  const cols = Math.floor(width / CELL);
  const rows = Math.floor(height / CELL);
  const cells: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) / cols;
      const y = (r + 0.5) / rows;
      const glyph = glyphAt(ramp, densityAt(shape, x, y));
      if (glyph === ' ') {
        continue;
      }
      const [red, green, blue] = flagColour(flag, x * 0.7 + y * 0.3);
      cells.push(`<text x="${(c + 0.5) * CELL}" y="${(r + 0.5) * CELL}" fill="rgb(${red} ${green} ${blue})">${esc(glyph)}</text>`);
    }
  }
  return `<svg width="${width}" height="${height}" style="position:absolute;inset:0;opacity:.55"><g font-family="DM Mono, monospace" font-size="14" text-anchor="middle" dominant-baseline="middle">${cells.join('')}</g></svg>`;
}

const titleSize = (title: string) => TITLE_SIZES.find(([max]) => title.length <= max)![1];

export const coverHtml = (size: Size, s: CoverSpec) => `
<div style="position:relative;width:100%;height:100%;background:#0a0a0a">
  ${asciiField(size, s.shape, s.ramp, s.flag)}
  <div style="position:absolute;inset:0;background:linear-gradient(30deg, rgb(10 10 10/.95) 25%, transparent 60%)"></div>
  <div style="position:absolute;left:64px;bottom:64px;right:64px">
    <p class="mono" style="color:${ORANGE};font-size:22px;letter-spacing:.02em">${esc(s.kicker)}</p>
    <p style="font-size:${titleSize(s.title)}px;line-height:1;letter-spacing:-.05em;font-weight:500;margin-top:12px">${esc(s.title)}</p>
    <p class="mono" style="font-size:24px;color:rgb(255 255 255/.7);margin-top:20px">${esc(s.sub)}</p>
  </div>
</div>`;

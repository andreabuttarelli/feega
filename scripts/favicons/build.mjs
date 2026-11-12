import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(new URL('../../package.json', import.meta.url));
const sharp = require('sharp');

const ROOT = new URL('../../', import.meta.url).pathname;
const SOURCE = process.env.FEEGA_MARK_SVG ?? new URL('mark.svg', import.meta.url).pathname;
const ORANGE = '#FF5100';
const BLACK = '#000000';
const MARK_VIEWBOX = '36 36 228 228';
const CENTRES = [[99, 99], [201, 99], [201, 201], [99, 201]];
const SMALL_CUT_RADIUS = 78;
const LOBE_RADIUS = 57;
const SMALL_PX = 48;
const APPLE_PADDING = 0.2;
const MASKABLE_PADDING = 0.15;
const ICO_SIZES = [16, 32, 48];

const Sites = {
  app: { dir: 'static', names: { 16: 'favicon-16.png', 32: 'favicon-32.png', 48: 'favicon-48.png' }, manifestIcons: true },
  landing: { dir: 'landing/static/site', names: { 48: 'favicon.png' } },
  blog: { dir: 'web-blog/public', names: { 48: 'favicon.png' } },
  docs: { dir: 'web-docs/public', names: { 48: 'favicon.png' } }
};

const exactMark = readFileSync(SOURCE, 'utf8');

const smallMark = () => {
  const lobes = CENTRES.map(([x, y], i) => {
    const [cx, cy] = CENTRES[(i + 3) % 4];
    return `<mask id="m${i}"><rect width="300" height="300" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${SMALL_CUT_RADIUS}" fill="#000"/></mask><circle cx="${x}" cy="${y}" r="${LOBE_RADIUS}" mask="url(#m${i})"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="${ORANGE}">${lobes.join('')}</svg>`;
};

const cropped = (svg) => svg.replace('viewBox="0 0 300 300"', `viewBox="${MARK_VIEWBOX}"`);

const markOnly = (svg, px) => sharp(Buffer.from(svg), { density: 600 }).resize(px, px).png().toBuffer();

const onBlack = async (px, padding) => {
  const inner = Math.round(px * (1 - 2 * padding));
  const mark = await markOnly(cropped(exactMark), inner);
  return sharp({ create: { width: px, height: px, channels: 3, background: BLACK } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer();
};

const raster = (px) => markOnly(cropped(px <= SMALL_PX ? smallMark() : exactMark), px);

const ico = (pngs) => {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ px, data }, i) => {
    const at = 6 + 16 * i;
    head.writeUInt8(px, at);
    head.writeUInt8(px, at + 1);
    head.writeUInt16LE(1, at + 4);
    head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(data.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
};

const write = (dir, name, data) => writeFileSync(join(ROOT, dir, name), data);

const icoPngs = await Promise.all(ICO_SIZES.map(async (px) => ({ px, data: await raster(px) })));
const faviconSvg = cropped(exactMark);
const apple = await onBlack(180, APPLE_PADDING);

for (const { dir, names, manifestIcons } of Object.values(Sites)) {
  mkdirSync(join(ROOT, dir), { recursive: true });
  write(dir, 'favicon.svg', faviconSvg);
  write(dir, 'favicon.ico', ico(icoPngs));
  write(dir, 'apple-touch-icon.png', apple);
  for (const [px, name] of Object.entries(names)) {
    write(dir, name, await raster(Number(px)));
  }
  if (manifestIcons) {
    write(dir, 'icon-192.png', await onBlack(192, 0.12));
    write(dir, 'icon-512.png', await onBlack(512, 0.12));
    write(dir, 'icon-maskable-512.png', await onBlack(512, MASKABLE_PADDING));
  }
}

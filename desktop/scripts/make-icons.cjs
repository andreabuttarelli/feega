const { app, BrowserWindow, nativeImage } = require('electron');
const { execFileSync } = require('node:child_process');
const { mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const OUT = join(__dirname, '..', 'build', 'icons');
const FAVICON = join(__dirname, '..', '..', 'landing', 'static', 'site', 'favicon.svg');
const CANVAS = 1024;
const TILE = 824;
const TILE_RADIUS = 185;
const MARK_BOX = 228;
const MARK_SIZE = 540;
const ICO_SIZES = [256, 128, 64, 48, 32, 16];
const ICONSET = [16, 32, 128, 256, 512];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const markPaths = () => {
  const svg = readFileSync(FAVICON, 'utf8');
  const lobe = /<path id="lobe" d="([^"]+)"/.exec(svg)[1];
  return [0, 90, 180, 270].map((turn) => `<path d="${lobe}" transform="rotate(${turn} 150 150)"/>`).join('');
};

const iconSvg = () => {
  const margin = (CANVAS - TILE) / 2;
  const scale = MARK_SIZE / MARK_BOX;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ececec"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000" flood-opacity="0.35"/></filter>
  </defs>
  <rect x="${margin}" y="${margin}" width="${TILE}" height="${TILE}" rx="${TILE_RADIUS}" fill="url(#tile)" filter="url(#shadow)"/>
  <rect x="${margin + 1}" y="${margin + 1}" width="${TILE - 2}" height="${TILE - 2}" rx="${TILE_RADIUS - 1}" fill="none" stroke="#000000" stroke-opacity="0.08" stroke-width="2"/>
  <g transform="translate(${CANVAS / 2} ${CANVAS / 2}) scale(${scale}) translate(-150 -150)" fill="#ff5100">${markPaths()}</g>
</svg>`;
};

const render = async () => {
  const win = new BrowserWindow({ show: false, width: CANVAS, height: CANVAS, useContentSize: true, transparent: true, webPreferences: { offscreen: true } });
  const page = `<body style="margin:0;background:transparent">${iconSvg()}</body>`;
  await win.loadURL(`data:text/html,${encodeURIComponent(page)}`);
  await wait(800);
  const image = await win.webContents.capturePage();
  return image.getSize().width === CANVAS ? image : image.resize({ width: CANVAS, height: CANVAS, quality: 'best' });
};

const icoOf = (png) => {
  const entries = ICO_SIZES.map((size) => ({ size, data: png.resize({ width: size, height: size, quality: 'best' }).toPNG() }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = 6 + entries.length * 16;
  const dir = entries.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.data)]);
};

const icnsOf = (png) => {
  const set = join(OUT, 'icon.iconset');
  rmSync(set, { recursive: true, force: true });
  mkdirSync(set, { recursive: true });
  for (const size of ICONSET) {
    writeFileSync(join(set, `icon_${size}x${size}.png`), png.resize({ width: size, height: size, quality: 'best' }).toPNG());
    writeFileSync(join(set, `icon_${size}x${size}@2x.png`), png.resize({ width: size * 2, height: size * 2, quality: 'best' }).toPNG());
  }
  execFileSync('iconutil', ['-c', 'icns', set, '-o', join(OUT, 'icon.icns')]);
  rmSync(set, { recursive: true, force: true });
};

app.whenReady().then(async () => {
  mkdirSync(OUT, { recursive: true });
  const png = await render();
  writeFileSync(join(OUT, 'icon.png'), png.toPNG());
  writeFileSync(join(OUT, '512x512.png'), nativeImage.createFromBuffer(png.toPNG()).resize({ width: 512, height: 512, quality: 'best' }).toPNG());
  writeFileSync(join(OUT, 'icon.ico'), icoOf(png));
  icnsOf(png);
  app.exit(0);
});

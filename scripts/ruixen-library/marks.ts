import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FICTIONAL, markFile } from './debrand';

const OUT = join(import.meta.dirname, '../../libraries/ruixen/public/marks');
const INK = '#3f3f46';
const HEIGHT = 32;
const CHAR_PX = 9.5;
const GAP = 8;

const SHAPES = [
  '<circle cx="12" cy="16" r="10"/>',
  '<rect x="2" y="6" width="20" height="20" rx="4"/>',
  '<path d="M12 5 L23 26 L1 26 Z"/>',
  '<path d="M12 4 L22 16 L12 28 L2 16 Z"/>',
  `<circle cx="12" cy="16" r="9" fill="none" stroke="${INK}" stroke-width="4"/>`,
  '<path d="M7 6 H17 L22 16 L17 26 H7 L2 16 Z"/>'
];

mkdirSync(OUT, { recursive: true });
Object.values(FICTIONAL).forEach((name, i) => {
  const width = Math.ceil(24 + GAP + name.length * CHAR_PX);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}" fill="${INK}">${SHAPES[i % SHAPES.length]}<text x="${24 + GAP}" y="22" font-family="ui-sans-serif, system-ui, sans-serif" font-size="16" font-weight="600" letter-spacing="-0.3">${name}</text></svg>\n`;
  writeFileSync(join(OUT, markFile(name)), svg);
});
console.log(`${Object.keys(FICTIONAL).length} marks written to ${OUT}`);

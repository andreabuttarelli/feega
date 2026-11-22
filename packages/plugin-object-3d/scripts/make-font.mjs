import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

const RESOLUTION = 1000;
const BYTES_PER_KB = 1024;

const CODE_RANGES = [
  [0x20, 0x7e],
  [0xa0, 0xff],
  [0x2013, 0x2014],
  [0x2018, 0x201a],
  [0x201c, 0x201e],
  [0x2022, 0x2022],
  [0x2026, 0x2026],
  [0x20ac, 0x20ac]
];

const [, , source, target] = process.argv;

if (!source || !target) {
  console.error('usage: node make-font.mjs <Inter-Bold.ttf> <out.typeface.json>');
  process.exit(1);
}

const bytes = readFileSync(source);
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const scale = RESOLUTION / font.unitsPerEm;
const round = (value) => Math.round(value * scale);

const COMMANDS = {
  M: (c) => `m ${round(c.x)} ${round(c.y)}`,
  L: (c) => `l ${round(c.x)} ${round(c.y)}`,
  Q: (c) => `q ${round(c.x)} ${round(c.y)} ${round(c.x1)} ${round(c.y1)}`,
  C: (c) => `b ${round(c.x)} ${round(c.y)} ${round(c.x1)} ${round(c.y1)} ${round(c.x2)} ${round(c.y2)}`,
  Z: () => ''
};

const outlineOf = (glyph) =>
  glyph
    .path
    .commands.map((command) => COMMANDS[command.type](command))
    .filter(Boolean)
    .join(' ');

const glyphOf = (glyph) => {
  const box = glyph.getBoundingBox();
  return { ha: round(glyph.advanceWidth), x_min: round(box.x1), x_max: round(box.x2), o: outlineOf(glyph) };
};

const glyphs = {};

for (const [from, to] of CODE_RANGES) {
  for (let code = from; code <= to; code++) {
    const char = String.fromCodePoint(code);
    const glyph = font.charToGlyph(char);
    if (glyph.index === 0) {
      continue;
    }
    glyphs[char] = glyphOf(glyph);
  }
}

const typeface = {
  glyphs,
  familyName: 'Inter',
  ascender: round(font.ascender),
  descender: round(font.descender),
  underlinePosition: round(font.tables.post.underlinePosition),
  underlineThickness: round(font.tables.post.underlineThickness),
  boundingBox: {
    yMin: round(font.tables.head.yMin),
    xMin: round(font.tables.head.xMin),
    yMax: round(font.tables.head.yMax),
    xMax: round(font.tables.head.xMax)
  },
  resolution: RESOLUTION,
  original_font_information: { fullName: 'Inter Bold', license: 'SIL Open Font License 1.1' }
};

const json = JSON.stringify(typeface);
writeFileSync(target, json);
console.log(`${Object.keys(glyphs).length} glyphs, ${(json.length / BYTES_PER_KB).toFixed(1)} KB`);

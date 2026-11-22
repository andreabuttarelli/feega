import { readFile } from 'node:fs/promises';
import opentype from 'opentype.js';
import sharp from 'sharp';
import wawoff2 from 'wawoff2';

const WIDTH = 1200;
const HEIGHT = 630;
const CELL = 8;
const COLS = WIDTH / CELL;
const ROWS = Math.ceil(HEIGHT / CELL);
const MARGIN = 80;
const TITLE_SIZE = 76;
const TITLE_TRACKING = -0.05;
const TITLE_LINE_HEIGHT = 84;
const TITLE_FIRST_BASELINE = 500;
const KICKER_SIZE = 26;
const KICKER_BASELINE = 428;
const BRAND_SIZE = 34;
const BRAND_BASELINE = 120;

const INK = '#0a0a0a';
const ORANGE = '#ff5100';
const AMBER = '#ff8a3d';
const BLUE = '#004dff';
const NAVY = '#0038a8';
const DEEP = '#001a66';
const EMBER = '#7a2500';
const CHAR = '#1c0a05';
const WHITE = '#f0eee9';
const STONE = ['#8a8780', '#5a5853', '#3a3935', '#1c1b19'];

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

const covers = [
  { file: 'public/covers/introducing-feega.png', scene: 'dusk', lines: ['Design in', 'your codebase.'], kicker: 'Introducing Feega' },
  { file: 'public/covers/rust-canvas-renderer.png', scene: 'forge', lines: ['Rust, WebGPU, WASM.', 'One engine.'], kicker: 'Why we wrote the renderer in Rust' },
  { file: 'public/covers/how-the-canvas-got-fast.png', scene: 'tiles', lines: ['Tiles, cheaper blur,', 'half the wasm.'], kicker: 'How the canvas got fast' },
  { file: 'public/covers/design-in-your-codebase.png', scene: 'sunset', lines: ['One thing.', 'In your codebase.'], kicker: 'Why Feega is now one thing' },
  { file: 'public/covers/sveltekit-vs-nextjs.png', scene: 'windows', lines: ['SvelteKit or', 'Next.js?'], kicker: 'The same app, side by side' },
  { file: 'public/covers/sveltekit-form-actions-explained.png', scene: 'terminal', lines: ['Form actions,', 'without the magic'], kicker: 'SvelteKit explained' },
  { file: 'public/covers/sveltekit-load-functions-server-vs-universal.png', scene: 'tiles', lines: ['Server load or', 'universal load?'], kicker: 'SvelteKit explained' },
  { file: 'public/covers/svelte-5-runes-in-practice.png', scene: 'forge', lines: ['Runes, in the', 'order you need them'], kicker: 'Svelte 5 in practice' },
  { file: 'public/covers/freelancers-and-agencies-design-reviews.png', scene: 'dusk', lines: ['Design reviews', 'with the client live'], kicker: 'Use case: freelancers and agencies' },
  { file: 'public/covers/feega-with-claude-code.png', scene: 'sunset', lines: ['Claude Code writes.', 'You adjust.'], kicker: 'Use case: Claude Code' },
  { file: 'public/covers/feega-with-grok-build.png', scene: 'terminal', lines: ['Grok Build writes.', 'You adjust.'], kicker: 'Use case: Grok Build' },
  { file: 'public/covers/feega-with-ai-site-builders.png', scene: 'windows', lines: ['Generated site.', 'Hand-tuned code.'], kicker: 'Use case: AI site builders' }
];

const CURSOR = [
  '#...........',
  '##..........',
  '#w#.........',
  '#ww#........',
  '#www#.......',
  '#wwww#......',
  '#wwwww#.....',
  '#wwwwww#....',
  '#wwwwwww#...',
  '#wwwww#####.',
  '#ww#ww#.....',
  '#w#.#ww#....',
  '##..#ww#....',
  '#....#ww#...',
  '.....#ww#...',
  '......##....'
];

const CURSOR_PALETTE = { '#': INK, w: WHITE };

function hash(x, y, seed) {
  let h = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1274126177, 2246822519) ^ Math.imul(seed + 3266489917, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function ridge(x, seed, amp, freq) {
  return (
    Math.sin(x * freq + seed) * amp +
    Math.sin(x * freq * 2.3 + seed * 1.7) * amp * 0.5 +
    Math.sin(x * freq * 5.1 + seed * 2.9) * amp * 0.2
  );
}

function ramp(colors, t, x, y) {
  const clamped = Math.min(Math.max(t, 0), 0.9999);
  const scaled = clamped * (colors.length - 1);
  const index = Math.floor(scaled);
  const mix = scaled - index;
  const threshold = (BAYER[y % 4][x % 4] + 0.5) / 16;
  return mix > threshold ? colors[index + 1] : colors[index];
}

function dusk(x, y) {
  const horizon = ROWS * 0.55;
  const sunX = COLS * 0.7;
  const sunY = horizon - 2;
  const distance = Math.hypot(x - sunX, (y - sunY) * 1.1);
  if (distance < 10 && y < horizon + 4) {
    return AMBER;
  }
  for (let layer = 0; layer < STONE.length; layer++) {
    const base = horizon + layer * 5;
    const top = base - 4 + ridge(x, layer * 2.1, 7 - layer, 0.05 + layer * 0.012);
    if (y >= top) {
      const snow = layer === 0 && y < top + 3 && BAYER[y % 4][x % 4] < 9;
      return snow ? WHITE : STONE[layer];
    }
  }
  return ramp([DEEP, NAVY, BLUE, ORANGE, AMBER], y / horizon, x, y);
}

function forge(x, y) {
  const distance = Math.hypot((x - COLS * 0.85) * 0.7, (y - ROWS * 1.05) * 1.1) / (COLS * 0.62);
  const heat = 1 - distance;
  if (hash(x, y, 7) > 0.995 && heat > 0.2) {
    return WHITE;
  }
  return ramp([INK, CHAR, EMBER, ORANGE, AMBER], heat * 1.2, x, y);
}

function tiles(x, y) {
  const lane = Math.floor(y / 2);
  const streak = hash(lane, 3, 5);
  const length = streak * COLS * 0.9;
  const inStreak = streak > 0.45 && y % 2 === 0 && x < length && x > length - COLS * 0.35;
  if (inStreak) {
    return ramp([BLUE, WHITE], 1 - (length - x) / (COLS * 0.35), x, y);
  }
  const gridLine = x % 20 === 0 || y % 20 === 0;
  if (gridLine) {
    return NAVY;
  }
  return ramp([INK, NAVY, BLUE], (x / COLS) * 0.4 + (1 - y / ROWS) * 0.55, x, y);
}

function sunset(x, y) {
  const horizon = ROWS * 0.7;
  const sunX = COLS * 0.68;
  const distance = Math.hypot(x - sunX, y - horizon);
  if (y >= horizon) {
    const glow = Math.max(0, 1 - Math.abs(x - sunX) / 40);
    return ramp([INK, CHAR, EMBER], glow * (1 - (y - horizon) / (ROWS - horizon)) * 1.2, x, y);
  }
  if (distance < 20) {
    return ramp([ORANGE, AMBER], 1 - (horizon - y) / 20, x, y);
  }
  if (hash(x, y, 11) > 0.992 && y < horizon * 0.6) {
    return WHITE;
  }
  return ramp([INK, DEEP, NAVY, EMBER, ORANGE], 1 - Math.min(distance / (ROWS * 0.9), 1), x, y);
}

function terminal(x, y) {
  const line = Math.floor(y / 4);
  const background = ramp([INK, DEEP], y / ROWS, x, y);
  if (y % 4 > 1) {
    return background;
  }
  const indent = Math.floor(hash(line, 1, 21) * 4) * 6 + 40;
  const length = 10 + hash(line, 2, 21) * COLS * 0.35;
  if (x < indent || x > indent + length) {
    return background;
  }
  return line === 6 ? ORANGE : ramp([NAVY, BLUE], hash(x, line, 22), x, y);
}

function windows(x, y) {
  const frames = [
    { x0: COLS * 0.55, x1: COLS * 0.96, y0: ROWS * 0.28, y1: ROWS * 0.7, edge: ORANGE, fill: EMBER },
    { x0: COLS * 0.42, x1: COLS * 0.88, y0: ROWS * 0.12, y1: ROWS * 0.55, edge: BLUE, fill: NAVY }
  ];
  for (const frame of frames) {
    if (x < frame.x0 || x > frame.x1 || y < frame.y0 || y > frame.y1) {
      continue;
    }
    const onEdge = x - frame.x0 < 1 || frame.x1 - x < 1 || y - frame.y0 < 1 || frame.y1 - y < 1;
    const onBar = y - frame.y0 < 4;
    return onEdge || onBar ? frame.edge : frame.fill;
  }
  return ramp([INK, DEEP], 1 - y / ROWS, x, y);
}

const SCENES = { dusk, forge, tiles, sunset, terminal, windows };

const CURSOR_ANCHOR = { x: Math.round(COLS * 0.68) - 3, y: Math.round(ROWS * 0.7) - 28 };

function paintCursor(grid) {
  CURSOR.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      const color = CURSOR_PALETTE[ch];
      if (color) {
        grid[CURSOR_ANCHOR.y + dy][CURSOR_ANCHOR.x + dx] = color;
      }
    });
  });
}

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function sceneBuffer(name) {
  const grid = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => SCENES[name](x, y)));
  if (name === 'sunset') {
    paintCursor(grid);
  }

  const data = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let py = 0; py < HEIGHT; py++) {
    for (let px = 0; px < WIDTH; px++) {
      const rgb = hexToRgb(grid[Math.floor(py / CELL)][Math.floor(px / CELL)]);
      data.set(rgb, (py * WIDTH + px) * 3);
    }
  }
  return data;
}

async function loadFont(path) {
  const ttf = await wawoff2.decompress(await readFile(path));
  const buffer = ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength);
  return opentype.parse(buffer);
}

function textPath(font, text, y, size, tracking, fill) {
  const scale = size / font.unitsPerEm;
  let x = MARGIN;
  let previous = null;
  let data = '';
  for (const char of text) {
    const glyph = font.charToGlyph(char);
    x += previous ? font.getKerningValue(previous, glyph) * scale : 0;
    data += glyph.getPath(x, y, size).toPathData(2).replace(/M/g, 'ZM').slice(1) + 'Z';
    x += glyph.advanceWidth * scale + tracking * size;
    previous = glyph;
  }
  return `<path d="${data}" fill="${fill}" fill-rule="evenodd"/>`;
}

function overlay(fonts, { lines, kicker }) {
  const title = lines
    .map((line, i) => textPath(fonts.title, line, TITLE_FIRST_BASELINE + i * TITLE_LINE_HEIGHT, TITLE_SIZE, TITLE_TRACKING, WHITE))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.35" stop-color="${INK}" stop-opacity="0"/>
        <stop offset="0.8" stop-color="${INK}" stop-opacity="0.86"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#scrim)"/>
    ${textPath(fonts.title, 'Feega', BRAND_BASELINE, BRAND_SIZE, TITLE_TRACKING, WHITE)}
    ${textPath(fonts.mono, kicker, KICKER_BASELINE, KICKER_SIZE, 0, AMBER)}
    ${title}
  </svg>`;
}

const fonts = {
  title: await loadFont('public/fonts/bdo-grotesk-DemiBold.woff2'),
  mono: await loadFont('public/fonts/fragment-mono-latin.woff2')
};

for (const cover of covers) {
  await sharp(sceneBuffer(cover.scene), { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
    .composite([{ input: Buffer.from(overlay(fonts, cover)) }])
    .png()
    .toFile(cover.file);
}

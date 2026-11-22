const MAX_COLORS = 14;

const FLAGS = {
  rainbow: ['E40303', 'FF8C00', 'FFED00', '008026', '004DFF', '750787'],
  progress: ['000000', '613915', '74D7EE', 'FFAFC8', 'FFFFFF', 'E40303', 'FF8C00', 'FFED00', '008026', '004DFF', '750787'],
  intersex: ['FFD800', '7902AA', 'FFFFFF', 'FFAFC8', '74D7EE', '613915', '000000', 'E40303', 'FF8C00', 'FFED00', '008026', '004DFF', '750787'],
  trans: ['5BCEFA', 'F5A9B8', 'FFFFFF', 'F5A9B8', '5BCEFA'],
  bisexual: ['D60270', 'D60270', '9B4F96', '0038A8', '0038A8'],
  pansexual: ['FF218C', 'FFD800', '21B1FF'],
  lesbian: ['D52D00', 'EF7627', 'FF9A56', 'FFFFFF', 'D162A4', 'B55690', 'A30262'],
  nonbinary: ['FCF434', 'FFFFFF', '9C59D1', '2C2C2C'],
  asexual: ['000000', 'A3A3A3', 'FFFFFF', '800080'],
  aromantic: ['3DA542', 'A7D379', 'FFFFFF', 'A9A9A9', '000000'],
  genderfluid: ['FF76A4', 'FFFFFF', 'C011D7', '000000', '2F3CBE'],
  agender: ['000000', 'BCC4C7', 'FFFFFF', 'B7F684', 'FFFFFF', 'BCC4C7', '000000'],
  mlm: ['078D70', '26CEAA', '98E8C1', 'FFFFFF', '7BADE2', '5049CC', '3D1A78'],
  polyamorous: ['009FE3', 'E50051', '340C46', 'FFFFFF', 'FCBF00'],
  demisexual: ['000000', 'FFFFFF', '6E0070', 'D2D2D2'],
  genderqueer: ['B57EDC', 'FFFFFF', '4A8123'],
  custom: ['FF218C', 'FFD800', '21B1FF']
};

const PRESETS = Object.keys(FLAGS);
const slots = Array.from({ length: MAX_COLORS }, (_, i) => `--ascii-c${i + 1}`);
const presetRule = ([name, stripes]) =>
  `.fl-ascii-pride[data-preset="${name}"]{${stripes.map((hex, i) => `${slots[i]}:#${hex}`).join(';')}}`;

const css = [
  `.fl-ascii-pride{${slots.map((s) => `${s}:initial`).join(';')};position:relative;display:block;overflow:hidden;width:100%;height:100%;min-height:clamp(24rem,50vw,100svh);font-family:var(--feega-font-mono);contain:layout paint}`,
  '.fl-ascii-pride canvas{position:absolute;inset:0;display:block;width:100%;height:100%;opacity:0;transition:opacity 1.6s var(--feega-ease)}',
  '.fl-ascii-pride canvas.on{opacity:1}',
  '.fl-ascii-pride .fade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,transparent 55%,var(--feega-bg))}',
  '.fl-ascii-pride[data-fade="off"] .fade{display:none}',
  ...Object.entries(FLAGS).map(presetRule)
];

const ENGINE = (typed) => {
  const t = (annotation) => (typed ? annotation : '');
  return `const RAMP = ' .:-=+*#%@';
const MAX_COLORS = ${MAX_COLORS};
const MAX_CELLS = 12000;
const LOOP_MS = 24000;
const FRAME_MS = 1000 / 30;
const MAX_DPR = 2;
const DEFAULT_CELL = 14;
const MOBILE_CELL = 11;
const MOBILE_MAX = 810;
const SCALE = 0.09;
const EDGE_FLOOR = 0.6;
const TINT_STEPS = 96;
const MIN_PEAK = 200;
const DARK_PEAK = 60;
const BAND_X = 0.55;
const BAND_Y = 0.35;
const TAU = Math.PI * 2;
const WAVES = [
  { kx: 0.11, ky: 0.07, r: 1.6, off: 0 },
  { kx: -0.06, ky: 0.13, r: 1.2, off: 1.7 },
  { kx: 0.04, ky: -0.09, r: 2.1, off: 3.1 }
];

${typed ? 'type Rgb = number[];\n\n' : ''}function fieldAt(x${t(': number')}, y${t(': number')}, phase${t(': number')})${t(': number')} {
  const a = phase * TAU;
  const cx = Math.cos(a);
  const sy = Math.sin(a);
  let sum = 0;

  for (const w of WAVES) {
    const warp = Math.sin(y * 0.05 + w.r * sy + w.off) * 2;
    sum += Math.sin((x + warp) * w.kx + y * w.ky + w.r * cx + w.off);
  }

  return (sum / WAVES.length + 1) / 2;
}

function envelope(nx${t(': number')}, ny${t(': number')})${t(': number')} {
  const r = Math.min(1, Math.hypot((nx - 0.5) * 2, (ny - 0.5) * 2) / Math.SQRT2);
  return 1 - r * r * (3 - 2 * r);
}

function glyphFor(density${t(': number')})${t(': string')} {
  return RAMP[Math.round(Math.min(1, Math.max(0, density)) * (RAMP.length - 1))];
}

function gridSize(width${t(': number')}, height${t(': number')}, cell${t(': number')}) {
  let size = cell;
  while (Math.ceil(width / size) * Math.ceil(height / size) > MAX_CELLS) {
    size += 1;
  }

  return { cols: Math.ceil(width / size), rows: Math.ceil(height / size), cell: size };
}

function lifted(rgb${t(': Rgb')})${t(': Rgb')} {
  const gain = Math.max(1, MIN_PEAK / Math.max(...rgb, 1));
  return rgb.map((v) => Math.min(255, Math.round(v * gain)));
}

function toHex(rgb${t(': Rgb')})${t(': string')} {
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function readStops(root${t(': HTMLElement')}, probe${t(': CanvasRenderingContext2D')})${t(': Rgb[]')} {
  const style = getComputedStyle(root);
  const stops${t(': Rgb[]')} = [];

  for (let i = 1; i <= MAX_COLORS; i++) {
    const value = style.getPropertyValue('--ascii-c' + i).trim();
    if (!value) {
      continue;
    }

    probe.fillStyle = 'transparent';
    probe.fillStyle = value;
    const hex = String(probe.fillStyle);
    if (hex.length !== 7) {
      continue;
    }

    const rgb = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
    if (Math.max(...rgb) > DARK_PEAK) {
      stops.push(rgb);
    }
  }

  return stops.length ? stops : [[255, 255, 255]];
}

function tints(stops${t(': Rgb[]')})${t(': string[]')} {
  return Array.from({ length: TINT_STEPS }, (_, s) => {
    const p = (s / TINT_STEPS) * stops.length;
    const i = Math.floor(p);
    const f = p - i;
    const a = stops[i % stops.length];
    const b = stops[(i + 1) % stops.length];
    return toHex(lifted(a.map((v, k) => v + (b[k] - v) * f)));
  });
}

function asciiPride(root${t(': HTMLElement')})${t(': () => void')} {
  const canvas = root.querySelector${t('<HTMLCanvasElement>')}('canvas')${t('!')};
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return () => {};
  }

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();
  let grid = { cols: 0, rows: 0, cell: DEFAULT_CELL };
  let colours${t(': string[]')} = [];
  let speed = 1;
  let visible = true;
  let raf = 0;
  let last = 0;

  function configure() {
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
    const width = root.clientWidth;
    const height = root.clientHeight;
    const cell = Number(root.dataset.cell) || (width < MOBILE_MAX ? MOBILE_CELL : DEFAULT_CELL);
    speed = Number(root.dataset.speed) || 0;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    grid = gridSize(width, height, cell);
    colours = tints(readStops(root, ctx${t('!')}));
    ctx${t('!')}.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx${t('!')}.font = grid.cell + 'px ' + getComputedStyle(root).fontFamily;
    ctx${t('!')}.textAlign = 'center';
    ctx${t('!')}.textBaseline = 'middle';
  }

  function draw(now${t(': number')}) {
    const clock = still ? 0 : ((now - t0) * speed) / LOOP_MS;
    const phase = clock - Math.floor(clock);
    const { cols, rows, cell } = grid;
    ctx${t('!')}.clearRect(0, 0, canvas.width, canvas.height);

    for (let c = 0; c < cols; c++) {
      const nx = (c + 0.5) / cols;

      for (let r = 0; r < rows; r++) {
        const ny = (r + 0.5) / rows;
        const e = envelope(nx, ny);
        const d = Math.sqrt(fieldAt(c * cell * SCALE, r * cell * SCALE, phase)) * (EDGE_FLOOR + (1 - EDGE_FLOOR) * e);
        const glyph = glyphFor(d);
        if (glyph === ' ') {
          continue;
        }

        const band = nx * BAND_X + ny * BAND_Y + d * 0.2 - phase;
        ctx${t('!')}.fillStyle = colours[Math.floor((band - Math.floor(band)) * TINT_STEPS) % TINT_STEPS];
        ctx${t('!')}.globalAlpha = 0.35 + d * 0.6;
        ctx${t('!')}.fillText(glyph, c * cell + cell / 2, r * cell + cell / 2);
      }
    }
  }

  function tick(now${t(': number')}) {
    raf = requestAnimationFrame(tick);
    if (now - last < FRAME_MS) {
      return;
    }

    last = now;
    draw(now);
  }

  function sync() {
    cancelAnimationFrame(raf);
    if (still || !speed || !visible || document.hidden) {
      return;
    }

    raf = requestAnimationFrame(tick);
  }

  function refresh() {
    configure();
    draw(performance.now());
    sync();
  }

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  const ro = new ResizeObserver(refresh);
  const mo = new MutationObserver(refresh);

  refresh();
  canvas.classList.add('on');
  io.observe(root);
  ro.observe(root);
  mo.observe(root, { attributes: true, attributeFilter: ['data-preset', 'data-speed', 'data-cell', 'style', 'class'] });
  document.addEventListener('visibilitychange', sync);

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    mo.disconnect();
    document.removeEventListener('visibilitychange', sync);
  };
}`;
};

const pad = (text, n) =>
  text
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

const ATTRS = `class="fl-ascii-pride" data-preset="rainbow" data-preset-options="${PRESETS.join(',')}" data-speed="1" data-cell="14" data-fade="on" data-fade-options="on,off" aria-hidden="true"`;

const shell = (bind, cls = 'class') => `<div ${bind}${ATTRS.replace('class=', `${cls}=`)}>
  <canvas></canvas>
  <div ${cls}="fade"></div>
</div>`;

const boot = (typed) => `${ENGINE(typed)}

document.querySelectorAll${typed ? '<HTMLElement>' : ''}('.fl-ascii-pride:not([data-ready])').forEach((root) => {
  root.setAttribute('data-ready', '');
  asciiPride(root);
});`;

export const asciiPrideItem = {
  id: 'ascii-pride',
  name: 'ASCII pride gradient',
  description: 'An animated ASCII field flowing in pride flag colours: sixteen flag presets or your own palette, with a soft fade.',
  category: 'component',
  tags: ['ascii', 'gradient', 'pride', 'animation'],
  tier: 'pro',
  preview: 'https://www.feega.app/templates-shots/ascii-pride-light.webp',
  mods: [],
  css,
  files: (C) => ({
    html: `${shell('')}\n\n<script>\n(() => {\n${pad(boot(false), 2)}\n})();\n</script>\n`,
    astro: `---
---

${shell('')}

<script>
${boot(true)}
</script>

<style is:global>
${C}</style>
`,
    svelte: `<script lang="ts">
${pad(ENGINE(true), 2)}

  let root: HTMLElement;

  $effect(() => asciiPride(root));
</script>

${shell('bind:this={root} ')}

<style>
  :global {
${pad(C, 4)}  }
</style>
`,
    react: `import { useEffect, useRef } from 'react';
import './AsciiPride.css';

${ENGINE(true)}

export function AsciiPride() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => (root.current ? asciiPride(root.current) : undefined), []);

  return (
${pad(shell('ref={root} ', 'className').replace('<canvas></canvas>', '<canvas />'), 4)}
  );
}
`,
    vue: `<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

${ENGINE(true)}

const root = ref<HTMLElement | null>(null);
let stop = () => {};

onMounted(() => {
  stop = asciiPride(root.value as HTMLElement);
});
onBeforeUnmount(() => stop());
</script>

<template>
${pad(shell('ref="root" '), 2)}
</template>

<style>
${C}</style>
`
  })
};

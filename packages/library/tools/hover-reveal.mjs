const ASSETS = 'https://www.feega.app/templates-assets/hover-reveal';
const sizes = (kind) => `${ASSETS}/${kind}-960.webp 960w, ${ASSETS}/${kind}-1670.webp 1670w`;
const LIT = { src: `${ASSETS}/lit-1670.webp`, srcset: sizes('lit') };
const DARK = { src: `${ASSETS}/dark-1670.webp`, srcset: sizes('dark') };
const ALT = 'A moonlit jungle with floating islands';
const HEADING = 'Bring the night to life';
const RADIUS = 220;

const css = [
  '.fl-hover-reveal{position:relative;overflow:hidden;width:100%;height:clamp(26rem,56vw,100svh);background:var(--feega-bg);touch-action:pan-y pinch-zoom;contain:layout paint}',
  '.fl-hover-reveal img,.fl-hover-reveal canvas{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;user-select:none;-webkit-user-select:none}',
  '.fl-hover-reveal .lit{visibility:hidden}',
  '.fl-hover-reveal[data-mode="mask"] .lit{visibility:visible;-webkit-mask-image:radial-gradient(circle var(--r,180px) at var(--x,50%) var(--y,50%),black,color-mix(in srgb,black 80%,transparent) 22%,color-mix(in srgb,black 50%,transparent) 45%,color-mix(in srgb,black 20%,transparent) 70%,color-mix(in srgb,black 5%,transparent) 88%,transparent);mask-image:radial-gradient(circle var(--r,180px) at var(--x,50%) var(--y,50%),black,color-mix(in srgb,black 80%,transparent) 22%,color-mix(in srgb,black 50%,transparent) 45%,color-mix(in srgb,black 20%,transparent) 70%,color-mix(in srgb,black 5%,transparent) 88%,transparent)}',
  '.fl-hover-reveal[data-mode="mask"] canvas{display:none}',
  '.fl-hover-reveal .overlay{position:absolute;inset:0;display:grid;place-items:center;padding:var(--feega-gutter);pointer-events:none;text-align:center}',
  '.fl-hover-reveal h2{max-width:16ch;font-family:var(--feega-font-display);font-size:var(--feega-text-display);font-weight:500;line-height:1.05;letter-spacing:var(--feega-tracking-tight);color:var(--feega-fg)}'
];

const ENGINE = (typed) => {
  const t = (annotation) => (typed ? annotation : '');
  return `const DEFAULT_RADIUS = ${RADIUS};
const EASE = 7;
const TRAIL = 1.4;
const IDLE = 2;
const MAX_DPR = 2;
const MAX_STEP = 0.05;
const MASK_SCALE = 0.25;
const SPRITE = 64;
const SPACING = 0.18;
const DEPOSIT = 0.16;
const DRIFT = { x: 0.32, y: 0.26, fx: 0.37, fy: 0.53 };
const BLOBS = [
  { size: 1.25, reach: 0.18, alpha: 0.55, seed: 0 },
  { size: 0.9, reach: 0.42, alpha: 0.45, seed: 1.7 },
  { size: 0.75, reach: 0.55, alpha: 0.4, seed: 3.1 },
  { size: 1.05, reach: 0.35, alpha: 0.35, seed: 4.6 }
];

function wobble(time${t(': number')}, seed${t(': number')})${t(': number')} {
  return Math.sin(time * 0.61 + seed * 1.3) * 0.5 + Math.sin(time * 1.17 + seed * 2.9) * 0.3 + Math.sin(time * 1.93 + seed * 5.1) * 0.2;
}

function glow()${t(': HTMLCanvasElement')} {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = SPRITE;
  const g = sprite.getContext('2d')${t('!')};
  const half = SPRITE / 2;
  const pixels = g.createImageData(SPRITE, SPRITE);
  for (let i = 0; i < SPRITE * SPRITE; i++) {
    const r = Math.min(1, Math.hypot((i % SPRITE) - half + 0.5, Math.floor(i / SPRITE) - half + 0.5) / half);
    pixels.data.fill(255, i * 4, i * 4 + 3);
    pixels.data[i * 4 + 3] = 255 * Math.exp(-4.5 * r * r) * (1 - r);
  }
  g.putImageData(pixels, 0, 0);
  return sprite;
}

function fade(age${t(': number')})${t(': number')} {
  const left = 1 - age;
  return left * left * (1 + 2 * age);
}

function reveal(root${t(": HTMLElement")})${t(": () => void")} {
  const radius = Number(root.dataset.radius) || DEFAULT_RADIUS;
  const lit = root.querySelector${t('<HTMLImageElement>')}('img.lit')${t('!')};
  const canvas = root.querySelector${t('<HTMLCanvasElement>')}('canvas')${t('!')};
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  const mctx = mask.getContext('2d');
  const sprite = glow();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let size = { w: 0, h: 0, dpr: 1 };
  let target = { x: 0, y: 0 };
  let spot = { x: 0, y: 0 };
  let last = { x: 0, y: 0 };
  let trail${t(': { x: number; y: number; t: number; seed: number }[]')} = [];
  let seeds = 0;
  let pointed = -Infinity;
  let clock = 0;
  let visible = false;
  let frame = 0;
  let then = 0;

  if (!ctx || !mctx) {
    root.dataset.mode = 'mask';
    root.style.setProperty('--r', radius * 1.6 + 'px');
  }

  function resize() {
    const dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
    size = { w: root.clientWidth, h: root.clientHeight, dpr };
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    mask.width = Math.max(1, Math.round(size.w * MASK_SCALE));
    mask.height = Math.max(1, Math.round(size.h * MASK_SCALE));
    if (!trail.length) {
      spot = { x: size.w / 2, y: size.h / 2 };
      target = { ...spot };
      last = { ...spot };
    }
    wake();
  }

  function cover() {
    const iw = lit.naturalWidth;
    const ih = lit.naturalHeight;
    const scale = Math.max(size.w / iw, size.h / ih);
    return { x: (size.w - iw * scale) / 2, y: (size.h - ih * scale) / 2, w: iw * scale, h: ih * scale };
  }

  function drift() {
    if (reduced) {
      return { x: size.w / 2, y: size.h / 2 };
    }
    return {
      x: size.w / 2 + size.w * DRIFT.x * Math.sin(clock * DRIFT.fx),
      y: size.h / 2 + size.h * DRIFT.y * Math.sin(clock * DRIFT.fy + 1)
    };
  }

  function stamp(g${t(': CanvasRenderingContext2D')}, x${t(': number')}, y${t(': number')}, extent${t(': number')}, alpha${t(': number')}) {
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(sprite, x - extent, y - extent, extent * 2, extent * 2);
  }

  function lay() {
    const step = radius * SPACING;
    const dx = spot.x - last.x;
    const dy = spot.y - last.y;
    const steps = Math.floor(Math.hypot(dx, dy) / step);
    if (!steps) {
      return;
    }
    for (let i = 1; i <= steps; i++) {
      trail.push({ x: last.x + (dx * i) / steps, y: last.y + (dy * i) / steps, t: clock, seed: seeds++ });
    }
    last = { ...spot };
  }

  function light(g${t(': CanvasRenderingContext2D')}) {
    const time = reduced ? 0 : clock;
    for (const point of trail) {
      const age = (clock - point.t) / TRAIL;
      const x = point.x + radius * 0.3 * wobble(time, point.seed);
      const y = point.y + radius * 0.3 * wobble(time, point.seed + 9);
      stamp(g, x, y, radius * (0.9 + 0.3 * wobble(time, point.seed + 4)), DEPOSIT * fade(age));
    }
    for (const blob of BLOBS) {
      const x = spot.x + radius * blob.reach * wobble(time, blob.seed);
      const y = spot.y + radius * blob.reach * wobble(time, blob.seed + 7);
      const extent = radius * 1.6 * blob.size * (1 + 0.15 * wobble(time, blob.seed + 3));
      stamp(g, x, y, extent, blob.alpha);
    }
  }

  function paint() {
    if (!ctx || !mctx) {
      root.style.setProperty('--x', spot.x + 'px');
      root.style.setProperty('--y', spot.y + 'px');
      return;
    }
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, size.w, size.h);
    if (!lit.complete || !lit.naturalWidth) {
      return;
    }
    mctx.setTransform(MASK_SCALE, 0, 0, MASK_SCALE, 0, 0);
    mctx.globalAlpha = 1;
    mctx.clearRect(0, 0, size.w, size.h);
    light(mctx);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(mask, 0, 0, size.w, size.h);
    ctx.globalCompositeOperation = 'source-in';
    const box = cover();
    ctx.drawImage(lit, box.x, box.y, box.w, box.h);
  }

  function tick(now${t(': number')}) {
    frame = 0;
    const dt = Math.min(MAX_STEP, (now - then) / 1000 || 0);
    then = now;
    clock += dt;
    if (clock - pointed > IDLE) {
      target = drift();
    }
    const pull = reduced ? 1 : 1 - Math.exp(-EASE * dt);
    spot = { x: spot.x + (target.x - spot.x) * pull, y: spot.y + (target.y - spot.y) * pull };
    trail = reduced ? [] : trail.filter((point) => clock - point.t < TRAIL);
    if (!reduced) {
      lay();
    }
    paint();
    if (!reduced) {
      wake();
    }
  }

  function wake() {
    if (!frame && visible && !document.hidden) {
      then = then || performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function sleep() {
    cancelAnimationFrame(frame);
    frame = 0;
    then = 0;
  }

  function onMove(event${t(': PointerEvent')}) {
    const box = root.getBoundingClientRect();
    target = { x: event.clientX - box.left, y: event.clientY - box.top };
    pointed = clock;
    wake();
  }

  function onLeave() {
    pointed = clock;
  }

  function onVisibility() {
    if (document.hidden) {
      sleep();
      return;
    }
    wake();
  }

  const sight = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      wake();
      return;
    }
    sleep();
  });
  const watch = new ResizeObserver(resize);

  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerdown', onMove);
  root.addEventListener('pointerleave', onLeave);
  lit.addEventListener('load', wake);
  document.addEventListener('visibilitychange', onVisibility);
  sight.observe(root);
  watch.observe(root);

  return () => {
    sleep();
    sight.disconnect();
    watch.disconnect();
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerdown', onMove);
    root.removeEventListener('pointerleave', onLeave);
    lit.removeEventListener('load', wake);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}`;
};

const pad = (text, n) =>
  text
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

const shell = (root, close) => `<section class="fl-hover-reveal" data-theme="dark" data-radius="${RADIUS}"${root}>
  <img class="dark" src="${DARK.src}" srcset="${DARK.srcset}" sizes="100vw" alt="${ALT}"${close}>
  <img class="lit" src="${LIT.src}" srcset="${LIT.srcset}" sizes="100vw" alt="" aria-hidden="true"${close}>
  <canvas aria-hidden="true"></canvas>
  <div class="overlay"><h2>${HEADING}</h2></div>
</section>`;

const jsx = (markup) => markup.replace(/class="/g, 'className="').replace(/srcset=/g, 'srcSet=');

const boot = (typed) => `${ENGINE(typed)}

document.querySelectorAll${typed ? '<HTMLElement>' : ''}('.fl-hover-reveal:not([data-ready])').forEach((root) => {
  root.setAttribute('data-ready', '');
  reveal(root);
});`;

export const hoverReveal = {
  id: 'hover-reveal',
  name: 'Hover reveal',
  description: 'A full-bleed dark scene where a soft spotlight follows the cursor or finger and reveals the lit scene, with a fading trail.',
  category: 'section',
  tags: ['image', 'hover', 'reveal', 'interactive'],
  tier: 'pro',
  preview: 'https://www.feega.app/templates-shots/hover-reveal-light.webp',
  mods: [],
  css,
  files: (C) => ({
    html: `${shell('', '')}\n\n<script>\n(() => {\n${pad(boot(false), 2)}\n})();\n</script>\n`,
    astro: `---
---

${shell('', ' /')}

<script>
${boot(true)}
</script>

<style is:global>
${C}</style>
`,
    svelte: `<script lang="ts">
${pad(ENGINE(true), 2)}

  let root: HTMLElement;

  $effect(() => reveal(root));
</script>

${shell(' bind:this={root}', ' /')}

<style>
  :global {
${pad(C, 4)}  }
</style>
`,
    react: `import { useEffect, useRef } from 'react';
import './HoverReveal.css';

${ENGINE(true)}

export function HoverReveal() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => (root.current ? reveal(root.current) : undefined), []);

  return (
${pad(jsx(shell(' ref={root}', ' /')), 4)}
  );
}
`,
    vue: `<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

${ENGINE(true)}

const root = ref<HTMLElement | null>(null);
let stop = () => {};

onMounted(() => {
  stop = reveal(root.value as HTMLElement);
});
onBeforeUnmount(() => stop());
</script>

<template>
${pad(shell(' ref="root"', ' /'), 2)}
</template>

<style>
${C}</style>
`
  })
};

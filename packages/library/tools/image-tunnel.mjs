const HEADING = 'welcome to the tunnel';
const TEXT = 'click to pause, press and hold to speed up';
const CARDS = 16;
const TONES = 4;
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const SPEED = 0.9;
const BOOST = 5;
const ALTS = Array.from({ length: CARDS }, (_, i) => `Placeholder image ${(i % 8) + 1}`);

const css = [
  '.fl-image-tunnel{position:relative;background:var(--feega-bg);color:var(--feega-fg);user-select:none;-webkit-user-select:none;touch-action:manipulation;cursor:pointer}',
  '.fl-image-tunnel .stage{position:relative;height:clamp(30rem,90svh,52rem);overflow:hidden;contain:paint;perspective-origin:50% 50%}',
  '.fl-image-tunnel .world{position:absolute;top:50%;left:50%;width:0;height:0;transform-style:preserve-3d}',
  '.fl-image-tunnel .wall,.fl-image-tunnel .card{position:absolute;will-change:transform}',
  '.fl-image-tunnel .wall{--line:linear-gradient(var(--feega-line-strong) 1px,transparent 1px);--rule:linear-gradient(90deg,var(--feega-line-strong) 1px,transparent 1px);background-image:var(--line),var(--rule)}',
  '.fl-image-tunnel .floor,.fl-image-tunnel .ceiling{background-size:calc(100% / 6 - 0.1px) var(--cell)}',
  '.fl-image-tunnel .left,.fl-image-tunnel .right{background-size:var(--cell) calc(100% / 4 - 0.1px)}',
  '.fl-image-tunnel .floor{-webkit-mask-image:linear-gradient(to top,var(--feega-fg) 55%,transparent);mask-image:linear-gradient(to top,var(--feega-fg) 55%,transparent)}',
  '.fl-image-tunnel .ceiling{-webkit-mask-image:linear-gradient(to bottom,var(--feega-fg) 55%,transparent);mask-image:linear-gradient(to bottom,var(--feega-fg) 55%,transparent)}',
  '.fl-image-tunnel .left{-webkit-mask-image:linear-gradient(to right,var(--feega-fg) 55%,transparent);mask-image:linear-gradient(to right,var(--feega-fg) 55%,transparent)}',
  '.fl-image-tunnel .right{-webkit-mask-image:linear-gradient(to left,var(--feega-fg) 55%,transparent);mask-image:linear-gradient(to left,var(--feega-fg) 55%,transparent)}',
  '.fl-image-tunnel .card{margin:0;overflow:hidden;border-radius:var(--feega-radius-sm);opacity:0;will-change:transform,opacity}',
  '.fl-image-tunnel .card img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}',
  '.fl-image-tunnel .card[data-tone="0"]{background:linear-gradient(160deg,var(--feega-accent),var(--feega-accent-soft))}',
  '.fl-image-tunnel .card[data-tone="1"]{background:linear-gradient(200deg,var(--feega-fg-subtle),var(--feega-raised))}',
  '.fl-image-tunnel .card[data-tone="2"]{background:linear-gradient(135deg,var(--feega-accent-soft),var(--feega-line-strong))}',
  '.fl-image-tunnel .card[data-tone="3"]{background:radial-gradient(circle at 30% 30%,var(--feega-fg-muted),var(--feega-surface))}',
  '.fl-image-tunnel .overlay{position:absolute;inset:0;display:grid;place-content:center;gap:var(--feega-space-3);padding:var(--feega-gutter);text-align:center;pointer-events:none}',
  '.fl-image-tunnel h2{font-family:var(--feega-font-display);font-size:var(--feega-text-title);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}',
  '.fl-image-tunnel .overlay p{color:var(--feega-fg-muted);font-size:var(--feega-text-sm);text-wrap:balance}'
];

const t = (typed, s) => (typed ? s : '');

const engine = (typed) => `const DEFAULT_SPEED = ${SPEED};
const DEFAULT_BOOST = ${BOOST};
const WALLS = ['left', 'right', 'floor', 'ceiling'];
const LANES = [-0.4, 0.35, -0.1, 0.4];
const DEPTH = 10;
const RINGS = 20;
const EASE = 4;
const MAX_STEP = 0.1;
const HOLD_MS = 250;
const SETTLED = 0.001;
const FADE = 0.4;
const INSET = 1;

function tunnel(root${t(typed, ': HTMLElement')})${t(typed, ': () => void')} {
  const stage = root.querySelector('.stage')${t(typed, ' as HTMLElement')};
  const walls = [...root.querySelectorAll${t(typed, '<HTMLElement>')}('.wall')];
  const cards = [...root.querySelectorAll${t(typed, '<HTMLElement>')}('.card')];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pace = Number(root.dataset.speed) || DEFAULT_SPEED;
  const boost = Number(root.dataset.boost) || DEFAULT_BOOST;

  let hw = 0;
  let hh = 0;
  let depth = 0;
  let cell = 0;
  let span = 0;
  let offset = 0;
  let speed = 1;
  let paused = false;
  let held = false;
  let pressedAt = 0;
  let visible = true;
  let frame = 0;
  let last = 0;

  function pose(wall${t(typed, ': string')}, lane${t(typed, ': number')}, z${t(typed, ': number')}, inset${t(typed, ': number')})${t(typed, ': string')} {
    if (wall === 'left') {
      return \`translate3d(\${inset - hw}px,\${lane * hh}px,\${z}px) rotateY(90deg)\`;
    }
    if (wall === 'right') {
      return \`translate3d(\${hw - inset}px,\${lane * hh}px,\${z}px) rotateY(-90deg)\`;
    }
    if (wall === 'floor') {
      return \`translate3d(\${lane * hw}px,\${hh - inset}px,\${z}px) rotateX(90deg)\`;
    }
    return \`translate3d(\${lane * hw}px,\${inset - hh}px,\${z}px) rotateX(-90deg)\`;
  }

  function size(el${t(typed, ': HTMLElement')}, w${t(typed, ': number')}, h${t(typed, ': number')}) {
    el.style.width = \`\${w}px\`;
    el.style.height = \`\${h}px\`;
    el.style.left = \`\${-w / 2}px\`;
    el.style.top = \`\${-h / 2}px\`;
  }

  function measure() {
    hw = stage.clientWidth / 2;
    hh = stage.clientHeight / 2;
    depth = hh * DEPTH;
    cell = depth / RINGS;
    span = depth + cell * 2;
    stage.style.perspective = \`\${Math.max(hw, hh) * 1.1}px\`;
    root.style.setProperty('--cell', \`\${cell}px\`);

    walls.forEach((el) => {
      const side = el.dataset.wall === 'left' || el.dataset.wall === 'right';
      size(el, side ? span : hw * 2, side ? hh * 2 : span);
    });
    cards.forEach((el, i) => {
      const side = i % WALLS.length < 2;
      size(el, side ? hh * 0.62 : hw * 0.5, side ? hh * 0.86 : hw * 0.34);
    });
  }

  function place() {
    const shift = offset % cell;
    walls.forEach((el) => {
      el.style.transform = pose(el.dataset.wall ?? '', 0, shift - depth / 2, 0);
    });
    cards.forEach((el, i) => {
      const z = ((i / cards.length) * span + offset) % span - depth;
      const lane = LANES[Math.floor(i / WALLS.length) % LANES.length];
      el.style.transform = pose(WALLS[i % WALLS.length], lane, z, INSET);
      el.style.opacity = String(Math.min(1, Math.max(0, (z + depth) / (depth * FADE))));
    });
  }

  function tick(now${t(typed, ': number')}) {
    const step = Math.min(MAX_STEP, (now - last) / 1000);
    last = now;
    const goal = held ? boost : paused ? 0 : 1;
    speed += (goal - speed) * Math.min(1, step * EASE);
    offset += speed * pace * hh * step;
    place();
    frame = 0;
    if (goal === 0 && speed < SETTLED) {
      speed = 0;
      return;
    }
    start();
  }

  function start() {
    if (frame || still || !visible || document.hidden) {
      return;
    }
    if (!last || performance.now() - last > MAX_STEP * 1000) {
      last = performance.now();
    }
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  }

  function toggle() {
    paused = !paused;
    start();
  }

  function press() {
    held = true;
    pressedAt = performance.now();
    start();
  }

  function release() {
    if (!held) {
      return;
    }
    held = false;
    if (performance.now() - pressedAt < HOLD_MS) {
      paused = !paused;
    }
    start();
  }

  function key(event${t(typed, ': KeyboardEvent')}) {
    if (event.key !== ' ' && event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    toggle();
  }

  function sync() {
    if (document.hidden) {
      stop();
      return;
    }
    start();
  }

  const sizes = new ResizeObserver(() => {
    measure();
    place();
  });
  const view = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      start();
      return;
    }
    stop();
  });

  sizes.observe(stage);
  view.observe(root);
  root.addEventListener('pointerdown', press);
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('pointerleave', release);
  root.addEventListener('keydown', key);
  document.addEventListener('visibilitychange', sync);
  measure();
  place();
  start();

  return () => {
    stop();
    sizes.disconnect();
    view.disconnect();
    root.removeEventListener('pointerdown', press);
    root.removeEventListener('pointerup', release);
    root.removeEventListener('pointercancel', release);
    root.removeEventListener('pointerleave', release);
    root.removeEventListener('keydown', key);
    document.removeEventListener('visibilitychange', sync);
  };
}`;


const WALL_NAMES = ['left', 'right', 'floor', 'ceiling'];
const walls = (pad) => WALL_NAMES.map((w) => `${pad}<div class="wall ${w}" data-wall="${w}"></div>`).join('\n');

const img = (alt) => `<img src="${BLANK}" alt="${alt}" loading="lazy" decoding="async" />`;
const cards = ALTS.map((alt, i) => `      <figure class="card" data-tone="${i % TONES}">${img(alt)}</figure>`).join('\n');

const shell = (root) => `<section class="fl-image-tunnel" data-theme="dark" tabindex="0" aria-label="Image tunnel, press to pause" data-speed="${SPEED}" data-boost="${BOOST}"${root}>
  <div class="stage">
    <div class="world" aria-hidden="true">
${walls('      ')}
${cards}
    </div>
    <div class="overlay">
      <h2>${HEADING}</h2>
      <p>${TEXT}</p>
    </div>
  </div>
</section>`;

const pad = (text, n) =>
  text
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

const domBoot = (typed) => `${engine(typed)}

document.querySelectorAll${t(typed, '<HTMLElement>')}('.fl-image-tunnel:not([data-ready])').forEach((root) => {
  root.setAttribute('data-ready', '');
  tunnel(root);
});`;

const jsx = (markup) =>
  markup
    .replace(/class="/g, 'className="')
    .replace('tabindex="0"', 'tabIndex={0}')
    .replace(/<div className="wall ([a-z]+)" data-wall="([a-z]+)"><\/div>/g, '<div className="wall $1" data-wall="$2" />');

export const imageTunnel = {
  id: 'image-tunnel',
  name: 'Image tunnel',
  description: 'A 3D grid corridor of image cards that flies toward you forever. Click to pause, hold to speed up.',
  category: 'section',
  tags: ['gallery', '3d', 'tunnel', 'animation'],
  mods: [],
  css,
  files: (C) => ({
    html: `${shell('')}\n\n<script>\n(() => {\n${pad(domBoot(false), 2)}\n})();\n</script>\n`,
    astro: `---
---

${shell('')}

<script>
${domBoot(true)}
</script>

<style is:global>
${C}</style>
`,
    svelte: `<script lang="ts">
${pad(engine(true), 2)}

  let root: HTMLElement;

  $effect(() => tunnel(root));
</script>

${shell(' bind:this={root}')}

<style>
${C}</style>
`,
    react: `import { useEffect, useRef } from 'react';
import './ImageTunnel.css';

${engine(true)}

export function ImageTunnel() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => (root.current ? tunnel(root.current) : undefined), []);

  return (
${pad(jsx(shell(' ref={root}')), 4)}
  );
}
`,
    vue: `<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

${engine(true)}

const root = ref<HTMLElement | null>(null);
let stop = () => {};

onMounted(() => {
  stop = tunnel(root.value as HTMLElement);
});
onBeforeUnmount(() => stop());
</script>

<template>
${pad(shell(' ref="root"'), 2)}
</template>

<style scoped>
${C}</style>
`
  })
};

const ASSETS = 'https://www.feega.app/templates-assets/parallax-gallery';
const DRIFT = 24;
const INERTIA = 3.5;

const IMAGES = {
  '01': { w: 560, h: 440, alt: 'Glowing violet mushrooms in a night jungle' },
  '02': { w: 560, h: 442, alt: 'A starry sky through jungle branches' },
  '03': { w: 560, h: 527, alt: 'A waterfall in a moonlit jungle' },
  '04': { w: 560, h: 784, alt: 'Luminous blue grass stems' },
  '05': { w: 560, h: 805, alt: 'Glowing flower fronds at night' },
  '06': { w: 560, h: 560, alt: 'A teal planet over floating islands' },
  '07': { w: 560, h: 300, alt: 'A river under glowing plants' },
  '08': { w: 560, h: 436, alt: 'Pink mushrooms in violet light' },
  '09': { w: 560, h: 678, alt: 'An old tree at night' },
  '10': { w: 560, h: 593, alt: 'Ferns lit in teal' },
  '11': { w: 560, h: 420, alt: 'A red mushroom glowing at night' },
  '12': { w: 560, h: 402, alt: 'Green floating islands' }
};

const LAYOUT = {
  far: [
    ['11', 980, 120, 130],
    ['02', 360, 560, 110],
    ['06', 1700, 520, 96],
    ['03', 700, 1000, 120],
    ['01', 180, 1120, 140],
    ['10', 1180, 420, 100],
    ['08', 1500, 1180, 118],
    ['12', 560, 380, 120],
    ['05', 860, 820, 90]
  ],
  mid: [
    ['01', 560, 40, 210],
    ['03', 760, 330, 200],
    ['12', 1240, 20, 220],
    ['04', 420, 720, 180],
    ['10', 1560, 760, 200],
    ['06', 40, 820, 190],
    ['08', 1300, 1060, 210],
    ['11', 40, 470, 170],
    ['02', 620, 880, 190]
  ],
  near: [
    ['09', 140, 120, 300],
    ['05', 1020, 640, 270],
    ['07', 1480, 160, 320]
  ]
};

const css = [
  '.fl-parallax-gallery{position:relative;overflow:hidden;background:var(--feega-bg)}',
  '.fl-parallax-gallery .field{position:relative;height:clamp(30rem,80vh,54rem);overflow:hidden;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;contain:layout paint}',
  '.fl-parallax-gallery .field[data-dragging]{cursor:grabbing}',
  '.fl-parallax-gallery .field:focus-visible{outline-offset:-4px}',
  '.fl-parallax-gallery .field::before,.fl-parallax-gallery .field::after{content:"";position:absolute;inset:0;z-index:4;pointer-events:none}',
  '.fl-parallax-gallery .field::before{background:linear-gradient(90deg,var(--feega-bg),transparent 18%,transparent 82%,var(--feega-bg))}',
  '.fl-parallax-gallery .field::after{background:linear-gradient(180deg,var(--feega-bg),transparent 8%,transparent 92%,var(--feega-bg))}',
  '.fl-parallax-gallery .layer{position:absolute;top:0;left:0;width:1800px;height:1300px;transform-origin:0 0}',
  '.fl-parallax-gallery .card{position:absolute;margin:0;overflow:hidden;border-radius:var(--feega-radius-md);background:var(--feega-surface);will-change:transform}',
  '.fl-parallax-gallery .layer[data-depth="near"] .card{box-shadow:var(--feega-shadow)}',
  '.fl-parallax-gallery .card img{display:block;width:100%;height:auto;pointer-events:none}'
];

const ENGINE = (typed) => {
  const t = (annotation) => (typed ? annotation : '');
  return `const DEPTHS${t(': Record<string, number>')} = { far: 0.42, mid: 0.7, near: 1 };
const TILE = { w: 1800, h: 1300 };
const MARGIN = { x: 340, y: 420 };
const DESIGN_WIDTH = 1280;
const MIN_SCALE = 0.75;
const STILL = 30;
const RESUME = 1.4;
const KEY_PUSH = 900;
const MAX_STEP = 0.05;
const KEYS${t(': Record<string, [number, number]>')} = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

const wrap = (value${t(': number')}, size${t(': number')}) => ((value % size) + size) % size;

function gallery(root${t(': HTMLElement')})${t(': () => void')} {
  const field = root.querySelector${t('<HTMLElement>')}('.field')${t('!')};
  const layers = [...field.querySelectorAll${t('<HTMLElement>')}('.layer')];
  const speed = Number(root.dataset.drift ?? 0);
  const friction = Number(root.dataset.inertia ?? 1);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cards${t(': { el: HTMLElement; depth: number; x: number; y: number }[]')} = [];
  let scale = 1;
  let pan = { x: 0, y: 0 };
  let velocity = { x: 0, y: 0 };
  let drift = 0;
  let flow = reduced ? 0 : 1;
  let dragging = false;
  let last = { x: 0, y: 0, time: 0 };
  let visible = false;
  let frame = 0;
  let then = 0;

  function measure() {
    scale = Math.max(MIN_SCALE, field.clientWidth / DESIGN_WIDTH);
    cards = layers.flatMap((layer) => {
      layer.style.transform = 'scale(' + scale + ')';
      const depth = DEPTHS[layer.dataset.depth ?? 'near'] ?? 1;
      return [...layer.querySelectorAll${t('<HTMLElement>')}('.card')].map((el) => ({ el, depth, x: el.offsetLeft, y: el.offsetTop }));
    });
    place();
  }

  function place() {
    for (const c of cards) {
      const x = wrap(c.x + (pan.x * c.depth) / scale + MARGIN.x, TILE.w) - MARGIN.x - c.x;
      const y = wrap(c.y + ((pan.y + drift) * c.depth) / scale + MARGIN.y, TILE.h) - MARGIN.y - c.y;
      c.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    }
  }

  const idle = () => reduced && !dragging && Math.hypot(velocity.x, velocity.y) < 1;

  function tick(now${t(': number')}) {
    frame = 0;
    const dt = Math.min(MAX_STEP, (now - then) / 1000 || 0);
    then = now;
    if (!dragging) {
      pan.x += velocity.x * dt;
      pan.y += velocity.y * dt;
      const decay = Math.exp(-friction * dt);
      velocity.x *= decay;
      velocity.y *= decay;
    }
    const target = reduced || dragging || Math.hypot(velocity.x, velocity.y) > STILL ? 0 : 1;
    flow += (target - flow) * Math.min(1, dt * RESUME);
    drift -= speed * flow * dt;
    place();
    if (!idle()) {
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

  function onDown(event${t(': PointerEvent')}) {
    if (event.button !== 0) {
      return;
    }
    dragging = true;
    velocity = { x: 0, y: 0 };
    last = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    field.setPointerCapture(event.pointerId);
    field.dataset.dragging = '';
    wake();
  }

  function onMove(event${t(': PointerEvent')}) {
    if (!dragging) {
      return;
    }
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    const dt = Math.max(1, event.timeStamp - last.time) / 1000;
    pan.x += dx;
    pan.y += dy;
    velocity = { x: velocity.x * 0.6 + (dx / dt) * 0.4, y: velocity.y * 0.6 + (dy / dt) * 0.4 };
    last = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    place();
  }

  function onUp() {
    if (!dragging) {
      return;
    }
    dragging = false;
    delete field.dataset.dragging;
    wake();
  }

  function onKey(event${t(': KeyboardEvent')}) {
    const push = KEYS[event.key];
    if (!push) {
      return;
    }
    event.preventDefault();
    velocity = { x: velocity.x + push[0] * KEY_PUSH, y: velocity.y + push[1] * KEY_PUSH };
    wake();
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
  const resize = new ResizeObserver(() => measure());

  field.addEventListener('pointerdown', onDown);
  field.addEventListener('pointermove', onMove);
  field.addEventListener('pointerup', onUp);
  field.addEventListener('pointercancel', onUp);
  field.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  sight.observe(field);
  resize.observe(field);
  measure();

  return () => {
    sleep();
    sight.disconnect();
    resize.disconnect();
    field.removeEventListener('pointerdown', onDown);
    field.removeEventListener('pointermove', onMove);
    field.removeEventListener('pointerup', onUp);
    field.removeEventListener('pointercancel', onUp);
    field.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    for (const c of cards) {
      c.el.style.transform = '';
    }
  };
}`;
};

const LABEL = 'Image gallery. Drag, swipe or use the arrow keys to move it.';

const HTML_CARD = { cls: 'class', style: (l, t, w) => `style="left:${l}px;top:${t}px;width:${w}px"`, img: '>' };
const JSX_CARD = { cls: 'className', style: (l, t, w) => `style={{ left: ${l}, top: ${t}, width: ${w} }}`, img: ' />' };

const card = (dialect, [id, left, top, width]) => {
  const image = IMAGES[id];
  return `<figure ${dialect.cls}="card" ${dialect.style(left, top, width)}><img src="${ASSETS}/${id}.webp" width="${image.w}" height="${image.h}" alt="${image.alt}" draggable="false" decoding="async"${dialect.img}</figure>`;
};

const field = (dialect, tabindex) => `<div ${dialect.cls}="field" role="application" ${tabindex} aria-label="${LABEL}">
${Object.entries(LAYOUT)
  .map(([depth, cards]) => `  <div ${dialect.cls}="layer" data-depth="${depth}">\n${cards.map((c) => `    ${card(dialect, c)}`).join('\n')}\n  </div>`)
  .join('\n')}
</div>`;

const pad = (text, n) =>
  text
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

const ROOT = `class="fl-parallax-gallery" aria-label="Gallery" data-drift="${DRIFT}" data-inertia="${INERTIA}"`;
const FIELD = pad(field(HTML_CARD, 'tabindex="0"'), 2).trimStart();
const shell = (extra = '') => `<section ${ROOT}${extra}>\n  ${FIELD}\n</section>`;

const boot = (typed) => `${ENGINE(typed)}

document.querySelectorAll${typed ? '<HTMLElement>' : ''}('.fl-parallax-gallery:not([data-ready])').forEach((root) => {
  root.setAttribute('data-ready', '');
  gallery(root);
});`;

export const parallaxGallery = {
  id: 'parallax-gallery',
  name: 'Parallax gallery',
  description: 'An endless, airy field of image cards at three depths that drift on their own and pan with drag, touch or arrow keys.',
  category: 'section',
  tags: ['gallery', 'parallax', 'drag', 'animation'],
  tier: 'pro',
  preview: 'https://www.feega.app/templates-shots/parallax-gallery-light.webp',
  mods: [],
  css,
  files: (C) => ({
    html: `${shell()}\n\n<script>\n(() => {\n${pad(boot(false), 2)}\n})();\n</script>\n`,
    astro: `---\n---\n\n${shell()}\n\n<script>\n${boot(true)}\n</script>\n\n<style is:global>\n${C}</style>\n`,
    svelte: `<script lang="ts">
${pad(ENGINE(true), 2)}

  let root: HTMLElement;

  $effect(() => gallery(root));
</script>

${shell(' bind:this={root}')}

<style>
  :global {
${pad(C, 4)}  }
</style>
`,
    react: `import { useEffect, useRef } from 'react';
import './ParallaxGallery.css';

${ENGINE(true)}

export function ParallaxGallery() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => (root.current ? gallery(root.current) : undefined), []);

  return (
    <section ref={root} className="fl-parallax-gallery" aria-label="Gallery" data-drift="${DRIFT}" data-inertia="${INERTIA}">
${pad(field(JSX_CARD, 'tabIndex={0}'), 6)}
    </section>
  );
}
`,
    vue: `<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

${ENGINE(true)}

const root = ref<HTMLElement | null>(null);
let stop = () => {};

onMounted(() => {
  if (root.value) {
    stop = gallery(root.value);
  }
});

onBeforeUnmount(() => stop());
</script>

<template>
${pad(shell(' ref="root"'), 2)}
</template>

<style>
${C}</style>
`
  })
};

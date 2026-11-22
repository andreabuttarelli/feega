const css = [
  '.fl-parallax-gallery{position:relative;overflow:hidden;background:var(--feega-bg)}',
  '.fl-parallax-gallery .field{position:relative;height:clamp(30rem,80vh,54rem);overflow:hidden;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;contain:layout paint}',
  '.fl-parallax-gallery .field[data-dragging]{cursor:grabbing}',
  '.fl-parallax-gallery .field:focus-visible{outline-offset:-4px}',
  '.fl-parallax-gallery .field::before,.fl-parallax-gallery .field::after{content:"";position:absolute;inset:0;z-index:4;pointer-events:none}',
  '.fl-parallax-gallery .field::before{background:linear-gradient(90deg,var(--feega-bg),transparent 14%,transparent 86%,var(--feega-bg))}',
  '.fl-parallax-gallery .field::after{background:linear-gradient(180deg,var(--feega-bg),transparent 7%,transparent 93%,var(--feega-bg))}',
  '.fl-parallax-gallery .layer{position:absolute;inset:0}',
  '.fl-parallax-gallery .card{position:absolute;top:0;left:0;overflow:hidden;border-radius:var(--feega-radius-md);background:var(--feega-surface)}',
  '.fl-parallax-gallery .layer[data-depth="2"] .card{box-shadow:var(--feega-shadow)}',
  '.fl-parallax-gallery .card img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}',
  '.fl-parallax-gallery .card[data-tone="0"]{background:linear-gradient(135deg,var(--feega-accent-soft),var(--feega-surface))}',
  '.fl-parallax-gallery .card[data-tone="1"]{background:linear-gradient(160deg,var(--feega-success-soft),var(--feega-raised))}',
  '.fl-parallax-gallery .card[data-tone="2"]{background:linear-gradient(200deg,var(--feega-surface),var(--feega-line-strong))}',
  '.fl-parallax-gallery .card[data-tone="3"]{background:linear-gradient(120deg,var(--feega-danger-soft),var(--feega-accent-soft))}'
];

const ENGINE = (typed) => {
  const t = (annotation) => (typed ? annotation : '');
  return `${typed ? 'type GalleryImage = { src: string; alt: string };\n\n' : ''}const LAYERS = [
  { depth: 0.55, width: 0.5, speed: 0.55 },
  { depth: 0.78, width: 0.66, speed: 0.78 },
  { depth: 1, width: 0.82, speed: 1 }
];
const VISIBLE_COLUMNS = 6;
const MIN_PITCH = 120;
const RATIOS = [1.25, 0.8, 1.5, 1, 0.75, 1.33];
const TONES = 4;
const GAP = 0.18;
const DRIFT = 26;
const FRICTION = 3.5;
const STILL = 30;
const RESUME = 1.4;
const KEY_PUSH = 900;
const MAX_STEP = 0.05;
const KEYS${t(': Record<string, [number, number]>')} = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

const wrap = (value${t(': number')}, size${t(': number')}) => ((value % size) + size) % size;

function gallery(root${t(': HTMLElement')}, images${t(': GalleryImage[]')})${t(': () => void')} {
  const field = root.querySelector${t('<HTMLElement>')}('.field')${t('!')};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cards${t(': { el: HTMLElement; layer: number; x: number; y: number; h: number; wrap: number; span: number; margin: number; flow: number }[]')} = [];
  let pan = { x: 0, y: 0 };
  let velocity = { x: 0, y: 0 };
  let drift = 0;
  let flow = reduced ? 0 : 1;
  let dragging = false;
  let last = { x: 0, y: 0, time: 0 };
  let visible = false;
  let frame = 0;
  let then = 0;

  function card(index${t(': number')}, width${t(': number')}, height${t(': number')})${t(': HTMLElement')} {
    const el = document.createElement('div');
    el.className = 'card';
    el.style.width = width + 'px';
    el.style.height = height + 'px';
    const image = images.length ? images[index % images.length] : null;
    if (!image) {
      el.dataset.tone = String(index % TONES);
      return el;
    }
    const img = document.createElement('img');
    img.src = image.src;
    img.alt = image.alt;
    img.draggable = false;
    img.loading = 'lazy';
    el.append(img);
    return el;
  }

  function build() {
    const width = field.clientWidth;
    const height = field.clientHeight;
    const pitch = Math.max(MIN_PITCH, width / VISIBLE_COLUMNS) * LAYERS.length / 2;
    const columns = Math.ceil(width / pitch) + 2;
    cards = [];
    field.replaceChildren(
      ...LAYERS.map((layer, l) => {
        const el = document.createElement('div');
        el.className = 'layer';
        el.dataset.depth = String(l);
        const w = (pitch * layer.width * 2) / LAYERS.length;
        for (let c = 0; c < columns; c++) {
          const column = [];
          let y = 0;
          for (let k = 0; y < height + w * 3; k++) {
            const h = w * RATIOS[(c * 2 + k + l) % RATIOS.length];
            column.push({ y, h, index: l * 17 + c * 5 + k });
            y += h + w * GAP;
          }
          for (const entry of column) {
            const node = card(entry.index, w, entry.h);
            el.append(node);
            cards.push({ el: node, layer: l, x: c * pitch + (l * pitch * 2) / LAYERS.length / 2 + ((l % 2) * pitch) / 2, y: entry.y - ((c + l) % 3) * w * 0.4, h: entry.h, wrap: y, span: columns * pitch, margin: pitch, flow: 1 + 0.12 * ((c % 3) - 1) });
          }
        }
        return el;
      })
    );
    place();
  }

  function place() {
    for (const c of cards) {
      const layer = LAYERS[c.layer];
      const x = wrap(c.x + pan.x * layer.depth + c.margin, c.span) - c.margin;
      const y = wrap(c.y + (pan.y + drift * layer.speed * c.flow) * layer.depth + c.h, c.wrap) - c.h;
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
      const decay = Math.exp(-FRICTION * dt);
      velocity.x *= decay;
      velocity.y *= decay;
    }
    const target = reduced || dragging || Math.hypot(velocity.x, velocity.y) > STILL ? 0 : 1;
    flow += (target - flow) * Math.min(1, dt * RESUME);
    drift -= DRIFT * flow * dt;
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
  const resize = new ResizeObserver(() => build());

  field.addEventListener('pointerdown', onDown);
  field.addEventListener('pointermove', onMove);
  field.addEventListener('pointerup', onUp);
  field.addEventListener('pointercancel', onUp);
  field.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  sight.observe(field);
  resize.observe(field);
  build();

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
    field.replaceChildren();
  };
}`;
};

const FIELD = '<div class="field" role="application" tabindex="0" aria-label="Image gallery. Drag, swipe or use the arrow keys to move it."></div>';

const shell = (attrs) => `<section class="fl-parallax-gallery" aria-label="Gallery"${attrs}>
  ${FIELD}
</section>`;

const pad = (text, n) =>
  text
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

const boot = (typed) => `${ENGINE(typed)}

document.querySelectorAll${typed ? '<HTMLElement>' : ''}('.fl-parallax-gallery:not([data-ready])').forEach((root) => {
  root.setAttribute('data-ready', '');
  gallery(root, JSON.parse(root.dataset.images || '[]'));
});`;

export const parallaxGallery = {
  id: 'parallax-gallery',
  name: 'Parallax gallery',
  description: 'An endless field of image cards in columns at three depths that drift on their own and pan with drag, touch or arrow keys.',
  category: 'section',
  tags: ['gallery', 'parallax', 'drag', 'animation'],
  tier: 'pro',
  preview: 'https://www.feega.app/templates-shots/parallax-gallery-light.webp',
  mods: [],
  css,
  files: (C) => ({
    html: `${shell(` data-images='[]'`)}\n\n<script>\n(() => {\n${pad(boot(false), 2)}\n})();\n</script>\n`,
    astro: `---\nconst { images = [] } = Astro.props;\n---\n\n${shell(' data-images={JSON.stringify(images)}')}\n\n<script>\n${boot(true)}\n</script>\n\n<style is:global>\n${C}</style>\n`,
    svelte: `<script lang="ts">
${pad(ENGINE(true), 2)}

  let { images = [] }: { images?: GalleryImage[] } = $props();

  let root: HTMLElement;

  $effect(() => gallery(root, images));
</script>

<section class="fl-parallax-gallery" aria-label="Gallery" bind:this={root}>
  ${FIELD}
</section>

<style>
  :global {
${pad(C, 4)}  }
</style>
`,
    react: `import { useEffect, useRef } from 'react';
import './ParallaxGallery.css';

${ENGINE(true)}

export function ParallaxGallery({ images = [] }: { images?: GalleryImage[] }) {
  const root = useRef<HTMLElement>(null);

  useEffect(() => (root.current ? gallery(root.current, images) : undefined), [images]);

  return (
    <section ref={root} className="fl-parallax-gallery" aria-label="Gallery">
      <div className="field" role="application" tabIndex={0} aria-label="Image gallery. Drag, swipe or use the arrow keys to move it."></div>
    </section>
  );
}
`,
    vue: `<script setup lang="ts">
import { ref, watchEffect } from 'vue';

${ENGINE(true)}

const props = withDefaults(defineProps<{ images?: GalleryImage[] }>(), { images: () => [] });

const root = ref<HTMLElement | null>(null);

watchEffect(
  (onCleanup) => {
    if (root.value) {
      onCleanup(gallery(root.value, props.images));
    }
  },
  { flush: 'post' }
);
</script>

<template>
  <section ref="root" class="fl-parallax-gallery" aria-label="Gallery">
    ${FIELD}
  </section>
</template>

<style>
${C}</style>
`
  })
};

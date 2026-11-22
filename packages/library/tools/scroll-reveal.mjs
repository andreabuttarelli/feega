const PARAS = [
  'This is placeholder copy. Replace it with a short statement about what your product does and who it is for.',
  'Each word lights up as the reader scrolls, so keep the sentences short and the ideas clear.',
  'Scroll back up and the text fades again. Swap these lines for your own words.'
];

const css = [
  '.fl-scroll-reveal-text{padding-block:var(--feega-space-section)}',
  '.fl-scroll-reveal-text .reveal{--p:0;--dim:0.22;--edge:4;display:grid;gap:var(--feega-space-8);max-width:56rem;margin-inline:auto;text-align:center;font-family:var(--feega-font-display);font-size:clamp(1.625rem,4.2vw,3.25rem);font-weight:500;line-height:1.12;letter-spacing:var(--feega-tracking-tight)}',
  '.fl-scroll-reveal-text .reveal[data-reveal="char"]{--edge:14}',
  '.fl-scroll-reveal-text .reveal p{text-wrap:balance;overflow-wrap:anywhere}',
  '.fl-scroll-reveal-text .w{display:inline-block;white-space:nowrap}',
  '.fl-scroll-reveal-text .u{opacity:clamp(var(--dim),calc(var(--dim) + (1 - var(--dim)) * (var(--p) * (var(--n) + var(--edge)) - var(--i)) / var(--edge)),1)}',
  '.fl-scroll-reveal-text .sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}',
  '@media (prefers-reduced-motion:reduce){.fl-scroll-reveal-text .u{opacity:1}}'
];


const track = (typed) => `const START = 0.8;
const END = 0.4;

function track(root${typed ? ': HTMLElement' : ''})${typed ? ': () => void' : ''} {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.style.setProperty('--p', '1');
    return () => {};
  }

  let frame = 0;

  function update() {
    frame = 0;
    const rect = root.getBoundingClientRect();
    const raw = (innerHeight * START - rect.top) / (rect.height + innerHeight * (START - END));
    root.style.setProperty('--p', String(Math.min(1, Math.max(0, raw))));
  }

  function schedule() {
    if (!frame) {
      frame = requestAnimationFrame(update);
    }
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();

  return () => {
    removeEventListener('scroll', schedule);
    removeEventListener('resize', schedule);
    cancelAnimationFrame(frame);
  };
}`;

const domScript = (typed) => `${track(typed)}

function build(root${typed ? ': HTMLElement' : ''}, reveal${typed ? ': string' : ''}) {
  let i = 0;

  root.querySelectorAll('p').forEach((p) => {
    const text = (p.textContent ?? '').trim();
    const hidden = document.createElement('span');
    hidden.setAttribute('aria-hidden', 'true');

    text.split(' ').forEach((word, index, all) => {
      const w = document.createElement('span');
      w.className = 'w';
      (reveal === 'char' ? [...word] : [word]).forEach((t) => {
        const u = document.createElement('span');
        u.className = 'u';
        u.textContent = t;
        u.style.setProperty('--i', String(i++));
        w.append(u);
      });
      hidden.append(w);
      if (index < all.length - 1) {
        hidden.append(' ');
      }
    });

    const sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = text;
    p.replaceChildren(sr, hidden);
  });

  root.style.setProperty('--n', String(i));
}

function mount(root${typed ? ': HTMLElement' : ''})${typed ? ': () => void' : ''} {
  if (!root.hasAttribute('data-ready')) {
    root.setAttribute('data-ready', '');
    build(root, root.dataset.reveal === 'char' ? 'char' : 'word');
  }
  return track(root);
}`;

const boot = (typed) => `document.querySelectorAll${typed ? '<HTMLElement>' : ''}('.fl-scroll-reveal-text .reveal:not([data-ready])').forEach((root) => {
  mount(root);
});`;


const shell = (root) => `<section class="fl-scroll-reveal-text">
  <div class="fl-container">
    <div class="reveal" data-reveal="word"${root}>
${PARAS.map((p) => `      <p>${p}</p>`).join('\n')}
    </div>
  </div>
</section>`;

const pad = (text, n) =>
  text
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

const jsx = (markup) => markup.replace(/class="/g, 'className="');

export const scrollReveal = {
  id: 'scroll-reveal-text',
  name: 'Scroll reveal text',
  description: 'Large centred paragraphs that light up word by word, or letter by letter, as you scroll.',
  category: 'section',
  tags: ['text', 'scroll', 'animation'],
  mods: ['container'],
  css,
  files: (C) => ({
    html: `${shell('')}\n\n<script>\n(() => {\n${pad(domScript(false), 2)}\n\n${pad(boot(false), 2)}\n})();\n</script>\n`,
    astro: `---\n---\n\n${shell('')}\n\n<script>\n${domScript(true)}\n\n${boot(true)}\n</script>\n\n<style is:global>\n${C}</style>\n`,
    svelte: `<script lang="ts">
${pad(domScript(true), 2)}

  let root: HTMLElement;

  $effect(() => mount(root));
</script>

${shell(' bind:this={root}')}

<style>
${C}</style>
`,
    react: `import { useEffect, useRef } from 'react';
import './ScrollRevealText.css';

${domScript(true)}

export function ScrollRevealText() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => (root.current ? mount(root.current) : undefined), []);

  return (
${pad(jsx(shell(' ref={root}')), 4)}
  );
}
`,
    vue: `<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

${domScript(true)}

const root = ref<HTMLElement | null>(null);
let stop = () => {};

onMounted(() => {
  stop = mount(root.value as HTMLElement);
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

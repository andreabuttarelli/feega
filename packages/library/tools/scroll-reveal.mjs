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

const SPLIT = `type Unit = { t: string; i: number };
type Word = { units: Unit[] };
type Para = { text: string; words: Word[] };

function split(paras: string[], reveal: string): { paras: Para[]; total: number } {
  let i = 0;
  const out = paras.map((text) => ({
    text,
    words: text.split(' ').map((word) => ({
      units: (reveal === 'char' ? [...word] : [word]).map((t) => ({ t, i: i++ }))
    }))
  }));
  return { paras: out, total: i };
}`;

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

document.querySelectorAll${typed ? '<HTMLElement>' : ''}('.fl-scroll-reveal-text .reveal:not([data-ready])').forEach((root) => {
  root.setAttribute('data-ready', '');
  build(root, root.dataset.reveal === 'char' ? 'char' : 'word');
  track(root);
});`;

const plain = (attr) => `<section class="fl-scroll-reveal-text">
  <div class="fl-container">
    <div class="reveal" data-reveal=${attr}>
${PARAS.map((p) => `      <p>${p}</p>`).join('\n')}
    </div>
  </div>
</section>`;

const paraData = `const PARAS = [
${PARAS.map((p) => `  '${p}'`).join(',\n')}
];`;

const shell = (o) => `<section class="fl-scroll-reveal-text">
  <div class="fl-container">
    <div ${o.root}>
${o.paras}
    </div>
  </div>
</section>`;

const pad = (text, n) =>
  text
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

export const scrollReveal = {
  id: 'scroll-reveal-text',
  name: 'Scroll reveal text',
  description: 'Large centred paragraphs that light up word by word, or letter by letter, as you scroll.',
  category: 'section',
  tags: ['text', 'scroll', 'animation'],
  mods: ['container'],
  css,
  files: (C) => ({
    html: `${plain('"word"')}\n\n<script>\n(() => {\n${pad(domScript(false), 2)}\n})();\n</script>\n`,
    astro: `---\nconst { reveal = 'word' } = Astro.props;\n---\n\n${plain('{reveal}')}\n\n<script>\n${domScript(true)}\n</script>\n\n<style is:global>\n${C}</style>\n`,
    svelte: `<script lang="ts">
${pad(paraData, 2)}

${pad(SPLIT, 2)}

${pad(track(true), 2)}

  let { reveal = 'word' }: { reveal?: 'word' | 'char' } = $props();

  const view = $derived(split(PARAS, reveal));
  let root: HTMLElement;

  $effect(() => track(root));
</script>

${shell({
  root: 'class="reveal" data-reveal={reveal} style="--n:{view.total}" bind:this={root}',
  paras: `      {#each view.paras as para}
        <p><span class="sr">{para.text}</span><span aria-hidden="true">{#each para.words as word, k}<span class="w">{#each word.units as unit}<span class="u" style="--i:{unit.i}">{unit.t}</span>{/each}</span>{#if k < para.words.length - 1}{' '}{/if}{/each}</span></p>
      {/each}`
})}

<style>
${C}</style>
`,
    react: `import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import './ScrollRevealText.css';

${paraData}

${SPLIT}

${track(true)}

export function ScrollRevealText({ reveal = 'word' }: { reveal?: 'word' | 'char' }) {
  const root = useRef<HTMLDivElement>(null);
  const view = useMemo(() => split(PARAS, reveal), [reveal]);

  useEffect(() => (root.current ? track(root.current) : undefined), []);

  return (
${pad(
  shell({
    root: 'ref={root} className="reveal" data-reveal={reveal} style={{ \'--n\': view.total } as CSSProperties}',
    paras: `      {view.paras.map((para) => (
        <p key={para.text}>
          <span className="sr">{para.text}</span>
          <span aria-hidden="true">
            {para.words.map((word, k) => (
              <span key={word.units[0].i}>
                <span className="w">
                  {word.units.map((unit) => (
                    <span key={unit.i} className="u" style={{ '--i': unit.i } as CSSProperties}>{unit.t}</span>
                  ))}
                </span>
                {k < para.words.length - 1 ? ' ' : null}
              </span>
            ))}
          </span>
        </p>
      ))}`
  }),
  4
)}
  );
}
`,
    vue: `<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

${paraData}

${SPLIT}

${track(true)}

const props = withDefaults(defineProps<{ reveal?: 'word' | 'char' }>(), { reveal: 'word' });

const root = ref<HTMLElement | null>(null);
const view = computed(() => split(PARAS, props.reveal));
let stop = () => {};

onMounted(() => {
  stop = track(root.value as HTMLElement);
});
onBeforeUnmount(() => stop());
</script>

<template>
${pad(
  shell({
    root: 'ref="root" class="reveal" :data-reveal="reveal" :style="{ \'--n\': view.total }"',
    paras: `      <p v-for="para in view.paras" :key="para.text">
        <span class="sr">{{ para.text }}</span>
        <span aria-hidden="true"><template v-for="(word, k) in para.words" :key="word.units[0].i"><span class="w"><span v-for="unit in word.units" :key="unit.i" class="u" :style="{ '--i': unit.i }">{{ unit.t }}</span></span><template v-if="k < para.words.length - 1">{{ ' ' }}</template></template></span>
      </p>`
  }),
  2
)}
</template>

<style scoped>
${C}</style>
`
  })
};

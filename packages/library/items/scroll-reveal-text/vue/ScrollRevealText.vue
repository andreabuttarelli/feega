<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const START = 0.8;
const END = 0.4;

function track(root: HTMLElement): () => void {
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
}

function build(root: HTMLElement, reveal: string) {
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

function mount(root: HTMLElement): () => void {
  if (!root.hasAttribute('data-ready')) {
    root.setAttribute('data-ready', '');
    build(root, root.dataset.reveal === 'char' ? 'char' : 'word');
  }
  return track(root);
}

const root = ref<HTMLElement | null>(null);
let stop = () => {};

onMounted(() => {
  stop = mount(root.value as HTMLElement);
});
onBeforeUnmount(() => stop());
</script>

<template>
  <section class="fl-scroll-reveal-text">
    <div class="fl-container">
      <div class="reveal" data-reveal="word" ref="root">
        <p>This is placeholder copy. Replace it with a short statement about what your product does and who it is for.</p>
        <p>Each word lights up as the reader scrolls, so keep the sentences short and the ideas clear.</p>
        <p>Scroll back up and the text fades again. Swap these lines for your own words.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fl-scroll-reveal-text{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-scroll-reveal-text) *,:where(.fl-scroll-reveal-text) *::before,:where(.fl-scroll-reveal-text) *::after{box-sizing:border-box}
:where(.fl-scroll-reveal-text) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-scroll-reveal-text) a{color:inherit;text-decoration:none}
:where(.fl-scroll-reveal-text) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-scroll-reveal-text{padding-block:var(--feega-space-section)}
.fl-scroll-reveal-text .reveal{--p:0;--dim:0.22;--edge:4;display:grid;gap:var(--feega-space-8);max-width:56rem;margin-inline:auto;text-align:center;font-family:var(--feega-font-display);font-size:clamp(1.625rem,4.2vw,3.25rem);font-weight:500;line-height:1.12;letter-spacing:var(--feega-tracking-tight)}
.fl-scroll-reveal-text .reveal[data-reveal="char"]{--edge:14}
.fl-scroll-reveal-text .reveal p{text-wrap:balance;overflow-wrap:anywhere}
.fl-scroll-reveal-text .w{display:inline-block;white-space:nowrap}
.fl-scroll-reveal-text .u{opacity:clamp(var(--dim),calc(var(--dim) + (1 - var(--dim)) * (var(--p) * (var(--n) + var(--edge)) - var(--i)) / var(--edge)),1)}
.fl-scroll-reveal-text .sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){.fl-scroll-reveal-text .u{opacity:1}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>

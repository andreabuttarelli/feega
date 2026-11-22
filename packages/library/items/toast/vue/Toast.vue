<script setup lang="ts">
import { ref } from 'vue';

const toasts = ref([
  { id: 1, title: 'Changes saved', body: 'Your profile is up to date.', error: false },
  { id: 2, title: 'Could not publish', body: 'Check your connection and try again.', error: true }
]);

function dismiss(id: number) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}
</script>

<template>
  <div class="fl-toast" role="region" aria-label="Notifications">
    <div v-for="toast in toasts" :key="toast.id" :class="['toast', { 'toast--error': toast.error }]" :role="toast.error ? 'alert' : 'status'">
      <span class="mark"><svg v-if="toast.error" class="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg><svg v-else class="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg></span>
      <p class="text"><b>{{ toast.title }}</b><span>{{ toast.body }}</span></p>
      <button class="close" type="button" aria-label="Dismiss" @click="dismiss(toast.id)"><svg class="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg></button>
    </div>
  </div>
</template>

<style scoped>
.fl-toast{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-toast) *,:where(.fl-toast) *::before,:where(.fl-toast) *::after{box-sizing:border-box}
:where(.fl-toast) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-toast) a{color:inherit;text-decoration:none}
:where(.fl-toast) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-toast{display:grid;grid-template-columns:minmax(0,24rem);gap:var(--feega-space-2);padding:var(--feega-space-6) var(--feega-gutter)}
.fl-toast .toast{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:var(--feega-space-3);padding:var(--feega-space-4);border-radius:var(--feega-radius-md);background:var(--feega-raised);box-shadow:var(--feega-shadow-float),inset 0 0 0 1px var(--feega-line);animation:fl-toast-in var(--feega-dur) var(--feega-ease) backwards}
.fl-toast .toast + .toast{animation-delay:80ms}
@keyframes fl-toast-in{from{opacity:0;transform:translateY(12px) scale(0.98)}}
.fl-toast .mark{display:grid;place-items:center;width:28px;height:28px;border-radius:var(--feega-radius-full);background:var(--feega-success-soft);color:var(--feega-success)}
.fl-toast .toast--error .mark{background:var(--feega-danger-soft);color:var(--feega-danger)}
.fl-toast .mark .fl-px{width:11px}
.fl-toast .text{display:grid;gap:2px;padding-top:3px;font-size:var(--feega-text-sm)}
.fl-toast .text b{font-weight:600}
.fl-toast .text span{color:var(--feega-fg-muted)}
.fl-toast .close{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg-subtle);cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease)}
.fl-toast .close:hover{background:var(--feega-surface);color:var(--feega-fg)}
.fl-toast .close .fl-px{width:9px}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>

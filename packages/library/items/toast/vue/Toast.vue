<script setup lang="ts">
import { ref } from 'vue';

const initial = [
  { id: 1, text: 'Changes saved.', error: false },
  { id: 2, text: 'Could not save. Try again.', error: true }
];

const toasts = ref(initial);

function dismiss(id: number) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}
</script>

<template>
  <div class="fl-toast" role="region" aria-label="Notifications">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="{ 'toast--error': toast.error }" :role="toast.error ? 'alert' : 'status'">
      <p>{{ toast.text }}</p>
      <button type="button" aria-label="Dismiss" @click="dismiss(toast.id)">&times;</button>
    </div>
  </div>
</template>

<style scoped>
.fl-toast{font-family:var(--feega-font);line-height:1.5;color:var(--feega-fg);background:var(--feega-bg)}
.fl-toast *,.fl-toast *::before,.fl-toast *::after{box-sizing:border-box}
.fl-toast a{color:inherit}
.fl-toast :focus-visible{outline:2px solid var(--feega-focus);outline-offset:2px}
.fl-toast{display:grid;gap:var(--feega-space-2);width:min(100%,22rem);padding:var(--feega-space-4)}
.fl-toast .toast{display:flex;align-items:center;justify-content:space-between;gap:var(--feega-space-3);padding:var(--feega-space-3) var(--feega-space-4);border:1px solid var(--feega-line);border-left:3px solid var(--feega-success);border-radius:var(--feega-radius-md);background:var(--feega-raised);box-shadow:var(--feega-shadow)}
.fl-toast .toast--error{border-left-color:var(--feega-danger)}
.fl-toast p{margin:0;font-size:0.9375rem}
.fl-toast button{display:inline-grid;place-items:center;width:2rem;height:2rem;border:0;border-radius:var(--feega-radius-sm);background:transparent;color:var(--feega-fg-muted);font:inherit;font-size:1.25rem;cursor:pointer}
.fl-toast button:hover{background:var(--feega-surface);color:var(--feega-fg)}
</style>

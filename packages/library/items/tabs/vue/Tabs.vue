<script setup lang="ts">
import { ref } from 'vue';

const tabs = [
  { label: 'Overview', body: 'Overview content.' },
  { label: 'Activity', body: 'Activity content.' },
  { label: 'Settings', body: 'Settings content.' }
];

const active = ref(0);
const buttons = ref<HTMLButtonElement[]>([]);

function onKeydown(event: KeyboardEvent) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (step === 0) {
    return;
  }
  active.value = (active.value + step + tabs.length) % tabs.length;
  buttons.value[active.value]?.focus();
}
</script>

<template>
  <div class="fl-tabs">
    <div class="list" role="tablist" aria-label="Sections" @keydown="onKeydown">
      <button v-for="(tab, i) in tabs" :id="`fl-tab-${i}`" :key="tab.label" ref="buttons" class="tab" role="tab" type="button" :aria-controls="`fl-panel-${i}`" :aria-selected="active === i" :tabindex="active === i ? 0 : -1" @click="active = i">{{ tab.label }}</button>
    </div>
    <div v-for="(tab, i) in tabs" :id="`fl-panel-${i}`" :key="tab.label" class="panel" role="tabpanel" :aria-labelledby="`fl-tab-${i}`" tabindex="0" :hidden="active !== i"><p>{{ tab.body }}</p></div>
  </div>
</template>

<style scoped>
.fl-tabs{font-family:var(--feega-font);line-height:1.5;color:var(--feega-fg);background:var(--feega-bg)}
.fl-tabs *,.fl-tabs *::before,.fl-tabs *::after{box-sizing:border-box}
.fl-tabs a{color:inherit}
.fl-tabs :focus-visible{outline:2px solid var(--feega-focus);outline-offset:2px}
.fl-tabs{padding:var(--feega-space-4)}
.fl-tabs .list{display:flex;gap:var(--feega-space-1);overflow-x:auto;border-bottom:1px solid var(--feega-line)}
.fl-tabs .tab{padding:var(--feega-space-3) var(--feega-space-4);border:0;border-bottom:2px solid transparent;background:transparent;color:var(--feega-fg-muted);font:inherit;font-weight:500;white-space:nowrap;cursor:pointer}
.fl-tabs .tab:hover{color:var(--feega-fg)}
.fl-tabs .tab[aria-selected="true"]{border-bottom-color:var(--feega-accent);color:var(--feega-fg)}
.fl-tabs .panel{padding:var(--feega-space-4) 0;color:var(--feega-fg-muted)}
.fl-tabs .panel p{margin:0}
</style>

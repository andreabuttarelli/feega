import { px } from './kit.mjs';

const TABS = [
  ['Overview', 'Traffic is up this week', 'Visits grew 12% against last week, led by the pricing page.'],
  ['Activity', 'Three changes today', 'Two pages published and one form edited, all by your team.'],
  ['Settings', 'Workspace defaults', 'Pick who can publish, the default theme and the time zone.']
];

const tabsCss = [
  '.fl-tabs{padding:var(--feega-space-6) var(--feega-gutter)}',
  '.fl-tabs .list{display:inline-flex;gap:2px;max-width:100%;padding:4px;overflow-x:auto;border-radius:var(--feega-radius-full);background:var(--feega-surface)}',
  '.fl-tabs .tab{min-height:34px;padding:0 var(--feega-space-4);border:0;border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg-muted);font:inherit;font-size:var(--feega-text-sm);font-weight:500;letter-spacing:var(--feega-tracking);white-space:nowrap;cursor:pointer;transition:background-color var(--feega-dur) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease),box-shadow var(--feega-dur) var(--feega-ease)}',
  '.fl-tabs .tab:hover{color:var(--feega-fg)}',
  '.fl-tabs .tab[aria-selected="true"]{background:var(--feega-raised);color:var(--feega-fg);box-shadow:var(--feega-shadow)}',
  '.fl-tabs .panel{display:grid;gap:var(--feega-space-2);max-width:36rem;padding:var(--feega-space-6) var(--feega-space-2);animation:fl-tabs-in var(--feega-dur) var(--feega-ease)}',
  '.fl-tabs .panel[hidden]{display:none}',
  '.fl-tabs .panel h3{font-size:var(--feega-text-xl);font-weight:500;letter-spacing:-0.04em}',
  '.fl-tabs .panel p{color:var(--feega-fg-muted)}',
  '@keyframes fl-tabs-in{from{opacity:0;transform:translateY(6px)}}'
];

const modalCss = [
  '.fl-modal{padding:var(--feega-space-6) var(--feega-gutter)}',
  '.fl-modal dialog{width:min(calc(100% - 2 * var(--feega-gutter)),27rem);padding:0;border:0;border-radius:var(--feega-radius-lg);background:var(--feega-raised);color:var(--feega-fg);box-shadow:var(--feega-shadow-float)}',
  '.fl-modal dialog[open]{animation:fl-modal-in var(--feega-dur) var(--feega-ease)}',
  '.fl-modal dialog::backdrop{background:var(--feega-overlay);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}',
  '@keyframes fl-modal-in{from{opacity:0;transform:translateY(12px) scale(0.97)}}',
  '.fl-modal form{display:grid;gap:var(--feega-space-3);padding:var(--feega-space-8)}',
  '.fl-modal .icon{display:grid;place-items:center;width:44px;height:44px;margin-bottom:var(--feega-space-2);border-radius:var(--feega-radius-md);background:var(--feega-danger-soft);color:var(--feega-danger)}',
  '.fl-modal .icon .fl-px{width:18px}',
  '.fl-modal h2{font-size:1.375rem;font-weight:600;letter-spacing:-0.04em}',
  '.fl-modal form p{color:var(--feega-fg-muted)}',
  '.fl-modal .actions{display:flex;justify-content:flex-end;gap:var(--feega-space-2);margin-top:var(--feega-space-4)}',
  '.fl-modal .danger{border-color:var(--feega-danger);background:var(--feega-danger);color:var(--feega-danger-fg)}',
  '.fl-modal .danger:hover{border-color:var(--feega-danger);background:var(--feega-danger);opacity:0.88}'
];

const toastCss = [
  '.fl-toast{display:grid;grid-template-columns:minmax(0,24rem);gap:var(--feega-space-2);padding:var(--feega-space-6) var(--feega-gutter)}',
  '.fl-toast .toast{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:var(--feega-space-3);padding:var(--feega-space-4);border-radius:var(--feega-radius-md);background:var(--feega-raised);box-shadow:var(--feega-shadow-float),inset 0 0 0 1px var(--feega-line);animation:fl-toast-in var(--feega-dur) var(--feega-ease) backwards}',
  '.fl-toast .toast + .toast{animation-delay:80ms}',
  '@keyframes fl-toast-in{from{opacity:0;transform:translateY(12px) scale(0.98)}}',
  '.fl-toast .mark{display:grid;place-items:center;width:28px;height:28px;border-radius:var(--feega-radius-full);background:var(--feega-success-soft);color:var(--feega-success)}',
  '.fl-toast .toast--error .mark{background:var(--feega-danger-soft);color:var(--feega-danger)}',
  '.fl-toast .mark .fl-px{width:11px}',
  '.fl-toast .text{display:grid;gap:2px;padding-top:3px;font-size:var(--feega-text-sm)}',
  '.fl-toast .text b{font-weight:600}',
  '.fl-toast .text span{color:var(--feega-fg-muted)}',
  '.fl-toast .close{display:grid;place-items:center;width:28px;height:28px;border:0;border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg-subtle);cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease)}',
  '.fl-toast .close:hover{background:var(--feega-surface);color:var(--feega-fg)}',
  '.fl-toast .close .fl-px{width:9px}'
];

const tabsStatic = (attrs = '') => `<div class="fl-tabs"${attrs}>
  <div class="list" role="tablist" aria-label="Sections">
${TABS.map(([label], i) => `    <button class="tab" role="tab" type="button" id="fl-tab-${i + 1}" aria-controls="fl-panel-${i + 1}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ''}>${label}</button>`).join('\n')}
  </div>
${TABS.map(([, title, body], i) => `  <div class="panel" role="tabpanel" id="fl-panel-${i + 1}" aria-labelledby="fl-tab-${i + 1}" tabindex="0"${i ? ' hidden' : ''}><h3>${title}</h3><p>${body}</p></div>`).join('\n')}
</div>`;

const tabsScript = (typed) => `document.querySelectorAll${typed ? '<HTMLElement>' : ''}('.fl-tabs:not([data-ready])').forEach((root) => {
  root.setAttribute('data-ready', '');
  const tabs = ${typed ? "Array.from(root.querySelectorAll<HTMLButtonElement>('[role=\"tab\"]'))" : "[...root.querySelectorAll('[role=\"tab\"]')]"};
  const panels = ${typed ? "Array.from(root.querySelectorAll<HTMLElement>('[role=\"tabpanel\"]'))" : "[...root.querySelectorAll('[role=\"tabpanel\"]')]"};

  function select(index${typed ? ': number' : ''}) {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    tabs[index].focus();
  }

  tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i)));
  root.querySelector('[role="tablist"]')${typed ? '?' : ''}.addEventListener('keydown', (event) => {
    const key = (event${typed ? ' as KeyboardEvent' : ''}).key;
    const step = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }
    select((tabs.indexOf(document.activeElement${typed ? ' as HTMLButtonElement' : ''}) + step + tabs.length) % tabs.length);
  });
});`;

const tabsMount = `function mount(root: HTMLElement): () => void {
  const stop = new AbortController();
  const { signal } = stop;
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'));

  function select(index: number) {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    tabs[index].focus();
  }

  tabs.forEach((tab, i) => tab.addEventListener('click', () => select(i), { signal }));
  root.querySelector('[role="tablist"]')?.addEventListener(
    'keydown',
    (event) => {
      const key = (event as KeyboardEvent).key;
      const step = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
      if (step === 0) {
        return;
      }
      select((tabs.indexOf(document.activeElement as HTMLButtonElement) + step + tabs.length) % tabs.length);
    },
    { signal }
  );

  return () => stop.abort();
}`;

const pad = (text, n) =>
  text
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

const modalBody = (on) => `  <dialog ${on.ref} aria-labelledby="fl-modal-title">
    <form method="dialog">
      <span ${on.cls}="icon">${px('warn')}</span>
      <h2 id="fl-modal-title">Delete this project?</h2>
      <p>The project, its pages and its history are removed for everyone. This can't be undone.</p>
      <div ${on.cls}="actions">
        <button ${on.cls}="fl-btn fl-btn--sm" value="cancel">Cancel</button>
        <button ${on.cls}="fl-btn fl-btn--sm danger" value="confirm">Delete project</button>
      </div>
    </form>
  </dialog>`;

const TOASTS = `[
  { id: 1, title: 'Changes saved', body: 'Your profile is up to date.', error: false },
  { id: 2, title: 'Could not publish', body: 'Check your connection and try again.', error: true }
]`;

export const interactive = [
  {
    id: 'tabs',
    mods: [],
    css: tabsCss,
    files: (C) => ({
      html: tabsStatic() + `\n\n<script>\n${tabsScript(false)}\n</script>\n`,
      astro: `---\n---\n\n${tabsStatic()}\n\n<script>\n${tabsScript(true)}\n</script>\n\n<style>\n${C}</style>\n`,
      svelte: `<script lang="ts">
${pad(tabsMount, 2)}

  let root: HTMLElement;

  $effect(() => mount(root));
</script>

${tabsStatic(' bind:this={root}')}

<style>
${C}</style>
`,
      react: `import { useEffect, useRef } from 'react';
import './Tabs.css';

${tabsMount}

export function Tabs() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => (root.current ? mount(root.current) : undefined), []);

  return (
${pad(tabsStatic(' ref={root}').replace(/class="/g, 'className="').replace(/tabindex="/g, 'tabIndex="').replace(/(tabIndex)="(-?\d)"/g, '$1={$2}').replace(/ hidden>/g, ' hidden>'), 4)}
  );
}
`,
      vue: `<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

${tabsMount}

const root = ref<HTMLElement | null>(null);
let stop = () => {};

onMounted(() => {
  stop = mount(root.value as HTMLElement);
});
onBeforeUnmount(() => stop());
</script>

<template>
${pad(tabsStatic(' ref="root"'), 2)}
</template>

<style scoped>
${C}</style>
`
    })
  },
  {
    id: 'modal',
    mods: ['px', 'btn'],
    css: modalCss,
    files: (C) => {
      const plain = `<div class="fl-modal">
  <button class="fl-btn" type="button" data-open>Delete project</button>
${modalBody({ ref: '', cls: 'class' }).replace('<dialog  ', '<dialog ')}
</div>`;
      const script = (typed) => `document.querySelectorAll${typed ? '<HTMLElement>' : ''}('.fl-modal:not([data-ready])').forEach((root) => {
  root.setAttribute('data-ready', '');
  const dialog = root.querySelector${typed ? '<HTMLDialogElement>' : ''}('dialog');
  root.querySelector('[data-open]')${typed ? '?' : ''}.addEventListener('click', () => dialog${typed ? '?' : ''}.showModal());
});`;
      return {
        html: `${plain}\n\n<script>\n${script(false)}\n</script>\n`,
        astro: `---\n---\n\n${plain}\n\n<script>\n${script(true)}\n</script>\n\n<style>\n${C}</style>\n`,
        svelte: `<script lang="ts">
  let dialog: HTMLDialogElement;
</script>

<div class="fl-modal">
  <button class="fl-btn" type="button" onclick={() => dialog.showModal()}>Delete project</button>
${modalBody({ ref: 'bind:this={dialog}', cls: 'class' })}
</div>

<style>
${C}</style>
`,
        react: `import { useRef } from 'react';
import './Modal.css';

export function Modal() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <div className="fl-modal">
      <button className="fl-btn" type="button" onClick={() => dialog.current?.showModal()}>Delete project</button>
${modalBody({ ref: 'ref={dialog}', cls: 'className' }).replace(/'/g, '&apos;').split('\n').map((l) => '    ' + l).join('\n')}
    </div>
  );
}
`,
        vue: `<script setup lang="ts">
import { ref } from 'vue';

const dialog = ref<HTMLDialogElement | null>(null);
</script>

<template>
  <div class="fl-modal">
    <button class="fl-btn" type="button" @click="dialog?.showModal()">Delete project</button>
${modalBody({ ref: 'ref="dialog"', cls: 'class' }).split('\n').map((l) => '  ' + l).join('\n')}
  </div>
</template>

<style scoped>
${C}</style>
`
      };
    }
  },
  {
    id: 'toast',
    mods: ['px'],
    css: toastCss,
    files: (C) => {
      const check = px('check');
      const close = px('close');
      const warn = px('close');
      const one = (cls, role, title, body, mark) => `  <div class="toast${cls}" role="${role}">
    <span class="mark">${mark}</span>
    <p class="text"><b>${title}</b><span>${body}</span></p>
    <button class="close" type="button" aria-label="Dismiss">${close}</button>
  </div>`;
      const plain = `<div class="fl-toast" role="region" aria-label="Notifications">
${one('', 'status', 'Changes saved', 'Your profile is up to date.', check)}
${one(' toast--error', 'alert', 'Could not publish', 'Check your connection and try again.', warn)}
</div>`;
      const script = (typed) => `document.querySelectorAll${typed ? '<HTMLElement>' : ''}('.fl-toast .close').forEach((button) => {
  button.addEventListener('click', () => button.closest('.toast')${typed ? '?' : ''}.remove());
});`;
      return {
        html: `${plain}\n\n<script>\n${script(false)}\n</script>\n`,
        astro: `---\n---\n\n${plain}\n\n<script>\n${script(true)}\n</script>\n\n<style>\n${C}</style>\n`,
        svelte: `<script lang="ts">
  const initial = ${TOASTS.split('\n').join('\n  ')};

  let toasts = $state(initial);

  function dismiss(id: number) {
    toasts = toasts.filter((toast) => toast.id !== id);
  }
</script>

<div class="fl-toast" role="region" aria-label="Notifications">
  {#each toasts as toast (toast.id)}
    <div class="toast" class:toast--error={toast.error} role={toast.error ? 'alert' : 'status'}>
      <span class="mark">{#if toast.error}${warn}{:else}${check}{/if}</span>
      <p class="text"><b>{toast.title}</b><span>{toast.body}</span></p>
      <button class="close" type="button" aria-label="Dismiss" onclick={() => dismiss(toast.id)}>${close}</button>
    </div>
  {/each}
</div>

<style>
${C}</style>
`,
        react: `import { useState } from 'react';
import './Toast.css';

const initial = ${TOASTS};

export function Toast() {
  const [toasts, setToasts] = useState(initial);

  return (
    <div className="fl-toast" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={toast.error ? 'toast toast--error' : 'toast'} role={toast.error ? 'alert' : 'status'}>
          <span className="mark">{toast.error ? ${warn.replace('class=', 'className=')} : ${check.replace('class=', 'className=')}}</span>
          <p className="text"><b>{toast.title}</b><span>{toast.body}</span></p>
          <button className="close" type="button" aria-label="Dismiss" onClick={() => setToasts(toasts.filter((t) => t.id !== toast.id))}>${close.replace('class=', 'className=')}</button>
        </div>
      ))}
    </div>
  );
}
`,
        vue: `<script setup lang="ts">
import { ref } from 'vue';

const toasts = ref(${TOASTS.split('\n').join('\n')});

function dismiss(id: number) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}
</script>

<template>
  <div class="fl-toast" role="region" aria-label="Notifications">
    <div v-for="toast in toasts" :key="toast.id" :class="['toast', { 'toast--error': toast.error }]" :role="toast.error ? 'alert' : 'status'">
      <span class="mark">${warn.replace('<svg', '<svg v-if="toast.error"')}${check.replace('<svg', '<svg v-else')}</span>
      <p class="text"><b>{{ toast.title }}</b><span>{{ toast.body }}</span></p>
      <button class="close" type="button" aria-label="Dismiss" @click="dismiss(toast.id)">${close}</button>
    </div>
  </div>
</template>

<style scoped>
${C}</style>
`
      };
    }
  }
];

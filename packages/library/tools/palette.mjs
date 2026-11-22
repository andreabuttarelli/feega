import { px } from './kit.mjs';

const COMMANDS = [
  ['New project', 'Actions', '⌘N'],
  ['Invite people', 'Actions', '⌘I'],
  ['Open settings', 'Navigation', '⌘,'],
  ['Go to analytics', 'Navigation', 'G A'],
  ['Switch theme', 'Preferences', '⌘T'],
  ['Read the docs', 'Help', '?']
];

const data = `const commands = [
${COMMANDS.map(([label, group, keys]) => `  { label: '${label}', group: '${group}', keys: '${keys}' }`).join(',\n')}
];`;

const css = [
  '.fl-command-palette{padding:var(--feega-space-6) var(--feega-gutter)}',
  '.fl-command-palette .box{max-width:34rem;margin-inline:auto;overflow:hidden;border-radius:var(--feega-radius-lg);background:var(--feega-raised);box-shadow:var(--feega-shadow-float),inset 0 0 0 1px var(--feega-line);animation:fl-command-palette-in var(--feega-dur) var(--feega-ease)}',
  '@keyframes fl-command-palette-in{from{opacity:0;transform:scale(0.97) translateY(8px)}}',
  '.fl-command-palette .search{display:flex;align-items:center;gap:var(--feega-space-3);padding:0 var(--feega-space-4);border-bottom:1px solid var(--feega-line);color:var(--feega-fg-subtle)}',
  '.fl-command-palette .search .fl-px{width:14px}',
  '.fl-command-palette input{flex:1;min-width:0;height:52px;border:0;background:transparent;color:var(--feega-fg);font:inherit;font-size:1.0625rem;letter-spacing:var(--feega-tracking);outline:none}',
  '.fl-command-palette input::placeholder{color:var(--feega-fg-subtle)}',
  '.fl-command-palette .esc{padding:2px 6px;border-radius:var(--feega-radius-xs);background:var(--feega-surface);font-family:var(--feega-font-mono);font-size:11px}',
  '.fl-command-palette ul{display:grid;max-height:18rem;margin:0;padding:6px;overflow-y:auto;list-style:none}',
  '.fl-command-palette li{position:relative;display:flex;align-items:center;gap:var(--feega-space-3);min-height:42px;padding:0 12px;border-radius:var(--feega-radius-sm);font-size:var(--feega-text-sm);font-weight:500;cursor:pointer}',
  '.fl-command-palette li[aria-selected="true"]{background:var(--feega-surface)}',
  '.fl-command-palette li[aria-selected="true"]::before{content:"";position:absolute;left:3px;width:3px;height:16px;border-radius:var(--feega-radius-full);background:var(--feega-accent)}',
  '.fl-command-palette li small{color:var(--feega-fg-subtle);font-weight:400}',
  '.fl-command-palette li kbd{margin-left:auto;font-family:var(--feega-font-mono);font-size:11px;color:var(--feega-fg-subtle)}',
  '.fl-command-palette .none{padding:var(--feega-space-8) var(--feega-space-4);color:var(--feega-fg-muted);font-size:var(--feega-text-sm);text-align:center}',
  '.fl-command-palette .none[hidden]{display:none}',
  '.fl-command-palette li[hidden]{display:none}'
];

const search = px('search');

const shell = (input, list, none) => `<div class="fl-command-palette">
  <div class="box">
    <label class="search">${search}${input}<kbd class="esc">esc</kbd></label>
${list}
${none}
  </div>
</div>`;

const staticList = `    <ul role="listbox" id="fl-palette-list" aria-label="Commands">
${COMMANDS.map(([l, g, k], i) => `      <li role="option" aria-selected="${i === 0}" data-label="${l.toLowerCase()}">${l}<small>${g}</small><kbd>${k}</kbd></li>`).join('\n')}
    </ul>`;

const plain = shell(
  '<input type="text" placeholder="Type a command or search" aria-label="Command" aria-controls="fl-palette-list" role="combobox" aria-expanded="true" autocomplete="off" />',
  staticList,
  '    <p class="none" hidden>No results</p>'
);

const script = (t) => `document.querySelectorAll${t ? '<HTMLElement>' : ''}('.fl-command-palette:not([data-ready])').forEach((root) => {
  root.setAttribute('data-ready', '');
  const input = root.querySelector${t ? '<HTMLInputElement>' : ''}('input')${t ? '!' : ''};
  const items = ${t ? "Array.from(root.querySelectorAll<HTMLLIElement>('[role=\"option\"]'))" : "[...root.querySelectorAll('[role=\"option\"]')]"};
  const none = root.querySelector${t ? '<HTMLElement>' : ''}('.none')${t ? '!' : ''};
  let active = 0;

  function visible() {
    return items.filter((item) => !item.hidden);
  }

  function paint() {
    const shown = visible();
    items.forEach((item) => item.setAttribute('aria-selected', String(item === shown[active])));
    none.hidden = shown.length > 0;
  }

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    items.forEach((item) => {
      item.hidden = !(item.dataset.label${t ? ' ?? ' : ' || '}'').includes(query);
    });
    active = 0;
    paint();
  });

  input.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    const count = visible().length;
    if (step === 0 || count === 0) {
      return;
    }
    event.preventDefault();
    active = (active + step + count) % count;
    paint();
  });

  items.forEach((item) => item.addEventListener('mouseenter', () => {
    active = visible().indexOf(item);
    paint();
  }));
});`;

const stepFn = (get, set, len) => `const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0 || ${len} === 0) {
      return;
    }
    event.preventDefault();
    ${set}((${get} + step + ${len}) % ${len});`;

export const palette = {
  id: 'command-palette',
  name: 'Command palette',
  description: 'Search box over a filtered list of commands with groups and shortcuts; arrow keys move the selection.',
  category: 'app',
  tags: ['search', 'command', 'keyboard'],
  mods: ['px'],
  css,
  files: (C) => ({
    html: `${plain}\n\n<script>\n${script(false)}\n</script>\n`,
    astro: `---\n---\n\n${plain}\n\n<script>\n${script(true)}\n</script>\n\n<style>\n${C}</style>\n`,
    svelte: `<script lang="ts">
  ${data.split('\n').join('\n  ')}

  let query = $state('');
  let active = $state(0);
  const shown = $derived(commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase())));

  function onkeydown(event: KeyboardEvent) {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0 || shown.length === 0) {
      return;
    }
    event.preventDefault();
    active = (active + step + shown.length) % shown.length;
  }
</script>

<div class="fl-command-palette">
  <div class="box">
    <label class="search">${search}<input type="text" placeholder="Type a command or search" aria-label="Command" role="combobox" aria-controls="fl-palette-list" aria-expanded="true" autocomplete="off" bind:value={query} oninput={() => (active = 0)} {onkeydown} /><kbd class="esc">esc</kbd></label>
    <ul role="listbox" id="fl-palette-list" aria-label="Commands">
      {#each shown as command, i (command.label)}
        <li role="option" aria-selected={i === active} onmouseenter={() => (active = i)}>{command.label}<small>{command.group}</small><kbd>{command.keys}</kbd></li>
      {/each}
    </ul>
    <p class="none" hidden={shown.length > 0}>No results</p>
  </div>
</div>

<style>
${C}</style>
`,
    react: `import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import './CommandPalette.css';

${data}

export function CommandPalette() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const shown = commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()));

  function onKeyDown(event: KeyboardEvent) {
    ${stepFn('active', 'setActive', 'shown.length')}
  }

  return (
    <div className="fl-command-palette">
      <div className="box">
        <label className="search">${search.replace('class=', 'className=')}<input type="text" placeholder="Type a command or search" aria-label="Command" role="combobox" aria-controls="fl-palette-list" aria-expanded="true" autoComplete="off" value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onKeyDown} /><kbd className="esc">esc</kbd></label>
        <ul role="listbox" id="fl-palette-list" aria-label="Commands">
          {shown.map((command, i) => (
            <li key={command.label} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)}>{command.label}<small>{command.group}</small><kbd>{command.keys}</kbd></li>
          ))}
        </ul>
        <p className="none" hidden={shown.length > 0}>No results</p>
      </div>
    </div>
  );
}
`,
    vue: `<script setup lang="ts">
import { computed, ref } from 'vue';

${data}

const query = ref('');
const active = ref(0);
const shown = computed(() => commands.filter((c) => c.label.toLowerCase().includes(query.value.trim().toLowerCase())));

function onKeydown(event: KeyboardEvent) {
  const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
  if (step === 0 || shown.value.length === 0) {
    return;
  }
  event.preventDefault();
  active.value = (active.value + step + shown.value.length) % shown.value.length;
}
</script>

<template>
  <div class="fl-command-palette">
    <div class="box">
      <label class="search">${search}<input v-model="query" type="text" placeholder="Type a command or search" aria-label="Command" role="combobox" aria-controls="fl-palette-list" aria-expanded="true" autocomplete="off" @input="active = 0" @keydown="onKeydown" /><kbd class="esc">esc</kbd></label>
      <ul role="listbox" id="fl-palette-list" aria-label="Commands">
        <li v-for="(command, i) in shown" :key="command.label" role="option" :aria-selected="i === active" @mouseenter="active = i">{{ command.label }}<small>{{ command.group }}</small><kbd>{{ command.keys }}</kbd></li>
      </ul>
      <p class="none" :hidden="shown.length > 0">No results</p>
    </div>
  </div>
</template>

<style scoped>
${C}</style>
`
  })
};

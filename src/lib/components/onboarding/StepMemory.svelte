<script lang="ts" module>
  const COPIED_MS = 1800;
  const HOW = ['copy the prompt.', 'paste it into Claude, ChatGPT, Gemini or any AI you use.', 'paste what it writes back here.'] as const;
</script>

<script lang="ts">
  import { MEMORY_MAX_CHARS } from '$lib/onboarding/limits';
  import { MEMORY_PROMPT } from '$lib/onboarding/memory-prompt';
  import type { MemorySource } from '$lib/onboarding/flow';

  type Props = { sources: MemorySource[]; onread: (ids: string[]) => Promise<string>; onsave: (content: string) => void; onskip: () => void };

  let { sources, onread, onsave, onskip }: Props = $props();

  let content = $state('');
  let copied = $state(false);
  let picked = $state<string[]>([]);
  let reading = $state(false);

  const ready = $derived(content.trim().length > 0);

  $effect(() => {
    picked = sources.map((source) => source.id);
  });

  async function copy() {
    await navigator.clipboard.writeText(MEMORY_PROMPT).catch((e) => console.warn('[onboarding] prompt not copied', e));
    copied = true;
    setTimeout(() => (copied = false), COPIED_MS);
  }

  async function read() {
    reading = true;
    content = [content.trim(), await onread(picked)].filter(Boolean).join('\n\n').slice(0, MEMORY_MAX_CHARS);
    reading = false;
  }

  function toggle(id: string) {
    picked = picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id];
  }
</script>

<h1 id="ob-title" class="ob-title">bring what your ai already knows.</h1>
<p class="ob-sub">your taste, your projects, how you like to work. the Feega chat starts from there instead of from zero.</p>

{#if sources.length}
  <div class="box" data-testid="onboarding-sources">
    <p class="box-title">found on this computer</p>
    {#each sources as source (source.id)}
      <label class="source">
        <input type="checkbox" checked={picked.includes(source.id)} onchange={() => toggle(source.id)} />
        <span>{source.label}</span>
        <small>{source.path}</small>
      </label>
    {/each}
    <button type="button" class="ob-secondary" disabled={reading || picked.length === 0} onclick={read} data-testid="onboarding-read-sources">{reading ? 'reading…' : 'read these files'}</button>
  </div>
{/if}

<div class="box">
  <ol>
    {#each HOW as line, i (line)}
      <li><span>{i + 1}</span>{line}</li>
    {/each}
  </ol>
  <button type="button" class="ob-secondary" onclick={copy} data-testid="onboarding-copy-prompt">{copied ? 'copied' : 'copy the prompt'}</button>
</div>

<textarea class="ob-input memory" placeholder="paste it here. you can read and edit it before saving." maxlength={MEMORY_MAX_CHARS} aria-label="What your AI knows about you" bind:value={content} data-testid="onboarding-memory"></textarea>

<button type="button" class="ob-primary" disabled={!ready} onclick={() => onsave(content.trim())} data-testid="onboarding-continue">save and start</button>
<button type="button" class="ob-link" onclick={onskip} data-testid="onboarding-skip-memory">not now</button>

<style>
  .box {
    margin: 0 0 8px;
    padding: 14px 16px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-input);
  }

  .box-title {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--ui-text);
  }

  ol {
    display: grid;
    gap: 8px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
    font-size: 13px;
    line-height: 1.4;
    color: var(--ui-text-secondary);
  }

  li {
    display: flex;
    gap: 10px;
  }

  li span {
    display: grid;
    place-items: center;
    flex: none;
    width: 20px;
    height: 20px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-divider);
    font-family: var(--ui-mono);
    font-size: 11px;
    color: var(--ui-text);
  }

  .source {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 10px;
    align-items: center;
    padding: 4px 0;
    font-size: 13px;
    cursor: pointer;
  }

  .source small {
    grid-column: 2;
    font-family: var(--ui-mono);
    font-size: 11px;
    color: var(--ui-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source input {
    accent-color: var(--ui-text);
  }

  .box :global(.ob-secondary) {
    margin-top: 8px;
  }

  .memory {
    height: 112px;
    padding: 12px 14px;
    margin: 0 0 12px;
    resize: none;
    font-family: var(--ui-mono);
    font-size: 12px;
    line-height: 1.5;
  }
</style>

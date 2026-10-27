<script lang="ts">
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { VarType } from '@feega/motion-core/motion/variables-model';
  import { bindChip, unbindVariable, variableValue } from '$lib/motion/variables';
  import { bindFromLibrary } from '$lib/motion/variable-library';
  import { variableLibrary } from '$lib/canvas/variable-library.svelte';

  let { doc, clip, target, commit }: { doc: MotionDoc; clip: MotionClip; target: string; commit: (result: OpResult, summary: string) => void } = $props();

  const offered = $derived({ ...variableLibrary.collections, ...doc.variables });
  const chip = $derived(bindChip(clip, target, offered));
  let open = $state(false);
  let root = $state<HTMLSpanElement | null>(null);

  const shownValue = (key: string) => String(variableValue(offered, key) ?? '');

  function pick(key: string) {
    open = false;
    commit(bindFromLibrary(doc, offered, clip.id, target, key), `Bound ${target} to ${key}`);
  }

  function closeOutside(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) {
      open = false;
    }
  }

  function closeOnEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
    }
  }
</script>

<svelte:window onpointerdown={closeOutside} />

{#if chip}
  <span class="bind" bind:this={root} onkeydown={closeOnEscape} role="group" aria-label={`${target} variable`}>
    {#if chip.bound}
      <span class="bound" data-testid={`bind-chip-${target}`} data-bound={chip.bound} title={chip.bound}>
        {#if chip.type === VarType.Colour}<i class="swatch" style={`--c: ${shownValue(chip.bound)};`}></i>{/if}
        <b class="name">{chip.bound}</b>
        <output class="value">{shownValue(chip.bound)}</output>
        <button type="button" class="x" aria-label={`Unbind ${target}`} data-testid={`bind-unbind-${target}`} onclick={() => commit(unbindVariable(doc, clip.id, target), `Unbound ${target}`)}>×</button>
      </span>
    {:else}
      <button type="button" class="trigger" aria-label={`Bind ${target} to a variable`} aria-expanded={open} data-testid={`bind-chip-${target}`} onclick={() => (open = !open)}>◇</button>
      {#if open}
        <div class="pop" role="listbox" aria-label={`${chip.type} variables`} data-testid={`bind-picker-${target}`}>
          {#each chip.options as option (option.key)}
            <button type="button" role="option" aria-selected="false" data-testid={`bind-option-${option.key}`} onclick={() => pick(option.key)}>
              {#if chip.type === VarType.Colour}<i class="swatch" style={`--c: ${shownValue(option.key)};`}></i>{/if}
              <span class="name">{option.key}</span>
              <output class="value">{shownValue(option.key)}</output>
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  </span>
{/if}

<style>
  .bind {
    position: relative;
    display: inline-flex;
    min-width: 0;
    flex-shrink: 0;
  }

  .bound {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
    padding: 2px 4px 2px 6px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
    font-size: 12px;
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .value {
    flex-shrink: 0;
    color: var(--ui-ink-2);
    font-family: var(--ui-mono);
    font-size: 11px;
  }

  .swatch {
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-xs);
    background: var(--c);
  }

  button {
    border: 0;
    background: transparent;
    color: var(--ui-ink-2);
    font: inherit;
    cursor: pointer;
  }

  .trigger {
    width: 22px;
    height: 22px;
    border-radius: var(--ui-radius-sm);
    line-height: 1;
  }

  .trigger:hover,
  .trigger[aria-expanded='true'] {
    background: var(--ui-surface);
    color: var(--ui-text);
  }

  .pop {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: 180px;
    max-height: 220px;
    overflow-y: auto;
    padding: 4px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-md);
    background: var(--ui-surface);
  }

  .pop button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text);
    text-align: left;
  }

  .pop button:hover {
    background: var(--ui-line);
  }
</style>

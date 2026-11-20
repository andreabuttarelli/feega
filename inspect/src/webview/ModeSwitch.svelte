<script lang="ts">
  import PenTool from '@lucide/svelte/icons/pen-tool';
  import Hand from '@lucide/svelte/icons/hand';
  import { Mode } from '../messages';
  import { MODE_KEYS } from './modes';

  const SEGMENTS = [
    { mode: Mode.Design, label: 'Design', icon: PenTool },
    { mode: Mode.Navigate, label: 'Navigate', icon: Hand }
  ];

  let { mode, onmode }: { mode: Mode; onmode: (mode: Mode) => void } = $props();

  const at = $derived(SEGMENTS.findIndex((s) => s.mode === mode));
</script>

<div class="track" role="radiogroup" aria-label="Mode" style={`--at: ${at}`}>
  <span class="thumb" aria-hidden="true"></span>
  {#each SEGMENTS as segment (segment.mode)}
    {@const Icon = segment.icon}
    <button type="button" role="radio" aria-checked={mode === segment.mode} class:on={mode === segment.mode} title={`${segment.label} (${MODE_KEYS[segment.mode].toUpperCase()})`} data-mode={segment.mode} onclick={() => onmode(segment.mode)}>
      <Icon size={14} />
      <span>{segment.label}</span>
    </button>
  {/each}
</div>

<style>
  .track {
    --segment: 96px;
    position: relative;
    display: grid;
    grid-template-columns: repeat(2, var(--segment));
    padding: 2px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-input);
  }

  .thumb {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    width: var(--segment);
    border-radius: var(--ui-radius-full);
    background: var(--ui-thumb);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.18), 0 0 0 0.5px rgb(0 0 0 / 0.06);
    transform: translateX(calc(var(--at) * var(--segment)));
    transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 28px;
    border: 0;
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
    transition: color 200ms ease;
  }

  button.on {
    color: var(--ui-thumb-ink);
  }
</style>
